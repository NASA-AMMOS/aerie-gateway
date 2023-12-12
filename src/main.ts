import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getEnv } from './env.js';
import getLogger from './logger.js';
import initApiPlaygroundRoutes from './packages/api-playground/api-playground.js';
import initAuthRoutes from './packages/auth/routes.js';
import { DbMerlin } from './packages/db/db.js';
import initFileRoutes from './packages/files/files.js';
import initHealthRoutes from './packages/health/health.js';
import initSwaggerRoutes from './packages/swagger/swagger.js';
import cookieParser from 'cookie-parser';
import { AuthAdapter } from './packages/auth/types.js';
import { NoAuthAdapter } from "./packages/auth/adapters/NoAuthAdapter.js";
import { CAMAuthAdapter } from "./packages/auth/adapters/CAMAuthAdapter.js";
import { DefaultAuthAdapter } from "./packages/auth/adapters/DefaultAuthAdapter.js";

async function main(): Promise<void> {
  const logger = getLogger('main');
  const { PORT, AUTH_TYPE } = getEnv();
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  await DbMerlin.init();

  let authHandler: AuthAdapter = DefaultAuthAdapter;
  switch (AUTH_TYPE) {
    case "none":
      authHandler = NoAuthAdapter;
      break;
    case "cam":
      authHandler = CAMAuthAdapter;
      break;
  }

  initApiPlaygroundRoutes(app);
  initAuthRoutes(app, authHandler);
  initFileRoutes(app);
  initHealthRoutes(app);
  initSwaggerRoutes(app);

  app.listen(PORT, () => {
    logger.info(`🚀 AERIE-GATEWAY listening on ${PORT}`);
  });
}

main();
