import type { NextFunction, Request, Response } from 'express';
import { session } from '../cam/cam.js';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  const { CAM_ENABLED } = process.env;

  if (CAM_ENABLED === 'false') {
    next();
  } else {
    const { headers } = req;
    const { 'x-cam-sso-token': ssoToken = '' } = headers;
    const response = await session(ssoToken as string);

    if (response.success) {
      next();
    } else {
      res.status(401).send({ message: 'Unauthorized', success: false });
    }
  }
};
