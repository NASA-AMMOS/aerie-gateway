import jwt, { Algorithm } from 'jsonwebtoken';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import { DbMerlin } from '../db/db.js';
import type { AuthResponse, JsonWebToken, JwtDecode, JwtPayload, JwtSecret, SessionResponse } from './types.js';

const logger = getLogger('packages/auth/functions');

export function authorizationHeaderToToken(authorizationHeader: string | undefined | null): JsonWebToken | never {
  if (authorizationHeader !== null && authorizationHeader !== undefined) {
    if (authorizationHeader.startsWith('Bearer ')) {
      const [, token] = authorizationHeader.split(' '); // Split out 'Bearer' prefix.
      return token;
    } else {
      throw new Error(`Authorization header does not include 'Bearer' prefix`);
    }
  } else {
    throw new Error(`Authorization header not found`);
  }
}

/**
 * Returns default role, and allowed roles for a user.
 * If the user does not exist, this function creates the user and gives them a default role.
 */
export async function getUserRoles(
  username: string,
  default_role: string,
  allowed_roles: string[],
): Promise<{ allowed_roles: string[]; default_role: string }> {
  const db = DbMerlin.getDb();

  const { rows, rowCount } = await db.query(
    `
      select hasura_default_role, hasura_allowed_roles
      from metadata.users_and_roles
      where username = $1;
    `,
    [username],
  );

  if (rowCount && rowCount > 0) {
    const [row] = rows;
    const { hasura_allowed_roles, hasura_default_role } = row;
    return { allowed_roles: hasura_allowed_roles, default_role: hasura_default_role };
  } else {
    await db.query(
      `
        insert into metadata.users (username, default_role)
        values ($1, $2);
      `,
      [username, default_role],
    );

    for (const allowed_role of allowed_roles) {
      await db.query(
        `
          insert into metadata.users_allowed_roles (username, allowed_role)
          values ($1, $2);
        `,
        [username, allowed_role],
      );
    }

    return { allowed_roles, default_role };
  }
}

export function decodeJwt(authorizationHeader: string | undefined): JwtDecode {
  try {
    const token = authorizationHeaderToToken(authorizationHeader);
    const { HASURA_GRAPHQL_JWT_SECRET, JWT_ALGORITHMS } = getEnv();
    const { key }: JwtSecret = JSON.parse(HASURA_GRAPHQL_JWT_SECRET);
    const options: jwt.VerifyOptions = { algorithms: JWT_ALGORITHMS };
    const jwtPayload = jwt.verify(token, key, options) as JwtPayload;
    return { jwtErrorMessage: '', jwtPayload };
  } catch (e) {
    console.error(e);

    if (e instanceof jwt.TokenExpiredError) {
      const tokenExpiredError = e as jwt.TokenExpiredError;
      const jwtErrorMessage = `Token expired on ${tokenExpiredError.expiredAt}`;
      return { jwtErrorMessage, jwtPayload: null };
    } else {
      const error = e as Error;
      const jwtErrorMessage = error?.message ?? 'Token could not be verified';
      return { jwtErrorMessage, jwtPayload: null };
    }
  }
}

export function generateJwt(username: string, defaultRole: string, allowedRoles: string[]): string | null {
  try {
    const { HASURA_GRAPHQL_JWT_SECRET, JWT_EXPIRATION } = getEnv();
    const { key, type }: JwtSecret = JSON.parse(HASURA_GRAPHQL_JWT_SECRET);
    const options: jwt.SignOptions = { algorithm: type as Algorithm, expiresIn: JWT_EXPIRATION };
    const payload: JwtPayload = {
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': allowedRoles,
        'x-hasura-default-role': defaultRole,
        'x-hasura-user-id': username,
      },
      username,
    };

    return jwt.sign(payload, key, options);
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const { AUTH_TYPE, AUTH_URL, ALLOWED_ROLES, ALLOWED_ROLES_NO_AUTH, DEFAULT_ROLE, DEFAULT_ROLE_NO_AUTH } = getEnv();

  if (AUTH_TYPE === 'cam') {
    let response: Response | undefined;
    let json: any;

    try {
      const body = JSON.stringify({ password, username });
      const url = `${AUTH_URL}/ssoToken?loginMethod=ldap`;
      response = await fetch(url, { body, method: 'POST' });
      json = await response.json();
      const { errorCode = false } = json;

      if (errorCode) {
        const { errorMessage } = json;
        return {
          message: errorMessage,
          success: false,
          token: null,
        };
      } else {
        const { allowed_roles, default_role } = await getUserRoles(username, DEFAULT_ROLE, ALLOWED_ROLES);
        return {
          message: 'Login successful',
          success: true,
          token: generateJwt(username, default_role, allowed_roles),
        };
      }
    } catch (error) {
      logger.error(error);
      logger.error(response);
      logger.error(json);
      return {
        message: 'An unexpected error occurred',
        success: false,
        token: null,
      };
    }
  } else {
    const { allowed_roles, default_role } = await getUserRoles(username, DEFAULT_ROLE_NO_AUTH, ALLOWED_ROLES_NO_AUTH);
    return {
      message: 'Authentication is disabled',
      success: true,
      token: generateJwt(username, default_role, allowed_roles),
    };
  }
}

export async function session(authorizationHeader: string | undefined): Promise<SessionResponse> {
  const { AUTH_TYPE } = getEnv();

  if (AUTH_TYPE === 'cam') {
    const { jwtErrorMessage, jwtPayload } = decodeJwt(authorizationHeader);

    if (jwtPayload) {
      return { message: 'Token is valid', success: true };
    } else {
      return { message: jwtErrorMessage, success: false };
    }
  } else {
    return { message: `Authentication is disabled`, success: true };
  }
}
