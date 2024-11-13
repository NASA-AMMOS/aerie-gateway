import type { Express, Request, Response } from 'express';
import type { DerivationGroupInsertInput, ExternalSourceInsertInput, ExternalSourceTypeInsertInput } from '../../types/external-source.js';
import type { ExternalEvent, ExternalEventInsertInput } from '../../types/external-event.js';
import Ajv from 'ajv';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import gql from './gql.js';
//import { gql as externalEventGQL } from '../external-event/gql.js';
import { HasuraError } from '../../types/hasura.js';

type CreateExternalSourceResponse = { data: { createExternalSource: { name: string } | null } };
type CreateExternalSourceTypeResponse = { data: { createExternalSourceType: { attribute_schema: object, name: string } | null } };
type ExistingTypesResponse = { data: {existingEventTypes: { name: string }[]}};
type AssociatedTypesResponse = { data: {existingEventTypes: { external_event_type: string }[]}};
type GetExternalSourceTypeAttributeSchemaResponse = { data: { external_source_type_by_pk: { attribute_schema: object } | null } };
type GetExternalEventTypeAttributeSchemaResponse = { data: { external_event_type_by_pk: { attribute_schema: object } | null } };

const logger = getLogger('packages/external-source/external-source');
const { HASURA_API_URL } = getEnv();
const GQL_API_URL = `${HASURA_API_URL}/v1/graphql`;
const ajv = new Ajv();

async function uploadExternalSourceType(req: Request, res: Response) {
  logger.info(`POST /uploadExternalSourceType: Entering function...`);
  const authorizationHeader = req.get('authorization');

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { body } = req;
  const { external_source_type_name, attribute_schema, allowed_event_types } = body;

  const allowed_event_types_parsed = allowed_event_types as string[];

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': 'aerie',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  // Validate schema is valid JSON Schema
  try {
    const schemaIsValid: boolean = ajv.validateSchema(attribute_schema);
    if (!schemaIsValid) {
      throw new Error("Schema was not a valid JSON Schema.");
    }
  } catch (e) {
    logger.error(`POST /uploadExternalSourceType: ${(e as Error).message}`);
    res.status(500);
    res.send((e as Error).message);
    return;
  }

  logger.info(`POST /uploadExternalSourceType: Attribute schema was VALID!`);

  // TODO: Check the list of allowed event types are all defined
  // QUESTION: only do this check in the UI? The database ultimately checks these things.
  const existingTypesResponse = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.GET_EXTERNAL_EVENT_TYPES,
      variables: {}
    }),
    headers,
    method: 'POST'
  });
  const existingTypesStruct: ExistingTypesResponse = await existingTypesResponse.json();
  const existingTypes: string[] = existingTypesStruct.data.existingEventTypes.map(entry => entry.name);
  for (const event_type of allowed_event_types_parsed) {
    if (!existingTypes.includes(event_type)) {
      logger.error(`POST /uploadExternalSourceType: Event type ${event_type} is not defined.`);
      res.status(500);
      res.send(`POST /uploadExternalSourceType: Event type ${event_type} is not defined.`);
      return;
    }
  }

  logger.info(`POST /uploadExternalSourceType: Successfully checked event types valid! Calling Hasura mutation...`);
  
  // Run the Hasura migration for creating an external source type (and inserting allowed event types)
  const externalSourceTypeInput: ExternalSourceTypeInsertInput = {
    attribute_schema: attribute_schema,
    name: external_source_type_name,
  }

  const allowedTypes: { external_event_type: string, external_source_type: string }[] = allowed_event_types_parsed.map(external_event_type => {
    return { external_event_type, external_source_type: external_source_type_name };
  })


  const response = await fetch(GQL_API_URL, { // TODO: update
    body: JSON.stringify({
      query: gql.CREATE_EXTERNAL_SOURCE_TYPE,
      variables: { allowedTypes, sourceType: externalSourceTypeInput },
    }),
    headers,
    method: 'POST',
  });

  const jsonResponse = await response.json();
  const createExternalSourceTypeResponse = jsonResponse as CreateExternalSourceTypeResponse | HasuraError;

  logger.info(`POST /uploadExternalSourceType: Successfully uploaded new type and event type associations!`);

  res.json(createExternalSourceTypeResponse);
}

async function uploadExternalSource(req: Request, res: Response) {
  logger.info(`POST /uploadExternalSource: Entering function...`);
  const authorizationHeader = req.get('authorization');
  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;
  const { body } = req;
  const {
    attributes,
    derivation_group_name,
    end_time,
    external_events,
    key,
    source_type_name,
    start_time,
    valid_at
  } = body;
  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': 'aerie', // HACK, TODO: FIX
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

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
  const sourceTypeResponseJSON  = await sourceAttributeSchema.json();
  const getExternalSourceTypeAttributeSchemaResponse = sourceTypeResponseJSON as GetExternalSourceTypeAttributeSchemaResponse | HasuraError;
  if ((getExternalSourceTypeAttributeSchemaResponse as GetExternalSourceTypeAttributeSchemaResponse).data?.external_source_type_by_pk?.attribute_schema !== null) {
    const { data: { external_source_type_by_pk: sourceAttributeSchema } } = getExternalSourceTypeAttributeSchemaResponse as GetExternalSourceTypeAttributeSchemaResponse;
    if (sourceAttributeSchema !== undefined && sourceAttributeSchema !== null) {
      const sourceSchema = ajv.compile(sourceAttributeSchema.attribute_schema);
      sourceAttributesAreValid = await sourceSchema(attributes);
    }
  }
  if (sourceAttributesAreValid) {
    logger.info(`POST /uploadExternalSource: Source's attributes are valid`);
  } else {
    logger.error(`POST /uploadExternalSource: Source's attributes are invalid`);
  }

  // TODO: verify events are all of allowed type
  // get list of all used event types
  const usedExternalEventTypes = external_events.data.map((externalEvent: ExternalEventInsertInput) => externalEvent.event_type_name).reduce(
    (acc: string[], externalEventType: string) => {
      if (!acc.includes(externalEventType)) {
        acc.push(externalEventType)
      };
      return acc;
    }, []);

  // get allowed event types
  const allowedExternalEventTypes = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.GET_EXTERNAL_EVENT_TYPES_FOR_SOURCE_TYPE,
      variables: { sourceType: source_type_name }
    }),
    headers,
    method: 'POST'
  });

  // check
  const allowedEventTypesStruct: AssociatedTypesResponse = await allowedExternalEventTypes.json();
  const allowedEventTypes = allowedEventTypesStruct.data.existingEventTypes.map(eventType => eventType.external_event_type);

  for (const event_type of usedExternalEventTypes) {
    if (!allowedEventTypes.includes(event_type)) {
      logger.error(`POST /uploadExternalSourceType: An event uses event type ${event_type}, which is not defined for source type ${source_type_name}.`);
      res.status(500);
      res.send(`POST /uploadExternalSourceType: An event uses event type ${event_type}, which is not defined for source type ${source_type_name}.`);
      return;
    }
  }

  logger.info(`POST /uploadExternalSource: Source's included events' types are valid.`);

  // Get the attribute schema(s) for all external event types used by the source's events
  const usedExternalEventTypesAttributesSchemas = await usedExternalEventTypes.reduce(async (acc: Record<string, Ajv.ValidateFunction>, eventType: string) => {
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
      console.log(getExternalEventTypeAttributeSchemaResponse);
      const { data: { external_event_type_by_pk: eventAttributeSchema } } = getExternalEventTypeAttributeSchemaResponse as GetExternalEventTypeAttributeSchemaResponse;
      if (eventAttributeSchema !== undefined && eventAttributeSchema !== null) {
        acc[eventType] = ajv.compile(eventAttributeSchema);
      }
    }

    return acc;
  }, {} as Record<string, Ajv.ValidateFunction>)

  // Validate all the event's attributes
  try {
    external_events.data.forEach(async (externalEvent: ExternalEvent) => {
      const currentEventType = externalEvent.event_type_name;
      const currentEventSchema = usedExternalEventTypesAttributesSchemas[currentEventType];
      const eventAttributesAreValid = await currentEventSchema(externalEvent.attributes);
      if (!eventAttributesAreValid) {
        throw new Error(`External Event '${externalEvent.key}' does not have a valid set of attributes, per it's type's schema.`);
      }
    });
  } catch (e) {
    logger.error(`POST /uploadExternalSource: ${(e as Error).message}`);
    res.status(500);
    res.send((e as Error).message);
    return;
  }

  console.log("VALID!");

  // Run the Hasura migration for creating an external source
  const derivationGroupInsert: DerivationGroupInsertInput = {
    name: derivation_group_name,
    source_type_name: source_type_name
  }

  const externalSourceInsert: ExternalSourceInsertInput = {
    attributes: attributes,
    derivation_group_name: derivation_group_name,
    end_time: end_time,
    external_events: external_events,
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
  console.log(jsonResponse);
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
