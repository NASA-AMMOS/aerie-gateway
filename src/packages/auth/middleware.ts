import type { NextFunction, Request, Response } from 'express';
import { getEnv } from '../../env.js';
import { session } from './functions.js';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  const { AUTH_TYPE } = getEnv();

  if (AUTH_TYPE === 'none') {
    next();
  } else {
    const authorizationHeader = req.get('authorization');
    const response = await session(authorizationHeader);

    if (response.success) {
      next();
    } else {
      res.status(401).send({ message: 'Unauthorized', success: false });
    }
  }
};
