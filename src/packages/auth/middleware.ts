import type { NextFunction, Request, Response } from 'express';
import { getEnv } from '../../env.js';
import { session } from './functions.js';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  const { AUTH_TYPE } = getEnv();

  if (AUTH_TYPE === 'none') {
    next();
  } else {
    const { headers } = req;
    const { 'x-auth-sso-token': ssoToken = '' } = headers;
    const response = await session(ssoToken as string);

    if (response.success) {
      next();
    } else {
      res.status(401).send({ message: 'Unauthorized', success: false });
    }
  }
};
