import jwt, { Algorithm } from 'jsonwebtoken';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import { DbMerlin } from '../db/db.js';
import type {
  AuthResponse,
  JsonWebToken,
  JwtPayload,
  JwtSecret,
  LogoutResponse,
  SessionResponse,
  UserResponse,
} from './types.js';

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

  if (rowCount > 0) {
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

export function decodeJwt(authorizationHeader: string | undefined): JwtPayload | null {
  try {
    const token = authorizationHeaderToToken(authorizationHeader);
    const { HASURA_GRAPHQL_JWT_SECRET, JWT_ALGORITHMS } = getEnv();
    const { key }: JwtSecret = JSON.parse(HASURA_GRAPHQL_JWT_SECRET);
    const options: jwt.VerifyOptions = { algorithms: JWT_ALGORITHMS };
    const jwtPayload = jwt.verify(token, key, options) as JwtPayload;
    return jwtPayload;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function generateJwt(
  username: string,
  camToken: string,
  defaultRole: string,
  allowedRoles: string[],
  activeRole?: string,
): string | null {
  try {
    const { HASURA_GRAPHQL_JWT_SECRET, JWT_EXPIRATION } = getEnv();
    const { key, type }: JwtSecret = JSON.parse(HASURA_GRAPHQL_JWT_SECRET);
    const options: jwt.SignOptions = { algorithm: type as Algorithm, expiresIn: JWT_EXPIRATION };
    const payload: JwtPayload = {
      activeRole: activeRole && allowedRoles.includes(activeRole) ? activeRole : defaultRole,
      camToken,
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
        const { ssoCookieValue: camToken } = json;
        const { allowed_roles, default_role } = await getUserRoles(username, DEFAULT_ROLE, ALLOWED_ROLES);
        return {
          message: 'Login successful',
          success: true,
          token: generateJwt(username, camToken, default_role, allowed_roles),
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
      token: generateJwt(username, '', default_role, allowed_roles),
    };
  }
}

export async function logout(authorizationHeader: string | undefined): Promise<LogoutResponse> {
  const { AUTH_TYPE, AUTH_URL } = getEnv();

  if (AUTH_TYPE === 'cam') {
    let response: Response | undefined;
    let json: any;

    try {
      const jwtPayload = decodeJwt(authorizationHeader);

      if (jwtPayload) {
        const { camToken } = jwtPayload;
        const body = JSON.stringify({ ssoToken: camToken });
        const url = `${AUTH_URL}/ssoToken?action=invalidate`;
        response = await fetch(url, { body, method: 'DELETE' });
        json = await response.json();
        const { errorCode = false } = json;

        if (errorCode) {
          const { errorMessage } = json;
          return { message: errorMessage, success: false };
        } else {
          return { message: 'Logout successful', success: true };
        }
      } else {
        return { message: 'No JWT payload found', success: false };
      }
    } catch (error) {
      logger.error(error);
      logger.error(response);
      logger.error(json);
      return { message: 'An unexpected error occurred', success: false };
    }
  } else {
    return { message: 'Authentication is disabled', success: true };
  }
}

export async function session(authorizationHeader: string | undefined): Promise<SessionResponse> {
  const { AUTH_TYPE, AUTH_URL } = getEnv();

  if (AUTH_TYPE === 'cam') {
    let response: Response | undefined;
    let json: any;

    try {
      const jwtPayload = decodeJwt(authorizationHeader);

      if (jwtPayload) {
        const { camToken } = jwtPayload;

        const body = JSON.stringify({ ssoToken: camToken });
        const url = `${AUTH_URL}/ssoToken?action=validate`;
        response = await fetch(url, { body, method: 'POST' });
        json = await response.json();
        const { errorCode = false } = json;

        if (errorCode) {
          const { errorMessage } = json;
          return { message: errorMessage, success: false };
        } else {
          const { validated } = json;
          const valid = validated ? 'valid' : 'invalid';
          const message = `Token is ${valid}`;
          return { message, success: validated };
        }
      } else {
        return { message: 'No JWT payload found', success: false };
      }
    } catch (error) {
      logger.error(error);
      logger.error(response);
      logger.error(json);
      return { message: 'An unexpected error occurred', success: false };
    }
  } else {
    return { message: `Authentication is disabled`, success: true };
  }
}

export async function user(authorizationHeader: string | undefined): Promise<UserResponse> {
  const { AUTH_TYPE, AUTH_URL } = getEnv();

  if (AUTH_TYPE === 'cam') {
    let response: Response | undefined;
    let json: any;

    try {
      const jwtPayload = decodeJwt(authorizationHeader);

      if (jwtPayload) {
        const { camToken } = jwtPayload;
        const body = JSON.stringify({ ssoToken: camToken });
        const url = `${AUTH_URL}/userProfile`;
        response = await fetch(url, { body, method: 'POST' });
        json = await response.json();
        const { errorCode = false } = json;

        if (errorCode) {
          const { errorMessage } = json;
          return { message: errorMessage, success: false, user: null };
        } else {
          const { filteredGroupList, fullName, groupList, userId } = json;
          return {
            message: 'User found',
            success: true,
            user: {
              filteredGroupList,
              fullName,
              groupList,
              userId,
            },
          };
        }
      } else {
        return { message: 'No JWT payload found', success: false, user: null };
      }
    } catch (error) {
      logger.error(error);
      logger.error(response);
      logger.error(json);
      return {
        message: 'An unexpected error occurred',
        success: false,
        user: null,
      };
    }
  } else {
    return {
      message: `Authentication is disabled`,
      success: true,
      user: {
        filteredGroupList: [],
        fullName: 'unknown',
        groupList: [],
        userId: 'unknown',
      },
    };
  }
}

export async function changeRole(
  authorizationHeader: string | undefined,
  role: string | undefined,
): Promise<AuthResponse> {
  const { AUTH_TYPE } = getEnv();
  const jwtPayload = decodeJwt(authorizationHeader);

  let response: Response | undefined;
  let json: any;

  try {
    if (jwtPayload) {
      const {
        camToken,
        username,
        'https://hasura.io/jwt/claims': {
          'x-hasura-allowed-roles': allowedRoles,
          'x-hasura-default-role': defaultRole,
        },
      } = jwtPayload;
      if (AUTH_TYPE === 'cam') {
        return {
          message: 'Role change successful',
          success: true,
          token: generateJwt(username, camToken, defaultRole as string, allowedRoles as string[], role),
        };
      } else {
        return {
          message: 'Authentication is disabled',
          success: true,
          token: generateJwt(username || 'unknown', '', defaultRole as string, allowedRoles as string[], role),
        };
      }
    } else {
      return { message: 'No JWT payload found', success: false, token: null };
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
}
