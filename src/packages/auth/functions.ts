import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { getEnv } from '../../env.js';
import type { LoginResponse, LogoutResponse, SessionResponse, UserResponse } from './types.js';
import getLogger from '../../logger.js';

const logger = getLogger('packages/auth/functions');

export async function login(username: string, password: string): Promise<LoginResponse> {
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
          ssoToken: null,
          success: false,
          username: null,
        };
      } else {
        const { ssoCookieValue: ssoToken } = json;
        return {
          message: 'Login successful',
          ssoToken,
          success: true,
          username,
        };
      }
    } catch (error) {
      logger.error(error);
      logger.error(response);
      logger.error(json);
      return {
        message: 'An unexpected error occurred',
        ssoToken: null,
        success: false,
        username: null,
      };
    }
  } else {
    return {
      message: 'Authentication is disabled',
      ssoToken: 'unknown',
      success: true,
      username: 'unknown',
    };
  }
}

export async function logout(ssoToken: string): Promise<LogoutResponse> {
  const { AUTH_TYPE, AUTH_URL } = getEnv();

  if (AUTH_TYPE === 'cam') {
    let response: Response | undefined;
    let json: any;

    try {
      const body = JSON.stringify({ ssoToken });
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

export async function session(ssoToken: string): Promise<SessionResponse> {
  const { AUTH_TYPE, AUTH_URL } = getEnv();

  if (AUTH_TYPE === 'cam') {
    let response: Response | undefined;
    let json: any;

    try {
      const body = JSON.stringify({ ssoToken });
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

export async function user(ssoToken: string): Promise<UserResponse> {
  const { AUTH_TYPE, AUTH_URL } = getEnv();

  if (AUTH_TYPE === 'cam') {
    let response: Response | undefined;
    let json: any;

    try {
      const body = JSON.stringify({ ssoToken });
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
