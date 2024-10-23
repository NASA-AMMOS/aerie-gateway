import { getEnv } from '../../../env.js';
import { authGroupMappingsExist, generateJwt, getUserRoles, mapGroupsToRoles, syncRolesToDB } from '../functions.js';
import fetch from 'node-fetch';
import type { AuthAdapter, AuthResponse, ValidateResponse } from '../../../types/auth.js';

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

    const loginResp = await loginSSO(ssoToken);

    return {
      message: 'valid SSO token',
      redirectURL: '',
      success: validated,
      token: loginResp.token ?? undefined,
      userId: loginResp.message,
    };
  },
};

export async function loginSSO(ssoToken: string): Promise<AuthResponse> {
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

    // if mappings exist, we treat them as the source of truth
    if (authGroupMappingsExist()) {
      // get existing allowed_roles from DB
      const existing_roles = await getUserRoles(userId, default_role, allowed_roles);

      // calculate if allowed_roles in DB match our freshly calculated mapping
      // these could differ if either AUTH_GROUP_ROLE_MAPPINGS changes, or if
      // user's membership in external auth groups changes.
      const existing_set = new Set(existing_roles.allowed_roles);
      const mapped_roles_match_db =
        allowed_roles.length == existing_roles.allowed_roles.length && allowed_roles.every(e => existing_set.has(e));

      // if they are different, upsert roles from mapping (source of truth)
      // we could do this every single time, but by only upserting when
      // they actually differ, we save on DB trips
      if (!mapped_roles_match_db) {
        await syncRolesToDB(userId, default_role, allowed_roles);
      }
    }

    const user_roles = await getUserRoles(userId, default_role, allowed_roles);

    if (user_roles.allowed_roles.length === 0) {
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
