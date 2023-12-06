import { altairExpress } from 'altair-express-middleware';
import type { Express } from 'express';
import { getEnv } from '../../env.js';
import { readFileSync } from 'fs';

export default (app: Express) => {
  const { GQL_API_URL: endpointURL, GQL_API_WS_URL: subscriptionsEndpoint } = getEnv();
  const initialQuery = '{ plan { id name } }';
  const initialHeaders = { Authorization: 'Bearer {{user}}', 'x-hasura-role': 'viewer' };
  const initialPreRequestScript = readFileSync('static/api-playground/pre-request-script.js').toString();
  const initialSettings = {
    addQueryDepthLimit: 5,
    enableExperimental: true,
    'plugin.list': ['altair-graphql-plugin-graphql-explorer'],
    'request.withCredentials': true,
    'schema.reloadOnStart': true,
    'script.allowedCookies': ['user'],
    tabSize: 2,
    theme: 'dracula',
  };

  app.use(
    '/api-playground',
    altairExpress({
      disableAccount: true,
      endpointURL,
      initialHeaders,
      initialPreRequestScript,
      initialQuery,
      initialSettings,
      subscriptionsEndpoint,
    }),
  );
};
