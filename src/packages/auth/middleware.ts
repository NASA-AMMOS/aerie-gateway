import type { NextFunction, Request, Response } from 'express';
import { getEnv } from '../../env.js';
import { user } from './functions.js';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  const { AUTH_TYPE } = getEnv();

  if (AUTH_TYPE === 'none') {
    res.locals.username = 'unknown';
    next();
  } else {
    const { headers } = req;
    const { 'x-auth-sso-token': ssoToken = '' } = headers;
    const response = await user(ssoToken as string);

    if (response.success) {
      res.locals.username = response.user?.userId;
      next();
    } else {
      res.status(401).send({ message: 'Unauthorized', success: false });
    }
  }
};
