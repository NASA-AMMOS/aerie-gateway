import type { NextFunction, Request, Response } from 'express';
import { decodeJwt, session } from './functions.js';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  const authorizationHeader = req.get('authorization');
  const response = await session(authorizationHeader);

  if (response.success) {
    next();
  } else {
    res.status(401).send({ message: 'Unauthorized', success: false });
  }
};

// Only permits `aerie_admin` users
export const adminOnlyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authorizationHeader = req.get('authorization');
  const response = await session(authorizationHeader);

  if (response.success) {
    const { jwtPayload } = decodeJwt(authorizationHeader);
    if (jwtPayload == null) {
      res.status(401).send({ message: 'No authorization headers present.' });
      return;
    }

    const defaultRole = jwtPayload['https://hasura.io/jwt/claims']['x-hasura-default-role'] as string;
    const allowedRoles = jwtPayload['https://hasura.io/jwt/claims']['x-hasura-allowed-roles'] as string[];

    const { headers } = req;
    const { 'x-hasura-role': role } = headers;

    if (role != undefined) {
      if (!allowedRoles.includes(role as string)) {
        res.status(401).send({ message: 'Declared role is not in allowed roles.' });
        return;
      }
      if (role != 'aerie_admin') {
        res.status(403).send({ message: 'Current active role is unauthorized.' });
        return;
      }
    } else if (defaultRole != 'aerie_admin') {
      res.status(403).send({ message: 'Current active role is unauthorized.' });
      return;
    }
    next();
  } else {
    res.status(401).send({ message: 'Unauthorized', success: false });
  }
};
