import { altairExpress } from 'altair-express-middleware';
import type { Express } from 'express';
import { getEnv } from '../../env.js';

export default (app: Express) => {
  const { GQL_API_URL: endpointURL, GQL_API_WS_URL: subscriptionsEndpoint } = getEnv();
  const initialQuery = '{ plan { id name } }';
  app.use('/api-playground', altairExpress({ endpointURL, initialQuery, subscriptionsEndpoint }));
};
