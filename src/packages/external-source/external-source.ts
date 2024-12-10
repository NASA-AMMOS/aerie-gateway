import type { Express, Request, Response } from 'express';
import type {
  ExternalSourceTypeInsertInput,
  CreateExternalSourceResponse,
  ExternalEventTypeInsertInput,
  CreateExternalSourceEventTypeResponse,
  GetSourceEventTypeAttributeSchemasResponse,
  AttributeSchema,
  DerivationGroupInsertInput,
  ExternalSourceInsertInput,
  ExternalSourceRequest,
  ExternalEventRequest,
} from '../../types/external-source.js';
import Ajv from 'ajv';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import gql from './gql.js';
import { attributeSchemaMetaschema, baseExternalSourceSchema } from '../../schemas/external-event-validation-schemata.js';
import { HasuraError } from '../../types/hasura.js';
import { auth } from '../auth/middleware.js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

const upload = multer({ limits: { fieldSize: 25 * 1024 * 1024 } });
const logger = getLogger('packages/external-source/external-source');
const { RATE_LIMITER_LOGIN_MAX, GQL_API_URL } = getEnv();
const ajv = new Ajv();
const compiledAttributeMetaschema = ajv.compile(attributeSchemaMetaschema);
const refreshLimiter = rateLimit({
  legacyHeaders: false,
  max: RATE_LIMITER_LOGIN_MAX,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export function updateSchemaWithDefs(defs: { event_types: any; source_type: any }): Ajv.ValidateFunction {
  // Build if statement
  const ifThenElse: { [key: string]: any } = {};
  let ifThenElsePointer = ifThenElse;
  const keys = Object.keys(defs.event_types);

  // Handle single event type (don't bother with $defs, just update attributes' properties directly)
  if (keys.length === 1) {
    const localSchemaCopy = structuredClone(baseExternalSourceSchema);

    const eventTypeName = keys[0];
    const eventTypeSchema = {
      ...defs.event_types[eventTypeName],
      additionalProperties: false,
    };
    const sourceTypeName = Object.keys(defs.source_type)[0];
    const sourceTypeSchema = {
      ...defs.source_type[sourceTypeName],
      additionalProperties: false,
    };

    localSchemaCopy.properties.events.items.properties.attributes = eventTypeSchema;
    localSchemaCopy.properties.events.items.properties.event_type_name = { const: eventTypeName };

    // Insert def for "source" attributes
    localSchemaCopy.properties.source.properties.attributes = sourceTypeSchema;

    const localAjv = new Ajv();
    return localAjv.compile(localSchemaCopy);
  }

  // Handle n event types
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    // Create tree of if/else/then statements to support validating different types
    ifThenElsePointer['if'] = {
      properties: {
        event_type_name: {
          const: key,
        },
      },
    };
    ifThenElsePointer['then'] = {
      properties: {
        attributes: {
          $ref: `#/$defs/event_types/${key}`,
        },
      },
    };
    ifThenElsePointer['else'] = {};
    ifThenElsePointer = ifThenElsePointer['else'];
  }

  const key = keys[keys.length - 1];
  ifThenElsePointer['properties'] = {
    attributes: {
      $ref: `#/$defs/event_types/${key}`,
    },
  };

  const localSchemaCopy = structuredClone(baseExternalSourceSchema);
  localSchemaCopy.properties.events.items['if'] = ifThenElse['if'];
  localSchemaCopy.properties.events.items['then'] = ifThenElse['then'];
  localSchemaCopy.properties.events.items['else'] = ifThenElse['else'];

  // Insert def for "source" attributes
  const sourceTypeKey = Object.keys(defs.source_type)[0];
  localSchemaCopy.properties.source.properties.attributes = { $ref: `#/$defs/source_type/${sourceTypeKey}` };

  // Add defs
  localSchemaCopy.$defs = {
    event_types: {},
    source_type: {
      [sourceTypeKey]: {
        ...defs.source_type[sourceTypeKey],
        additionalProperties: false,
      },
    },
  };
  for (const eventType of keys) {
    localSchemaCopy.$defs.event_types[eventType] = {
      ...defs.event_types[eventType],
      additionalProperties: false,
    };
  }

  // Compile & return full schema with 'defs' added
  const localAjv = new Ajv();
  return localAjv.compile(localSchemaCopy);
}

async function uploadExternalSourceEventTypes(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    body: {event_types, source_types},
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;
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
  const schemasAreValid: boolean = await compiledAttributeMetaschema({
    event_types: parsedEventTypes,
    source_types: parsedSourceTypes,
  });
  if (!schemasAreValid) {
    const errorMsg = `Schema validation failed for uploaded source and event types:\n${JSON.stringify(compiledAttributeMetaschema.errors)}`;
    logger.error(`POST /uploadExternalSourceEventTypes: ${errorMsg}`);
    res.status(500).send({ message: errorMsg });
    return;
  }

  logger.info(`POST /uploadExternalSourceEventTypes: Uploaded attribute schema(s) are VALID`);

  // extract the external sources and event types
  const externalSourceTypeInput: ExternalSourceTypeInsertInput[] = [];
  const externalEventTypeInput: ExternalEventTypeInsertInput[] = [];

  const eventTypeKeys = Object.keys(parsedEventTypes);
  for (const externalEventType of eventTypeKeys) {
    externalEventTypeInput.push({
      attribute_schema: parsedEventTypes[externalEventType],
      name: externalEventType,
    });
  }

  const sourceTypeKeys = Object.keys(parsedSourceTypes);
  for (const externalSourceType of sourceTypeKeys) {
    externalSourceTypeInput.push({
      attribute_schema: parsedSourceTypes[externalSourceType],
      name: externalSourceType,
    });
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

  const createExternalSourceEventTypesResponse = await response.json();
  if (createExternalSourceEventTypesResponse?.data !== undefined) {
    res.json(createExternalSourceEventTypesResponse.data as CreateExternalSourceEventTypeResponse);
  } else {
    res.json(createExternalSourceEventTypesResponse as HasuraError);
  }
}

async function uploadExternalSource(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    body: { source, events },
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  let parsedSource: ExternalSourceRequest;
  let parsedExternalEvents: ExternalEventRequest[];

  try {
    parsedSource = JSON.parse(source);
    parsedExternalEvents = JSON.parse(events);
  } catch (e) {
    const errorMsg = `Body of request must be a JSON, with two stringified properties: "source" and "events". Alternatively, parsing may have failed:\n${(e as Error).message}`;
    logger.error(
      `POST /uploadExternalSourceEventTypes: ${errorMsg}`,
    );
    res.status(500).send({
      message: errorMsg,
    });
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
        externalSourceType: source_type_name,
      },
    }),
    headers,
    method: 'POST',
  });

  const attributeSchemaJson = await attributeSchemas.json();
  const { external_event_type, external_source_type } =
    attributeSchemaJson.data as GetSourceEventTypeAttributeSchemasResponse;

  if (external_event_type.length === 0 || external_source_type.length === 0) {
    const errorMsg = 'The source and/or event types in your source do not exist in the database.';
    logger.error(
      `POST /uploadExternalSourceEventTypes: ${errorMsg}`,
    );
    res.status(500).send({ message: errorMsg });
    return;
  }

  const eventTypeNamesMappedToSchemas = external_event_type.reduce(
    (acc: Record<string, AttributeSchema>, eventType: ExternalEventTypeInsertInput) => {
      acc[eventType.name] = eventType.attribute_schema;
      return acc;
    },
    {},
  );
  const sourceTypeNamesMappedToSchemas = external_source_type.reduce(
    (acc: Record<string, AttributeSchema>, sourceType: ExternalSourceTypeInsertInput) => {
      acc[sourceType.name] = sourceType.attribute_schema;
      return acc;
    },
    {},
  );

  // Assemble megaschema from attribute schemas
  const compiledExternalSourceMegaschema: Ajv.ValidateFunction = updateSchemaWithDefs({
    event_types: eventTypeNamesMappedToSchemas,
    source_type: sourceTypeNamesMappedToSchemas,
  });

  // Verify that this is a valid external source
  const sourceIsValid: boolean = await compiledExternalSourceMegaschema(externalSourceJson);
  if (sourceIsValid) {
    logger.info(`POST /uploadExternalSource: External Source ${key}'s formatting is valid`);
  } else {
    const errorMsg = `External Source ${key}'s formatting is invalid:\n${JSON.stringify(compiledExternalSourceMegaschema.errors)}`
    logger.error(`POST /uploadExternalSource: ${errorMsg}`);
    res.status(500).send({ message: errorMsg });
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

  const createExternalSourceResponse = await response.json();
  if (createExternalSourceResponse?.data !== undefined) {
    res.json(createExternalSourceResponse.data as CreateExternalSourceResponse);
  } else {
    res.json(createExternalSourceResponse as HasuraError);
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
   *               - source_types
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
  app.post('/uploadExternalSourceEventTypes', upload.any(), refreshLimiter, auth, uploadExternalSourceEventTypes);

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
   *               events:
   *                 description: A list of External Events to be uploaded that are contained within the External Source.
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     attributes:
   *                       type: object
   *                     duration:
   *                       type: string
   *                     event_type_name:
   *                       type: string
   *                     key:
   *                       type: string
   *                     start_time:
   *                       type: string
   *                   required:
   *                     - attributes
   *                     - duration
   *                     - event_type_name
   *                     - key
   *                     - start_time
   *               source:
   *                 description: An object representing the External Source to be uploaded.
   *                 type: object
   *                 properties:
   *                   attributes:
   *                     type: object
   *                   derivation_group_name:
   *                     type: string
   *                   key:
   *                     type: string
   *                   period:
   *                     type: object
   *                     properties:
   *                       end_time:
   *                         type: string
   *                       start_time:
   *                         type: string
   *                     required:
   *                       - end_time
   *                         start_time
   *                   source_type_name:
   *                     type: string
   *                   valid_at:
   *                     type: string
   *                 required:
   *                   - attributes
   *                   - derivation_group_name
   *                   - key
   *                   - period
   *                   - source_type_name
   *                   - valid_at
   *             required:
   *               - events
   *               - source
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
