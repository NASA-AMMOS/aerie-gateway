import { getEnv } from '../../../env.js';
import {
  authGroupMappingsExist,
  cookieIsValid,
  generateJwt,
  getUserRoles,
  mapGroupsToRoles,
  syncRolesToDB,
} from '../functions.js';
import fetch from 'node-fetch';
import type { AuthAdapter, AuthResponse, ValidateResponse } from '../types.js';

import { Request } from 'express';

type CAMValidateResponse = {
  validated?: boolean;
  errorCode?: string;
  errorMessage?: string;
};

type CAMInvalidateResponse = {
  invalidated?: boolean;
  errorCode?: string;
  errorMessage?: string;
};

type CAMLoginResponse = {
  userId?: string;
  errorCode?: string;
  errorMessage?: string;
  groupList?: string[];
};

export const CAMAuthAdapter: AuthAdapter = {
  logout: async (req: Request): Promise<boolean> => {
    const { AUTH_SSO_TOKEN_NAME, AUTH_URL } = getEnv();

    const cookies = req.cookies;
    const ssoToken = cookies[AUTH_SSO_TOKEN_NAME[0]];

    const body = JSON.stringify({ ssoToken });
    const url = `${AUTH_URL}/ssoToken?action=invalidate`;
    const response = await fetch(url, { body, method: 'DELETE' });
    const { invalidated = false } = (await response.json()) as CAMInvalidateResponse;

    return invalidated;
  },

  validate: async (req: Request): Promise<ValidateResponse> => {
    const { AUTH_SSO_TOKEN_NAME, AUTH_URL, AUTH_UI_URL } = getEnv();

    const cookies = req.cookies;
    const ssoToken = cookies[AUTH_SSO_TOKEN_NAME[0]];
    const userCookie = cookies['user'];

    const body = JSON.stringify({ ssoToken });
    const url = `${AUTH_URL}/ssoToken?action=validate`;
    const response = await fetch(url, { body, method: 'POST' });
    const json = (await response.json()) as CAMValidateResponse;

    const { validated = false, errorCode = false } = json;

    const redirectTo = req.headers.referrer;

    const redirectURL = `${AUTH_UI_URL}/?goto=${redirectTo}`;

    if (errorCode || !validated) {
      return {
        message: 'invalid token, redirecting to login UI',
        redirectURL,
        success: false,
      };
    }

    const loginResp = await loginSSO(ssoToken, userCookie);

    return {
      message: 'valid SSO token',
      redirectURL: '',
      success: validated,
      token: loginResp.token ?? undefined,
      userId: loginResp.message,
    };
  },
};

export async function loginSSO(ssoToken: string, userCookie?: string): Promise<AuthResponse> {
  const { AUTH_URL } = getEnv();

  try {
    const body = JSON.stringify({ ssoToken });
    const url = `${AUTH_URL}/userProfile`;
    const response = await fetch(url, { body, method: 'POST' });
    const json = (await response.json()) as CAMLoginResponse;
    const { userId = '', errorCode = false, groupList = [] } = json;

    if (errorCode) {
      const { errorMessage } = json;
      return {
        message: errorMessage ?? 'error logging into CAM',
        success: false,
        token: null,
      };
    }

    const { default_role, allowed_roles } = mapGroupsToRoles(groupList);

    // if auth group mappings exist, the auth provider and mappings
    // are the source of truth, so we need to upsert roles in the DB.
    // We only do this when the user is logging in for the first time
    // in a session (user cookie DNE) for DB performance reasons,
    // and to avoid roles changing underneath the user during a session
    const isNewUserSession = !(userCookie && cookieIsValid(userCookie));
    if (isNewUserSession && authGroupMappingsExist()) {
      await syncRolesToDB(userId, default_role, allowed_roles);
    }

    const user_roles = await getUserRoles(userId, default_role, allowed_roles);

    if (user_roles.allowed_roles.length == 0) {
      return {
        message: `User ${userId} has no allowed roles`,
        success: false,
        token: null,
      };
    }

    return {
      message: userId,
      success: true,
      token: generateJwt(userId, user_roles.default_role, user_roles.allowed_roles),
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'An unexpected error occurred',
      success: false,
      token: null,
    };
  }
}
