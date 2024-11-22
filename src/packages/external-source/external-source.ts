import type { Express, Request, Response } from 'express';
import type {
  DerivationGroupInsertInput,
  ExternalSourceInsertInput,
  ExternalSourceTypeInsertInput,
  CreateExternalSourceResponse,
  CreateExternalSourceTypeResponse,
  GetExternalSourceTypeAttributeSchemaResponse,
  GetExternalEventTypeAttributeSchemaResponse,
  UploadExternalSourceJSON,
  UploadAttributeJSON,
  ExternalEventTypeInsertInput,
  ExternalEventInsertInput,
  ExternalEventJson,
  ExternalEvent,
} from '../../types/external-source.js';
import Ajv from 'ajv';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import gql from './gql.js';
import { attributeSchemaMetaschema, externalSourceSchema } from '../schemas/external-event-validation-schemata.js';
import { HasuraError } from '../../types/hasura.js';
import { auth } from '../auth/middleware.js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { parseJSONFile } from '../../util/fileParser.js';
import { convertDoyToYmd } from '../../util/time.js';

const upload = multer({ limits: { fieldSize: 25 * 1024 * 1024 } });
const logger = getLogger('packages/external-source/external-source');
const { RATE_LIMITER_LOGIN_MAX, HASURA_API_URL } = getEnv();
const GQL_API_URL = `${HASURA_API_URL}/v1/graphql`;
const ajv = new Ajv();
const compiledAttributeMetaschema = ajv.compile(attributeSchemaMetaschema);
const compiledExternalSourceSchema = ajv.compile(externalSourceSchema);
const refreshLimiter = rateLimit({
  legacyHeaders: false,
  max: RATE_LIMITER_LOGIN_MAX,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

async function uploadExternalSourceEventTypes(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { file } = req;
  logger.info(`POST /uploadExternalSourceEventTypes: Uploading External Source and Event Types...`);

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': 'aerie',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  const uploadedExternalSourceEventTypeAttributeSchema = await parseJSONFile<UploadAttributeJSON>(file);

  // Validate uploaded attribute schemas are formatted validly
  const schemasAreValid: boolean = await compiledAttributeMetaschema(uploadedExternalSourceEventTypeAttributeSchema);
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

  const external_event_types = uploadedExternalSourceEventTypeAttributeSchema.event_types;
  const event_type_keys = Object.keys(external_event_types);
  for (const external_event_type of event_type_keys) {
    externalSourceTypeInput.push({
      attribute_schema: external_event_types[external_event_type],
      name: external_event_type
    })
  }

  const external_source_types = uploadedExternalSourceEventTypeAttributeSchema.source_types;
  const source_type_keys = Object.keys(external_source_types);
  for (const external_source_type of source_type_keys) {
    externalEventTypeInput.push({
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
  const { source, external_events } = body;
  const { attributes, derivation_group_name, key, end_time, start_time, source_type_name, valid_at } = source;
  const parsedAttributes = JSON.parse(attributes);
  const parsedExternalEvents: ExternalEvent[] = JSON.parse(external_events);

  // Re-package the fields as a JSON object to be validated by the meta-schema
  const externalSourceJson = {
    external_events: parsedExternalEvents,
    source: {
      attributes: parsedAttributes,
      derivation_group_name: derivation_group_name,
      key: key,
      period: {
        end_time: end_time,
        start_time: start_time,
      },
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

  // TODO: assemble megaschema from attribute schemas
  console.log(attributeSchemaJson);

  return;


  // Verify that this is a valid external source
  let sourceIsValid: boolean = false;
  sourceIsValid = await compiledExternalSourceSchema(body);
  if (sourceIsValid) {
    logger.info(`POST /uploadExternalSource: External Source ${key}'s formatting is valid`);
  } else {
    logger.error(`POST /uploadExternalSource: External Source ${key}'s formatting is invalid:\n${JSON.stringify(compiledExternalSourceSchema.errors)}`);
    res.status(500).send({ message: `External Source ${key}'s formatting is invalid:\n${JSON.stringify(compiledExternalSourceSchema.errors)}` });
    return;
  }

  const usedExternalEventTypes = parsedExternalEvents.reduce((acc: string[], externalEvent: ExternalEventInsertInput) => {
    if (!acc.includes(externalEvent.event_type_name)) {
      acc.push(externalEvent.event_type_name);
    }
    return acc;
  }, []);

  const usedExternalEventTypesAttributesSchemas: Record<string, Ajv.ValidateFunction> = {};
  for (const eventType of usedExternalEventTypes) {
    const eventAttributeSchema = await fetch(GQL_API_URL, {
      body: JSON.stringify({
        query: gql.GET_EXTERNAL_EVENT_TYPE_ATTRIBUTE_SCHEMA,
        variables: {
          name: eventType,
        },
      }),
      headers,
      method: 'POST',
    });
    const eventTypeJSONResponse = await eventAttributeSchema.json();
    const getExternalEventTypeAttributeSchemaResponse = eventTypeJSONResponse.data as
      | GetExternalEventTypeAttributeSchemaResponse
      | HasuraError;
    if (
      (getExternalEventTypeAttributeSchemaResponse as GetExternalEventTypeAttributeSchemaResponse)
        .external_event_type_by_pk?.attribute_schema !== null
    ) {
      const { external_event_type_by_pk: eventAttributeSchema } =
        getExternalEventTypeAttributeSchemaResponse as GetExternalEventTypeAttributeSchemaResponse;
      if (eventAttributeSchema !== undefined && eventAttributeSchema !== null) {
        usedExternalEventTypesAttributesSchemas[eventType] = ajv.compile(eventAttributeSchema.attribute_schema);
      }
    }
  }

  // Validate attributes of all External Events in the source
  for (const externalEvent of parsedExternalEvents) {
    try {
      const currentEventType = externalEvent.event_type_name;
      const currentEventSchema: Ajv.ValidateFunction = usedExternalEventTypesAttributesSchemas[currentEventType];
      const eventAttributesAreValid = await currentEventSchema(externalEvent.attributes);
      if (!eventAttributesAreValid) {
        throw new Error(
          `External Event '${externalEvent.key
          }' does not have a valid set of attributes, per it's type's schema:\n${JSON.stringify(
            currentEventSchema.errors,
          )}`,
        );
      }
    } catch (error) {
      logger.error(`POST /uploadExternalSource: External Event ${externalEvent.key}'s attributes are invalid`);
      res.status(500).send({ message: (error as Error).message });
      return;
    }
  }

  // Run the Hasura migration for creating an external source
  const derivationGroupInsert: DerivationGroupInsertInput = {
    name: derivation_group_name,
    source_type_name: source_type_name,
  };

  const externalSourceInsert: ExternalSourceInsertInput = {
    attributes: parsedAttributes,
    derivation_group_name: derivation_group_name,
    end_time: end_time,
    external_events: {
      data: parsedExternalEvents,
    },
    key: key,
    source_type_name: source_type_name,
    start_time: start_time,
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
   *               external_events:
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
   *                 external_events
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
