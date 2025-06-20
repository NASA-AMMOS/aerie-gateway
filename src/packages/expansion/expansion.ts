import type { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import getLogger from '../../logger.js';
import { auth } from '../auth/middleware.js';
import { getEnv } from '../../env.js';
import {
  ImportSequenceTemplatePayload,
  SequenceTemplateInsertInput,
  SequenceTemplateSchema,
} from '../../types/expansion.js';
import gql from './gql.js';

const logger = getLogger('packages/plan/plan');
const { RATE_LIMITER_LOGIN_MAX, HASURA_API_URL } = getEnv();

const GQL_API_URL = `${HASURA_API_URL}/v1/graphql`;

const refreshLimiter = rateLimit({
  legacyHeaders: false,
  max: RATE_LIMITER_LOGIN_MAX,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

async function importSequenceTemplate(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { activity_type, language, model_id, name, parcel_id, sequence_template_file } =
    req.body as ImportSequenceTemplatePayload;

  logger.info(`POST /importSequenceTemplate: Importing sequence template: ${name}`);

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  let createdSequenceTemplate: SequenceTemplateSchema | null = null;

  try {
    logger.info(`POST /importSequenceTemplate: Creating sequence template: ${name}`);

    const sequenceTemplateInsertInput: SequenceTemplateInsertInput = {
      activity_type,
      language,
      model_id,
      name,
      parcel_id,
      template_definition: sequence_template_file,
    };

    // TODO: Add multi-import
    const sequenceTemplateCreationResponse = await fetch(GQL_API_URL, {
      body: JSON.stringify({
        query: gql.CREATE_SEQUENCE_TEMPLATE,
        variables: { sequenceTemplateInsertInput: [sequenceTemplateInsertInput] },
      }),
      headers,
      method: 'POST',
    });

    const responseJSON = await sequenceTemplateCreationResponse.json();

    if (responseJSON && responseJSON?.errors && responseJSON.errors.length) {
      const [error] = responseJSON.errors;
      throw new Error(error?.message ?? JSON.stringify(error));
    } else if (responseJSON !== null && responseJSON.data !== null) {
      createdSequenceTemplate = responseJSON.data?.insert_sequence_template;
      logger.info(`POST /importSequenceTemplate: Imported sequence template: ${name}`);
    } else {
      throw Error('Sequence template creation unsuccessful.');
    }
    res.json(createdSequenceTemplate);
  } catch (error: any) {
    logger.error(`POST /importSequenceTemplate: Error occurred during sequence template ${name} import`);
    logger.error(error);
    res.status(500).json({ message: error.message, success: false });
  }
}

export default (app: Express) => {
  /**
   * @swagger
   * /importSequenceTemplate:
   *   post:
   *     security:
   *       - bearerAuth: []
   *     consumes:
   *       - application/json
   *     produces:
   *       - application/json
   *     parameters:
   *      - in: header
   *        name: x-hasura-role
   *        schema:
   *          type: string
   *          required: false
   *     requestBody:
   *       content:
   *         application/json:
   *          schema:
   *            type: object
   *            properties:
   *              sequence_template_file:
   *                type: string
   *              activity_type:
   *                type: string
   *              language:
   *                type: string
   *              model_id:
   *                type: integer
   *              name:
   *                type: string
   *              parcel_id:
   *                type: integer
   *     responses:
   *       200:
   *         description: ImportResponse
   *       403:
   *         description: Unauthorized error
   *       401:
   *         description: Unauthenticated error
   *     summary: Import a sequence template
   *     tags:
   *       - Hasura
   */
  app.post('/importSequenceTemplate', refreshLimiter, auth, importSequenceTemplate);
};
