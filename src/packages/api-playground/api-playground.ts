import { altairExpress } from 'altair-express-middleware';
import type { Express } from 'express';
import { getEnv } from '../../env.js';

export default (app: Express) => {
  const { GQL_API_URL: endpointURL, GQL_API_WS_URL: subscriptionsEndpoint } = getEnv();
  const initialQuery = '{ plan { id name } }';
  const initialHeaders = { Authorization: 'Bearer {{user}}', 'x-hasura-role': 'viewer' };
  const initialPreRequestScript =
  `
  // Fetch a new token from the Gateway
  const res = await altair.helpers.request(
    'POST',
    '/auth/login', // AUTH ENDPOINT OF THE DEPLOYMENT
  {
    body: { "username": "<YOUR_AERIE_USERNAME>", "password": "<YOUR_AERIE_PASSWORD>"}, // CREDENTIALS TO LOG IN AS
    headers: {"Content-Type": "application/json"}
  });
  if(res.success) {
    const token = res.token;
    await altair.helpers.setEnvironment("user", token);
  } else {
    altair.log(res);
  }`;
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
