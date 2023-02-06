import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getEnv } from './env.js';
import getLogger from './logger.js';
import initAuthRoutes from './packages/auth/routes.js';
import { DbMerlin } from './packages/db/db.js';
import initFileRoutes from './packages/files/files.js';
import initHealthRoutes from './packages/health/health.js';
import initSwaggerRoutes from './packages/swagger/swagger.js';

async function main(): Promise<void> {
  const logger = getLogger('main');
  const { PORT } = getEnv();
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors());
  app.use(express.json());

  await DbMerlin.init();

  initAuthRoutes(app);
  initFileRoutes(app);
  initHealthRoutes(app);
  initSwaggerRoutes(app);

  app.listen(PORT, () => {
    logger.info(`🚀 AERIE-GATEWAY listening on ${PORT}`);
  });
}

main();
