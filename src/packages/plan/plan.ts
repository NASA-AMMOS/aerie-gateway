import type { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { JSONParser } from '@streamparser/json';
import fetch from 'node-fetch';

import { auth } from '../auth/middleware.js';
import type {
  ActivityDirective,
  ActivityDirectiveInsertInput,
  ImportPlanPayload,
  PlanInsertInput,
  PlanSchema,
  PlanTagsInsertInput,
  PlanTransfer,
  Tag,
} from './types.js';
import gql from './gql.js';
import getLogger from '../../logger.js';
import { getEnv } from '../../env.js';

const upload = multer();
const logger = getLogger('packages/plan/plan');
const { RATE_LIMITER_LOGIN_MAX, HASURA_API_URL } = getEnv();

const GQL_API_URL = `${HASURA_API_URL}/v1/graphql`;

const refreshLimiter = rateLimit({
  legacyHeaders: false,
  max: RATE_LIMITER_LOGIN_MAX,
  standardHeaders: true,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export async function importPlan(req: Request, res: Response) {
  const authorizationHeader = req.get('authorization');

  const {
    headers: { 'x-hasura-role': roleHeader, 'x-hasura-user-id': userHeader },
  } = req;

  const { body, file } = req;
  const { name, model_id, start_time, duration, simulation_template_id, tags } = body as ImportPlanPayload;

  logger.info(`POST /importPlan: Importing plan: ${name}`);

  const headers: HeadersInit = {
    Authorization: authorizationHeader ?? '',
    'Content-Type': 'application/json',
    'x-hasura-role': roleHeader ? `${roleHeader}` : '',
    'x-hasura-user-id': userHeader ? `${userHeader}` : '',
  };

  let createdPlan: PlanSchema | null = null;
  let createdTags: Tag[] = [];

  try {
    const { activities, simulation_arguments }: PlanTransfer = await new Promise(resolve => {
      const jsonParser = new JSONParser({ paths: ['$.*'], stringBufferSize: undefined });
      let finalJSON: any;
      jsonParser.onToken = ({ value }) => {
        if (finalJSON === undefined) {
          if (value === '[') finalJSON = [];
          else if (value === '{') finalJSON = {};
        }
      };
      jsonParser.onValue = ({ parent }) => {
        finalJSON = parent;
      };
      jsonParser.onEnd = () => {
        resolve(finalJSON);
      };

      if (file?.buffer) {
        try {
          jsonParser.write(file.buffer);
        } catch (e) {
          console.error(e);
        }
      }
    });

    // create the new plan first
    logger.info(`POST /importPlan: Creating new plan: ${name}`);
    const planInsertInput: PlanInsertInput = {
      duration,
      model_id,
      name,
      start_time,
    };
    const planCreationResponse = await fetch(GQL_API_URL, {
      body: JSON.stringify({ query: gql.CREATE_PLAN, variables: { plan: planInsertInput } }),
      headers,
      method: 'POST',
    });

    const planCreationResponseJSON = (await planCreationResponse.json()) as {
      data: {
        createPlan: any;
      };
    };

    if (planCreationResponseJSON != null && planCreationResponseJSON.data != null) {
      createdPlan = planCreationResponseJSON.data.createPlan;

      if (createdPlan) {
        // associate specified simulation parameters to new plan
        logger.info(`POST /importPlan: Associating simulation parameters: ${name}`);
        const simulationInput = {
          arguments: simulation_arguments,
          simulation_template_id,
        };

        await fetch(GQL_API_URL, {
          body: JSON.stringify({
            query: gql.UPDATE_SIMULATION,
            variables: { plan_id: createdPlan.id, simulation: simulationInput },
          }),
          headers,
          method: 'POST',
        });

        // insert all the imported activities into the plan
        logger.info(`POST /importPlan: Importing activities: ${name}`);

        const activityTags = activities.reduce(
          (prevActivitiesTagsMap: Record<string, Pick<Tag, 'color' | 'name'>>, { tags }) => {
            const tagsMap =
              tags?.reduce((prevTagsMap: Record<string, Pick<Tag, 'color' | 'name'>>, { tag }) => {
                return {
                  ...prevTagsMap,
                  [tag.name]: {
                    color: tag.color,
                    name: tag.name,
                  },
                };
              }, {}) ?? {};

            return {
              ...prevActivitiesTagsMap,
              ...tagsMap,
            };
          },
          {},
        );

        const createdTagsResponse = await fetch(GQL_API_URL, {
          body: JSON.stringify({
            query: gql.CREATE_TAGS,
            variables: { tags: Object.values(activityTags) },
          }),
          headers,
          method: 'POST',
        });

        const { data } = (await createdTagsResponse.json()) as {
          data: {
            insert_tags: { returning: Tag[] };
          };
        };

        if (data && data.insert_tags && data.insert_tags.returning.length) {
          createdTags = data.insert_tags.returning;
        }

        const tagsResponse = await fetch(GQL_API_URL, {
          body: JSON.stringify({
            query: gql.GET_TAGS,
          }),
          headers,
          method: 'POST',
        });

        const tagsResponseJSON = (await tagsResponse.json()) as {
          data: {
            tags: Tag[];
          };
        };

        let tagsMap: Record<string, Tag> = {};
        if (tagsResponseJSON != null && tagsResponseJSON.data != null) {
          const {
            data: { tags },
          } = tagsResponseJSON;
          tagsMap = tags.reduce((prevTagsMap: Record<string, Tag>, tag) => {
            return {
              ...prevTagsMap,
              [tag.name]: tag,
            };
          }, {});
        }

        const activityRemap: Record<number, number> = {};
        const activityDirectivesInsertInput = activities.map(
          ({
            anchored_to_start: anchoredToStart,
            arguments: activityArguments,
            metadata,
            name: activityName,
            start_offset: startOffset,
            tags,
            type,
          }) => {
            const activityDirectiveInsertInput: ActivityDirectiveInsertInput = {
              anchor_id: null,
              anchored_to_start: anchoredToStart,
              arguments: activityArguments,
              metadata,
              name: activityName,
              plan_id: (createdPlan as PlanSchema).id,
              start_offset: startOffset,
              tags: {
                data:
                  tags?.map(({ tag: { name } }) => ({
                    tag_id: tagsMap[name].id,
                  })) ?? [],
              },
              type,
            };

            return activityDirectiveInsertInput;
          },
        );

        const createdActivitiesResponse = await fetch(GQL_API_URL, {
          body: JSON.stringify({
            query: gql.CREATE_ACTIVITY_DIRECTIVES,
            variables: {
              activityDirectivesInsertInput,
            },
          }),
          headers,
          method: 'POST',
        });

        const createdActivityDirectivesData = (await createdActivitiesResponse.json()) as {
          data: {
            insert_activity_directive: {
              returning: ActivityDirective[];
            };
          };
        } | null;

        if (createdActivityDirectivesData) {
          const {
            data: {
              insert_activity_directive: { returning: createdActivityDirectives },
            },
          } = createdActivityDirectivesData;

          if (createdActivityDirectives.length === activities.length) {
            createdActivityDirectives.forEach((createdActivityDirective, index) => {
              const { id } = activities[index];

              activityRemap[id] = createdActivityDirective.id;
            });
          } else {
            throw new Error('Activity insertion failed.');
          }
        }

        // remap all the anchor ids to the newly created activity directives
        logger.info(`POST /importPlan: Re-assigning anchors: ${name}`);

        const activityDirectivesSetInput = activities
          .filter(({ anchor_id: anchorId }) => anchorId !== null)
          .map(({ anchor_id: anchorId, id }) => ({
            _set: { anchor_id: activityRemap[anchorId as number] },
            where: { id: { _eq: activityRemap[id] }, plan_id: { _eq: (createdPlan as PlanSchema).id } },
          }));

        await fetch(GQL_API_URL, {
          body: JSON.stringify({
            query: gql.UPDATE_ACTIVITY_DIRECTIVES,
            variables: {
              updates: activityDirectivesSetInput,
            },
          }),
          headers,
          method: 'POST',
        });

        // associate the tags with the newly created plan
        logger.info(`POST /importPlan: Importing plan tags: ${name}`);
        const parsedTags: number[] = JSON.parse(tags);

        const tagsInsert: PlanTagsInsertInput[] = parsedTags.map(tagId => ({
          plan_id: (createdPlan as PlanSchema).id,
          tag_id: tagId,
        }));

        await fetch(GQL_API_URL, {
          body: JSON.stringify({ query: gql.CREATE_PLAN_TAGS, variables: { tags: tagsInsert } }),
          headers,
          method: 'POST',
        });

        logger.info(`POST /importPlan: Imported plan: ${name}`);
      }
      res.json(createdPlan);
    } else {
      throw Error('Plan creation unsuccessful.');
    }
  } catch (error) {
    logger.error(`POST /importPlan: Error occurred during plan ${name} import`);
    logger.error(error);

    // cleanup the imported plan if it failed along the way
    if (createdPlan) {
      // delete the plan - activities associated to the plan will be automatically cleaned up
      await fetch(GQL_API_URL, {
        body: JSON.stringify({ query: gql.DELETE_PLAN, variables: { id: createdPlan.id } }),
        headers,
        method: 'POST',
      });

      // if any activity tags were created as a result of this import, remove them
      await fetch(GQL_API_URL, {
        body: JSON.stringify({ query: gql.DELETE_TAGS, variables: { tagIds: createdTags.map(({ id }) => id) } }),
        headers,
        method: 'POST',
      });
    }
    res.sendStatus(500);
  }
}

export default (app: Express) => {
  /**
   * @swagger
   * /importPlan:
   *   post:
   *     security:
   *       - bearerAuth: []
   *     consumes:
   *       - multipart/form-data
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
   *         multipart/form-data:
   *          schema:
   *            type: object
   *            properties:
   *              plan_file:
   *                format: binary
   *                type: string
   *              name:
   *                type: string
   *              model_id:
   *                type: integer
   *              start_time:
   *                type: string
   *              duration:
   *                type: string
   *              sim_id:
   *                type: integer
   *              tags:
   *                type: string
   *     responses:
   *       200:
   *         description: ImportResponse
   *       403:
   *         description: Unauthorized error
   *       401:
   *         description: Unauthenticated error
   *     summary: Import a plan JSON file
   *     tags:
   *       - Hasura
   */
  app.post('/importPlan', upload.single('plan_file'), refreshLimiter, auth, importPlan);
};
