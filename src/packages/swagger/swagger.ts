import type { Express } from 'express';
import swaggerJsDoc from 'swagger-jsdoc';
import swagger from 'swagger-ui-express';
import { getEnv } from '../../env.js';

const { VERSION } = getEnv();

const options: swaggerJsDoc.Options = {
  apis: ['./dist/packages/**/*.js'],
  definition: {
    info: {
      title: 'Aerie Gateway',
      version: VERSION,
    },
    openapi: '3.0.0',
    tags: [
      {
        description: 'Endpoints for authentication and session management',
        name: 'Auth',
      },
      {
        description: 'Endpoints for file management (e.g. adding, updating, or deleting files)',
        name: 'Files',
      },
      {
        description: 'Endpoints for UI view management (e.g. adding, updating, getting, deleting, or validating views)',
        name: 'Views',
      },
      {
        description: 'Endpoints for health information (e.g. uptime) about this server',
        name: 'Health',
      },
    ],
  },
};

export default async (app: Express) => {
  const spec = await swaggerJsDoc(options);
  app.use(
    '/',
    swagger.serve,
    swagger.setup(spec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Aerie Gateway',
    }),
  );
};
