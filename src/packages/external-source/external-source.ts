import type { Express, Request, Response } from 'express';
import type {
  ExternalSourceTypeInsertInput,
  CreateExternalSourceResponse,
  ExternalEventTypeInsertInput,
  ExternalEvent,
  CreateExternalSourceEventTypeResponse,
  GetSourceEventTypeAttributeSchemasResponse,
  AttributeSchema,
  DerivationGroupInsertInput,
  ExternalSourceInsertInput,
} from '../../types/external-source.js';
import Ajv from 'ajv';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import gql from './gql.js';
import { attributeSchemaMetaschema, baseExternalSourceSchema } from '../schemas/external-event-validation-schemata.js';
import { HasuraError } from '../../types/hasura.js';
import { auth } from '../auth/middleware.js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

const upload = multer({ limits: { fieldSize: 25 * 1024 * 1024 } });
const logger = getLogger('packages/external-source/external-source');
const { RATE_LIMITER_LOGIN_MAX, HASURA_API_URL } = getEnv();
const GQL_API_URL = `${HASURA_API_URL}/v1/graphql`;
const ajv = new Ajv();
const compiledAttributeMetaschema = ajv.compile(attributeSchemaMetaschema);
const refreshLimiter = rateLimit({
  legacyHeaders: false,
  max: RATE_LIMITER_LOGIN_MAX,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export function updateSchemaWithDefs(defs: { event_types: any, source_type: any }): Ajv.ValidateFunction {
  // build if statement
  const ifThenElse: { [key: string]: any } = {

  };
  let ifThenElsePointer = ifThenElse;
  const keys = Object.keys(defs.event_types);

  // handling if there's only 1 event type
  if (keys.length === 1) {
    // no need for ifThenElse, simply create localSchemaCopy and update properties.events.items.properties.attributes
    //   to match the event type in defs, and verify the event_type_name matches the def name
    const localSchemaCopy = structuredClone(baseExternalSourceSchema);
    const event_type_name = keys[0];
    const event_type_schema = {
      ...defs.event_types[event_type_name],

      // additionally, restrict extra properties
      additionalProperties: false
    };
    const source_type_name = Object.keys(defs.source_type)[0];
    const source_type_schema = {
      ...defs.source_type[source_type_name],

      // additionally, restrict extra properties
      additionalProperties: false
    };

    localSchemaCopy.properties.events.items.properties.attributes = event_type_schema;
    localSchemaCopy.properties.events.items.properties.event_type_name = { "const": event_type_name };

    // insert def for "source" attributes
    localSchemaCopy.properties.source.properties.attributes = source_type_schema;

    const localAjv = new Ajv();
    return localAjv.compile(localSchemaCopy);
  }

  // handle n event types
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    console.log("NOW ON:", key);
    ifThenElsePointer["if"] = {
      properties: {
        event_type_name: {
          const: key
        }
      }
    };
    ifThenElsePointer["then"] = {
      properties: {
        attributes: {
          $ref: `#/$defs/event_types/${key}`
        }
      }
    };
    ifThenElsePointer["else"] = {

    };
    ifThenElsePointer = ifThenElsePointer["else"];
  }

  // fill in the final else with the last element
  const key = keys[keys.length - 1];
  ifThenElsePointer["properties"] = {
    attributes: {
      $ref: `#/$defs/event_types/${key}`
    }
  }

  // insert if statement into local copy of baseExternalSourceSchema
  const localSchemaCopy = structuredClone(baseExternalSourceSchema);
  localSchemaCopy.properties.events.items["if"] = ifThenElse["if"];
  localSchemaCopy.properties.events.items["then"] = ifThenElse["then"];
  localSchemaCopy.properties.events.items["else"] = ifThenElse["else"];

  // insert def for "source" attributes
  const sourceTypeKey = Object.keys(defs.source_type)[0];
  localSchemaCopy.properties.source.properties.attributes = { $ref: `#/$defs/source_type/${sourceTypeKey}`}

  // add defs
  localSchemaCopy.$defs = {
    event_types: {},
    source_type: {
      [sourceTypeKey]: {
        ...defs.source_type[sourceTypeKey],

        // additionally, restrict extra properties
        additionalProperties: false
      }
    }
  };
  for (const event_type of keys) {
    localSchemaCopy.$defs.event_types[event_type] = {
      ...defs.event_types[event_type],

      // additionally, restrict extra properties
      additionalProperties: false
    };
  }

  // Compile & return full schema with 'defs' added
  const localAjv = new Ajv();
  return localAjv.compile(localSchemaCopy);
}

async function uploadExternalSourceEventTypes(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { body } = req;
  const { event_types, source_types } = body;
  const parsedEventTypes: { [x: string]: object } = JSON.parse(event_types);
  const parsedSourceTypes: { [x: string]: object } = JSON.parse(source_types);

  logger.info(`POST /uploadExternalSourceEventTypes: Uploading External Source and Event Types...`);

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  // Validate uploaded attribute schemas are formatted validly
  const schemasAreValid: boolean = await compiledAttributeMetaschema({event_types: parsedEventTypes, source_types: parsedSourceTypes});
  if (!schemasAreValid) {
    logger.error(
      `POST /uploadExternalSourceEventTypes: Schema validation failed for uploaded source and event types.`,
    );
    compiledAttributeMetaschema.errors?.forEach(error => logger.error(error));
    res.status(500).send({ message: compiledAttributeMetaschema.errors });
    return;
  }

  logger.info(`POST /uploadExternalSourceEventTypes: Uploaded attribute schema(s) are VALID`);
  console.log(parsedEventTypes, parsedSourceTypes);

  // extract the external sources and event types
  const externalSourceTypeInput: ExternalSourceTypeInsertInput[] = [];
  const externalEventTypeInput: ExternalEventTypeInsertInput[] = [];

  const event_type_keys = Object.keys(parsedEventTypes);
  for (const external_event_type of event_type_keys) {
    externalEventTypeInput.push({
      attribute_schema: parsedEventTypes[external_event_type],
      name: external_event_type
    })
  }

  const source_type_keys = Object.keys(parsedSourceTypes);
  for (const external_source_type of source_type_keys) {
    externalSourceTypeInput.push({
      attribute_schema: parsedSourceTypes[external_source_type],
      name: external_source_type
    })
  }

  // Run the Hasura migration for creating all types, in one go
  const response = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.CREATE_EXTERNAL_SOURCE_EVENT_TYPES,
      variables: { externalEventTypes: externalEventTypeInput, externalSourceTypes: externalSourceTypeInput },
    }),
    headers,
    method: 'POST',
  });

  const jsonResponse = await response.json();
  if (jsonResponse?.data !== undefined) {
    res.json(jsonResponse.data as CreateExternalSourceEventTypeResponse);
  } else {
    res.json(jsonResponse as HasuraError);
  }
}

async function uploadExternalSource(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');
  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;
  const { body } = req;

  if (typeof(body) !== "object") {
    logger.error(
      `POST /uploadExternalSourceEventTypes: Body of request must be a JSON, with two stringified properties: "source" and "external_events".`,
    );
    res.status(500).send({ message: `Body of request must be a JSON, with two stringified properties: "source" and "external_events".` });
    return;
  }

  let parsedSource;
  let parsedExternalEvents: ExternalEvent[];
  try {
  const { source, external_events } = body;
  parsedSource = JSON.parse(source);
  parsedExternalEvents = JSON.parse(external_events);
  }
  catch (e) {
    logger.error(
      `POST /uploadExternalSourceEventTypes: Body of request must be a JSON, with two stringified properties: "source" and "external_events". Alternatively, parsing may have failed:\n${e as Error}`,
    );
    res.status(500).send({ message: `Body of request must be a JSON, with two stringified properties: "source" and "external_events". Alternatively, parsing may have failed:\n${e as Error}` });
    return;
  }
  const { attributes, derivation_group_name, key, period, source_type_name, valid_at } = parsedSource;

  // Re-package the fields as a JSON object to be parsed
  const externalSourceJson = {
    events: parsedExternalEvents,
    source: {
      attributes: attributes,
      derivation_group_name: derivation_group_name,
      key: key,
      period: period,
      source_type_name: source_type_name,
      valid_at: valid_at,
    },
  };

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  logger.info(`POST /uploadExternalSource: Uploading External Source: ${key}`);

  // Get the attribute schema for the source's external source type and all contained event types
  let eventTypeNames = parsedExternalEvents.map(e => e.event_type_name);
  eventTypeNames = eventTypeNames.filter((e, i) => eventTypeNames.indexOf(e) === i);
  const attributeSchemas = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.GET_SOURCE_EVENT_TYPE_ATTRIBUTE_SCHEMAS,
      variables: {
        externalEventTypes: eventTypeNames,
        externalSourceType: source_type_name
      },
    }),
    headers,
    method: 'POST',
  });

  const attributeSchemaJson = await attributeSchemas.json();
  const { external_event_type, external_source_type } = attributeSchemaJson.data as GetSourceEventTypeAttributeSchemasResponse;

  if (external_event_type.length === 0 || external_source_type.length === 0) {
    logger.error(
      `POST /uploadExternalSourceEventTypes: The source and event types in your source do not exist in the database.`,
    );
    res.status(500).send({ message: `The source and event types in your source do not exist in the database.` });
    return;
  }

  const eventTypeNamesMappedToSchemas = external_event_type.reduce((acc: Record<string, AttributeSchema>, eventType: ExternalEventTypeInsertInput ) => {
    acc[eventType.name] = eventType.attribute_schema;
    return acc;
  }, {});
  const sourceTypeNamesMappedToSchemas = external_source_type.reduce((acc: Record<string, AttributeSchema>, sourceType: ExternalSourceTypeInsertInput ) => {
    acc[sourceType.name] = sourceType.attribute_schema;
    return acc;
  }, {}); 

  console.log(external_event_type, external_source_type)
  console.log(eventTypeNamesMappedToSchemas, sourceTypeNamesMappedToSchemas)

  // Assemble megaschema from attribute schemas
  const compiledExternalSourceMegaschema: Ajv.ValidateFunction = updateSchemaWithDefs({ event_types: eventTypeNamesMappedToSchemas, source_type: sourceTypeNamesMappedToSchemas });

  // Verify that this is a valid external source
  let sourceIsValid: boolean = false;
  sourceIsValid = await compiledExternalSourceMegaschema(externalSourceJson);
  if (sourceIsValid) {
    logger.info(`POST /uploadExternalSource: External Source ${key}'s formatting is valid`);
  } else {
    logger.error(`POST /uploadExternalSource: External Source ${key}'s formatting is invalid:\n${JSON.stringify(compiledExternalSourceMegaschema.errors)}`);
    res.status(500).send({ message: `External Source ${key}'s formatting is invalid:\n${JSON.stringify(compiledExternalSourceMegaschema.errors)}` });
    return;
  }

  // Run the Hasura migration for creating an external source
  const derivationGroupInsert: DerivationGroupInsertInput = {
    name: derivation_group_name,
    source_type_name: source_type_name,
  };

  const externalSourceInsert: ExternalSourceInsertInput = {
    attributes: attributes,
    derivation_group_name: derivation_group_name,
    end_time: period.end_time,
    external_events: {
      data: parsedExternalEvents,
    },
    key: key,
    source_type_name: source_type_name,
    start_time: period.start_time,
    valid_at: valid_at,
  };

  const response = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.CREATE_EXTERNAL_SOURCE,
      variables: {
        derivation_group: derivationGroupInsert,
        source: externalSourceInsert,
      },
    }),
    headers,
    method: 'POST',
  });

  const jsonResponse = await response.json();
  if (jsonResponse?.data !== undefined) {
    res.json(jsonResponse.data as CreateExternalSourceResponse);
  } else {
    res.json(jsonResponse as HasuraError);
  }
}

export default (app: Express) => {
  /**
   * @swagger
   * /uploadExternalSourceEventTypes:
   *   post:
   *     security:
   *       - bearerAuth: []
   *     consumes:
   *       - multipart/form-data
   *     produces:
   *       - application/json
   *     parameters:
   *       - in: header
   *         name: x-hasura-role
   *         schema:
   *           type: string
   *           required: false
   *     requestBody:
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               event_types:
   *                 description: An object representing the JSON Schema definition(s) for all external event types to be uploaded.
   *                 type: object
   *               source_types:
   *                 description: An object representing the JSON Schema definition(s) for all external event types to be uploaded.
   *                 type: object
   *             required:
   *               - event_types
   *                 source_types
   *     responses:
   *       200:
   *         description: Created External Source & Event Types
   *         content:
   *           application/json:
   *             schema:
   *                properties:
   *                  createExternalEventTypes:
   *                    description: Names of all the event types that were created in this request.
   *                    type: object
   *                  createExternalSourceTypes:
   *                    description: Names of all the source types that were created in this request.
   *                    type: object
   *       403:
   *         description: Unauthorized error
   *       401:
   *         description: Unauthenticated error
   *     summary: Uploads & validates a combination of External Event & Source types to Hasura.
   *     tags:
   *       - Hasura
   */
  app.post(
    '/uploadExternalSourceEventTypes',
    upload.any(),
    refreshLimiter,
    auth,
    uploadExternalSourceEventTypes,
  );

  /**
   * @swagger
   * /uploadExternalSource:
   *   post:
   *     security:
   *       - bearerAuth: []
   *     consumes:
   *       - multipart/form-data
   *     produces:
   *       - application/json
   *     parameters:
   *       - in: header
   *         name: x-hasura-role
   *         schema:
   *           type: string
   *           required: false
   *     requestBody:
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               attributes:
   *                 type: object
   *               derivation_group_name:
   *                 type: string
   *               end_time:
   *                 type: string
   *               events:
   *                 type: object
   *                 properties:
   *                   data:
   *                     type: array
   *                 required:
   *                   - data
   *               key:
   *                 type: string
   *               source_type_name:
   *                 type: string
   *               start_time:
   *                 type: string
   *               valid_at:
   *                 type: string
   *             required:
   *               - attributes
   *                 derivation_group_name
   *                 end_time
   *                 events
   *                 key
   *                 source_type_name
   *                 start_time
   *                 valid_at
   *     responses:
   *       200:
   *         description: Created External Source
   *         content:
   *           application/json:
   *             schema:
   *                properties:
   *                  createExternalSource:
   *                    type: object
   *                    properties:
   *                      name:
   *                        description: Name of the created External Source
   *                        type: string
   *       403:
   *         description: Unauthorized error
   *       401:
   *         description: Unauthenticated error
   *     summary: Uploads an External Source to Hasura.
   *     tags:
   *       - Hasura
   */
  app.post('/uploadExternalSource', upload.any(), refreshLimiter, auth, uploadExternalSource);
};
