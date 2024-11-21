import type { Express, Request, Response } from 'express';
import type {
  CreateExternalEventTypeResponse,
  ExternalEventTypeInsertInput,
  UploadAttributeJSON,
} from '../../types/external-event.js';
import Ajv from 'ajv';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import gql from './gql.js';
import { HasuraError } from '../../types/hasura.js';
import { auth } from '../auth/middleware.js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { parseJSONFile } from '../../util/fileParser.js';

const upload = multer();
const logger = getLogger('packages/external-event/external-event');
const { RATE_LIMITER_LOGIN_MAX, HASURA_API_URL } = getEnv();
const GQL_API_URL = `${HASURA_API_URL}/v1/graphql`;
const ajv = new Ajv();
const refreshLimiter = rateLimit({
  legacyHeaders: false,
  max: RATE_LIMITER_LOGIN_MAX,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

async function uploadExternalEventType(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { body, file } = req;
  const { external_event_type_name } = body;
  logger.info(`POST /uploadExternalEventType: Uploading External Event Type: ${external_event_type_name}`);

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  const uploadedExternalEventTypeAttributeSchema = await parseJSONFile<UploadAttributeJSON>(file);

  // Validate schema is valid JSON Schema
  const schemaIsValid: boolean = ajv.validateSchema(uploadedExternalEventTypeAttributeSchema);
  if (!schemaIsValid) {
    logger.error(
      `POST /uploadExternalEventType: Schema validation failed for External Event Type ${external_event_type_name}`,
    );
    ajv.errors?.forEach(ajvError => logger.error(ajvError));
    res.status(500).send({ message: ajv.errors });
    return;
  }

  // Make sure name in schema (title) and provided name match
  if (
    uploadedExternalEventTypeAttributeSchema['title'] === undefined ||
    uploadedExternalEventTypeAttributeSchema['title'] !== external_event_type_name
  ) {
    const errorMsg = 'Schema title does not match provided external event type name.';
    logger.error(
      `POST /uploadExternalEventType: Error occurred during External Event Type ${external_event_type_name} upload`,
    );
    logger.error(errorMsg);
    res.status(500).send({ message: errorMsg });
    return;
  }

  logger.info(`POST /uploadExternalEventType: Attribute schema is VALID`);

  // Run the Hasura migration for creating an external event
  const externalEventTypeInsertInput: ExternalEventTypeInsertInput = {
    attribute_schema: uploadedExternalEventTypeAttributeSchema,
    name: external_event_type_name,
  };

  const response = await fetch(GQL_API_URL, {
    body: JSON.stringify({
      query: gql.CREATE_EXTERNAL_EVENT_TYPE,
      variables: { eventType: externalEventTypeInsertInput },
    }),
    headers,
    method: 'POST',
  });

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
  app.post(
    '/uploadExternalEventType',
    upload.single('attribute_schema'),
    refreshLimiter,
    auth,
    uploadExternalEventType,
  );
};
