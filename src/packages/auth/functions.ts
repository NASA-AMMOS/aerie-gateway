import jwt from 'jsonwebtoken';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { getEnv } from '../../env.js';
import getLogger from '../../logger.js';
import type {
  JsonWebToken,
  JwtPayload,
  JwtSecret,
  AuthResponse,
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

export function decodeJwt(authorizationHeader: string | undefined): JwtPayload | null {
  try {
    const token = authorizationHeaderToToken(authorizationHeader);
    const { HASURA_GRAPHQL_JWT_SECRET } = getEnv();
    const { key }: JwtSecret = JSON.parse(HASURA_GRAPHQL_JWT_SECRET);
    const options: jwt.VerifyOptions = { algorithms: ['HS256'] };
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
  otherClaims: Record<string, string | string[]> = {},
  activeRole?: string,
): string | null {
  try {
    const { HASURA_GRAPHQL_JWT_SECRET } = getEnv();
    const { key, type }: JwtSecret = JSON.parse(HASURA_GRAPHQL_JWT_SECRET);
    const options: jwt.SignOptions = { algorithm: type as 'HS256' | 'RS512', expiresIn: '36h' };
    const payload: JwtPayload = {
      activeRole: activeRole && allowedRoles.includes(activeRole) ? activeRole : defaultRole,
      camToken,
      'https://hasura.io/jwt/claims': {
        'x-hasura-allowed-roles': allowedRoles,
        'x-hasura-default-role': defaultRole,
        'x-hasura-user-id': username,
        ...otherClaims,
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
  const { AUTH_TYPE, AUTH_URL } = getEnv();

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
        // TODO: Use other roles instead of 'admin'.
        return {
          message: 'Login successful',
          success: true,
          token: generateJwt(username, camToken, 'admin', ['admin', 'user']),
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
    return {
      message: 'Authentication is disabled',
      success: true,
      token: generateJwt(username || 'unknown', '', 'admin', ['admin', 'user']),
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
        ...claims
      } = jwtPayload;
      if (AUTH_TYPE === 'cam') {
        return {
          message: 'Role change successful',
          success: true,
          token: generateJwt(username, camToken, defaultRole as string, allowedRoles as string[], claims, role),
        };
      } else {
        return {
          message: 'Authentication is disabled',
          success: true,
          token: generateJwt(username || 'unknown', '', defaultRole as string, allowedRoles as string[], {}, role),
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
