import type { Express, Request, Response } from 'express';
import type {
  DerivationGroupInsertInput,
  ExternalSourceTypeInsertInput,
  CreateExternalSourceResponse,
  CreateExternalSourceTypeResponse,
  ExternalEventTypeInsertInput,
  ExternalEvent,
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

function updateSchemaWithDefs(defs: { event_types: any, source_type: any }) {//: Ajv.ValidateFunction | undefined {
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
    const event_type_schema = defs.event_types[event_type_name];
    const source_type_name = Object.keys(defs.source_type)[0];
    const source_type_schema = defs.source_type[source_type_name];

    localSchemaCopy.properties.events.items.properties.attributes = event_type_schema;
    localSchemaCopy.properties.events.items.properties.event_type_name = { "const": event_type_name };

    // insert def for "source" attributes
    localSchemaCopy.properties.source.properties.attributes = source_type_schema;

    const localAjv = new Ajv();
    return localAjv.addSchema(defs).compile(localSchemaCopy);
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
      [sourceTypeKey]: defs.source_type[sourceTypeKey]
    }
  }
  for (const event_type of keys) {
    localSchemaCopy.$defs.event_types[event_type] = defs.event_types[event_type];
  }

  // compile with defs, return
  const localAjv = new Ajv();
  return localAjv.compile(localSchemaCopy);
}

async function uploadExternalSourceEventTypes(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { body } = req;
  logger.info(`POST /uploadExternalSourceEventTypes: Uploading External Source and Event Types...`);

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': 'aerie',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  // Validate uploaded attribute schemas are formatted validly
  const schemasAreValid: boolean = await compiledAttributeMetaschema(body);
  if (!schemasAreValid) {
    logger.error(
      `POST /uploadExternalSourceEventTypes: Schema validation failed for uploaded source and event types.`,
    );
    compiledAttributeMetaschema.errors?.forEach(error => logger.error(error));
    res.status(500).send({ message: compiledAttributeMetaschema.errors });
    return;
  }

  logger.info(`POST /uploadExternalSourceEventTypes: Uploaded attribute schema(s) are VALID`);

  // extract the external sources and event types
  const externalSourceTypeInput: ExternalSourceTypeInsertInput = [];
  const externalEventTypeInput: ExternalEventTypeInsertInput = [];

  const external_event_types = body.event_types;
  const event_type_keys = Object.keys(external_event_types);
  for (const external_event_type of event_type_keys) {
    externalEventTypeInput.push({
      attribute_schema: external_event_types[external_event_type],
      name: external_event_type
    })
  }

  const external_source_types = body.source_types;
  const source_type_keys = Object.keys(external_source_types);
  for (const external_source_type of source_type_keys) {
    externalSourceTypeInput.push({
      attribute_schema: external_source_types[external_source_type],
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
  const createExternalSourceTypeResponse = jsonResponse as CreateExternalSourceTypeResponse | HasuraError;

  res.json(createExternalSourceTypeResponse);
}

async function uploadExternalSource(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');
  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;
  const { body } = req;

  const { source, events } = body;
  const parsedSource = JSON.parse(source);
  const parsedExternalEvents: ExternalEvent[] = JSON.parse(events);
  const { attributes, derivation_group_name, key, period, source_type_name, valid_at } = parsedSource;

  // re-package the fields as a JSON object to be posted
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
  const { external_event_type, external_source_type } = attributeSchemaJson.data;

  const defs: { event_types: any, source_type: any } = {
    event_types: {

    },
    source_type: {
      [external_source_type[0].name]: external_source_type[0].attribute_schema
    }
  };

  for (const event_type of external_event_type) {
    defs.event_types[event_type.name] = event_type.attribute_schema
  }

  // Assemble megaschema from attribute schemas
  const compiledExternalSourceMegaschema: Ajv.ValidateFunction = updateSchemaWithDefs(defs);

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
  const createExternalSourceResponse = jsonResponse as CreateExternalSourceResponse | HasuraError;

  res.json(createExternalSourceResponse);
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
   *               attribute_schema:
   *                 type: object
   *               external_source_type_name:
   *                 type: string
   *             required:
   *               - external_source_type_name
   *                 attribute_schema
   *     responses:
   *       200:
   *         description: Created External Source Type
   *         content:
   *           application/json:
   *             schema:
   *                properties:
   *                  attribute_schema:
   *                    description: JSON Schema for the created External Source Type's attributes
   *                    type: object
   *                  name:
   *                    description: Name of the created External Source Type
   *                    type: string
   *       403:
   *         description: Unauthorized error
   *       401:
   *         description: Unauthenticated error
   *     summary: Uploads an External Source Type definition (containing name & attributes schema) to Hasura.
   *     tags:
   *       - Hasura
   */
  app.post(
    '/uploadExternalSourceEventTypes',
    upload.single('attribute_schema'),
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
