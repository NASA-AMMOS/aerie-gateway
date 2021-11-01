import type { Express } from 'express';
import expressPlayground from 'graphql-playground-middleware-express';
import { getEnv } from '../../env.js';

export default (app: Express) => {
  const { GQL_API_URL: endpoint } = getEnv();
  const initPlayground = (expressPlayground as any).default;
  app.get('/playground', initPlayground({ endpoint }));
};
