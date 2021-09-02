import type { Express } from 'express';
import swaggerJsDoc from 'swagger-jsdoc';
import swagger from 'swagger-ui-express';

const options: swaggerJsDoc.Options = {
  apis: ['./dist/packages/**/*.js'],
  definition: {
    info: {
      title: 'Aerie API',
      version: '0.10.0',
    },
    openapi: '3.0.0',
    tags: [
      {
        name: 'CAM',
        description:
          'Endpoints for authentication using the Common Access Manager (CAM)',
      },
      {
        name: 'Health',
        description:
          'Endpoints for health information (e.g. uptime) about this server',
      },
    ],
  },
};

export default async (app: Express) => {
  const spec = await swaggerJsDoc(options);
  app.use('/', swagger.serve, swagger.setup(spec));
};
