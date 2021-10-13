import type { Express } from 'express';
import expressPlayground from 'graphql-playground-middleware-express';

export default (app: Express) => {
  const { GQL_PLAYGROUND_ENDPOINT = '' } = process.env;
  const initPlayground = (expressPlayground as any).default;
  app.get('/playground', initPlayground({ endpoint: GQL_PLAYGROUND_ENDPOINT }));
};
