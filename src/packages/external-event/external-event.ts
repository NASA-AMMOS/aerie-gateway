import type { Express, Request, Response } from 'express';
import type { ExternalEventTypeInsertInput } from '../../types/external-event.js';
import Ajv from 'ajv';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import gql from './gql.js';
import { HasuraError } from '../../types/hasura.js';

const logger = getLogger('packages/external-event/external-event');
const { HASURA_API_URL } = getEnv();
const GQL_API_URL = `${HASURA_API_URL}/v1/graphql`;

const ajv = new Ajv();

async function uploadExternalEventType(req: Request, res: Response) {
  logger.info(`POST /uploadExternalEventType: Entering function...`);
  const authorizationHeader = req.get('authorization');
  logger.info(`POST /uploadExternalEventType: ${authorizationHeader}`);

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { body } = req;
  const { external_event_type_name, attribute_schema } = body;

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
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
    logger.error(`POST /uploadExternalEventType: ${(e as Error).message}`);
    res.json({ created: false });
    return;
  }

  logger.info(`POST /uploadExternalEventType: Attribute schema was VALID! Calling Hasura mutation...`);

  // Run the Hasura migration for creating an external event
  const externalEventTypeInsertInput: ExternalEventTypeInsertInput = {
    attribute_schema: attribute_schema,
    name: external_event_type_name,
  }


  const response = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.CREATE_EXTERNAL_EVENT_TYPE,
      variables: { eventType: externalEventTypeInsertInput },
    }),
    headers,
    method: 'POST',
  });

  type CreateExternalEventTypeResponse = { data: { createExternalEventType: { attribute_schema: object, name: string } | null } };
  const jsonResponse = await response.json();
  const createExternalEventTypeResponse = jsonResponse as CreateExternalEventTypeResponse | HasuraError;

  res.json(createExternalEventTypeResponse);
}

export default (app: Express) => {
  /**
   * @swagger
   * /uploadExternalEventType:
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
   *               external_event_type_name:
   *                 type: string
   *             required:
   *               - external_event_type_name
   *                 attribute_schema
   *     responses:
   *       200:
   *         description: Created External Event Type
   *         content:
   *           application/json:
   *             schema:
   *                properties:
   *                  attribute_schema:
   *                    description: JSON Schema for the created External Event Type's attributes
   *                    type: object
   *                  name:
   *                    description: Name of the created External Event Type
   *                    type: string
   *       403:
   *         description: Unauthorized error
   *       401:
   *         description: Unauthenticated error
   *     summary: Uploads an External Event Type definition (containing name & attributes schema) to Hasura.
   *     tags:
   *       - Hasura
   */
  app.post('/uploadExternalEventType', uploadExternalEventType);
};
