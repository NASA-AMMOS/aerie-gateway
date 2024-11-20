import type { Express, Request, Response } from 'express';
import type { DerivationGroupInsertInput, ExternalSourceInsertInput, ExternalSourceTypeInsertInput } from '../../types/external-source.js';
import type { ExternalEventInsertInput } from '../../types/external-event.js';
import Ajv from 'ajv';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import gql from './gql.js';
import { externalSourceSchema } from '../schemas/external-event-validation-schemata.js';
import { HasuraError } from '../../types/hasura.js';

type CreateExternalSourceResponse = { data: { createExternalSource: { name: string } | null } };
type CreateExternalSourceTypeResponse = { data: { createExternalSourceType: { attribute_schema: object, name: string } | null } };
type GetExternalSourceTypeAttributeSchemaResponse = { data: { external_source_type_by_pk: { attribute_schema: object } | null } };
type GetExternalEventTypeAttributeSchemaResponse = { data: { external_event_type_by_pk: { attribute_schema: object } | null } };

const logger = getLogger('packages/external-source/external-source');
const { HASURA_API_URL } = getEnv();
const GQL_API_URL = `${HASURA_API_URL}/v1/graphql`;
const ajv = new Ajv();
const compiledExternalSourceSchema = ajv.compile(externalSourceSchema);

async function uploadExternalSourceType(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { body } = req;
  const { external_source_type_name, attribute_schema } = body;
  logger.info(`POST /uploadExternalSourceType: Uploading External Source Type: ${external_source_type_name}`);


  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': 'aerie',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  // Validate schema is valid JSON Schema
  // NOTE: this does not check that all required attributes are included. technically, you could upload a schema for an event type,
  //        and only really get punished for it when validating a source.
  try {
    const schemaIsValid: boolean = ajv.validateSchema(attribute_schema);
    if (!schemaIsValid) {
      throw new Error("Schema was not a valid JSON Schema.");
    }
  } catch (error) {
    res.status(500).send({ message: (error as Error).message });
    return;
  }

  logger.info(`POST /uploadExternalSourceType: ${external_source_type_name} attribute schema was VALID`);

  // Make sure name in schema (title) and provided name match
  try {
    if (attribute_schema["title"] === undefined || attribute_schema.title !== external_source_type_name) {
      throw new Error(`${external_source_type_name} attribute schema title does not match provided external source type name.`)
    }
  } catch (error) {
    res.status(500).send({ message: (error as Error).message });
    return;
  }

  // Run the Hasura migration for creating an external source type (and inserting allowed event types)
  const externalSourceTypeInput: ExternalSourceTypeInsertInput = {
    attribute_schema: attribute_schema,
    name: external_source_type_name,
  }

  const response = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.CREATE_EXTERNAL_SOURCE_TYPE,
      variables: { sourceType: externalSourceTypeInput },
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
  const {
    external_events,
    source
  } = body;
  const {
    attributes,
    derivation_group_name,
    key,
    source_type_name,
    period,
    valid_at
  } = source;
  const {
    end_time,
    start_time
  } = period;
  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  logger.info(`POST /uploadExternalSource: Uploading External Source: ${key}`)

  // Verify that this is a valid external source!
  let sourceIsValid: boolean = false;
  sourceIsValid = await compiledExternalSourceSchema(body);
  if (sourceIsValid) {
    logger.info(`POST /uploadExternalSource: External Source ${key}'s formatting is valid`);
  } else {
    logger.error(`POST /uploadExternalSource: External Source ${key}'s formatting is invalid`);
    res.status(500).send({ message: `External Source ${key}'s formatting is invalid` });
    return;
  }

  // Get the attribute schema for the source's external source type
  const sourceAttributeSchema = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.GET_EXTERNAL_SOURCE_TYPE_ATTRIBUTE_SCHEMA,
      variables: {
        name: source_type_name
      }
    }),
    headers,
    method: 'POST'
  });

  // Validate the attributes on the External Source
  let sourceAttributesAreValid: boolean = false;
  let sourceSchema: Ajv.ValidateFunction | undefined = undefined;
  const sourceTypeResponseJSON  = await sourceAttributeSchema.json();
  const getExternalSourceTypeAttributeSchemaResponse = sourceTypeResponseJSON as GetExternalSourceTypeAttributeSchemaResponse | HasuraError;
  if ((getExternalSourceTypeAttributeSchemaResponse as GetExternalSourceTypeAttributeSchemaResponse).data?.external_source_type_by_pk?.attribute_schema !== null) {
    const { data: { external_source_type_by_pk: sourceAttributeSchema } } = getExternalSourceTypeAttributeSchemaResponse as GetExternalSourceTypeAttributeSchemaResponse;
    if (sourceAttributeSchema !== undefined && sourceAttributeSchema !== null) {
      sourceSchema = ajv.compile(sourceAttributeSchema.attribute_schema);
      sourceAttributesAreValid = await sourceSchema(attributes);
    }
    else {
      // source type does not exist!
      logger.error(`POST /uploadExternalSource: External Source Type ${source_type_name} does not exist!`);
      res.status(500).send({ message: `External Source Type ${source_type_name} does not exist!`});
      return;
    }
  }

  if (sourceAttributesAreValid) {
    logger.info(`POST /uploadExternalSource: External Source ${key}'s attributes are valid`);
  } else {
    logger.error(`POST /uploadExternalSource: External Source ${key}'s attributes are invalid`);
    res.status(500);
    if (sourceSchema !== undefined) {
      res.send({ message: `External Source ${key}'s attributes are invalid:\n${JSON.stringify(sourceSchema.errors)}` });
    } else {
      res.send({ message: `External Source ${key}'s attributes are invalid` });
    }
    return;
  }

  // Get the attribute schema(s) for all external event types used by the source's events
  // get list of all used event types
  const usedExternalEventTypes = external_events.map((externalEvent: ExternalEventInsertInput) => externalEvent.event_type_name).reduce(
    (acc: string[], externalEventType: string) => {
      if (!acc.includes(externalEventType)) {
        acc.push(externalEventType)
      };
      return acc;
    }, []);

  const usedExternalEventTypesAttributesSchemas: Record<string, Ajv.ValidateFunction> = {};
  for (const eventType of usedExternalEventTypes) {
    const eventAttributeSchema = await fetch(GQL_API_URL, {
      body: JSON.stringify({
        query: gql.GET_EXTERNAL_EVENT_TYPE_ATTRIBUTE_SCHEMA,
        variables: {
          name: eventType
        }
      }),
      headers,
      method: 'POST'
    });
    const eventTypeJSONResponse  = await eventAttributeSchema.json();
    const getExternalEventTypeAttributeSchemaResponse = eventTypeJSONResponse as GetExternalEventTypeAttributeSchemaResponse | HasuraError;

    if ((getExternalEventTypeAttributeSchemaResponse as GetExternalEventTypeAttributeSchemaResponse).data?.external_event_type_by_pk?.attribute_schema !== null) {
      const { data: { external_event_type_by_pk: eventAttributeSchema } } = getExternalEventTypeAttributeSchemaResponse as GetExternalEventTypeAttributeSchemaResponse;
      if (eventAttributeSchema !== undefined && eventAttributeSchema !== null) {
        usedExternalEventTypesAttributesSchemas[eventType] = ajv.compile(eventAttributeSchema.attribute_schema);
      }
    }
  }

  for (const externalEvent of external_events) {
    try {
      const currentEventType = externalEvent.event_type_name;
      const currentEventSchema: Ajv.ValidateFunction  = usedExternalEventTypesAttributesSchemas[currentEventType];
      const eventAttributesAreValid = await currentEventSchema(externalEvent.attributes);
      if (!eventAttributesAreValid) {
        throw new Error(`External Event '${externalEvent.key}' does not have a valid set of attributes, per it's type's schema:\n${JSON.stringify(currentEventSchema.errors)}`);
      }
    } catch (error) {
      res.status(500).send({ message: (error as Error).message });
      return;
    }
  }

  // Run the Hasura migration for creating an external source
  const derivationGroupInsert: DerivationGroupInsertInput = {
    name: derivation_group_name,
    source_type_name: source_type_name
  }

  const externalSourceInsert: ExternalSourceInsertInput = {
    attributes: attributes,
    derivation_group_name: derivation_group_name,
    end_time: end_time,
    external_events: {
      data: external_events
    },
    key: key,
    source_type_name: source_type_name,
    start_time: start_time,
    valid_at: valid_at
  }

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
   * /uploadExternalSourceType:
   *   post:
   *     security:
   *       - bearerAuth: []
   *     consumes:
   *       - application/json
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
   *         application/json:
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
  app.post('/uploadExternalSourceType', uploadExternalSourceType);

  /**
   * @swagger
   * /uploadExternalSource:
   *   post:
   *     security:
   *       - bearerAuth: []
   *     consumes:
   *       - application/json
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
   *         application/json:
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
   *                  name:
   *                    description: Name of the created External Source
   *                    type: string
   *       403:
   *         description: Unauthorized error
   *       401:
   *         description: Unauthenticated error
   *     summary: Uploads an External Source to Hasura.
   *     tags:
   *       - Hasura
   */
  app.post('/uploadExternalSource', uploadExternalSource);
};
