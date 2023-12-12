import { getEnv } from '../../../env.js';
import { generateJwt, getUserRoles } from "../functions.js";
import type { AuthAdapter, AuthResponse, ValidateResponse } from "../types.js";

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
};

export const CAMAuthAdapter: AuthAdapter = {

  logout: async (cookies: any): Promise<boolean> => {

    const { AUTH_SSO_TOKEN_NAME, AUTH_URL } = getEnv();

    const ssoToken = cookies[AUTH_SSO_TOKEN_NAME];

    const body = JSON.stringify({ ssoToken });
    const url = `${AUTH_URL}/ssoToken?action=invalidate`;
    const response = await fetch(url, { body, method: 'DELETE' });
    const { invalidated = false } = await response.json() as CAMInvalidateResponse;

    return invalidated;
  },

  validate: async (cookies: any): Promise<ValidateResponse> => {

    const { AUTH_SSO_TOKEN_NAME, AUTH_URL, AUTH_UI_URL } = getEnv();

    const ssoToken = cookies[AUTH_SSO_TOKEN_NAME];

    const body = JSON.stringify({ ssoToken });
    const url = `${AUTH_URL}/ssoToken?action=validate`;
    const response = await fetch(url, { body, method: 'POST' });
    const json = await response.json() as CAMValidateResponse;

    const { validated = false, errorCode = false } = json;

    if (errorCode) {
      return {
        message: "invalid token, redirecting to login UI",
        redirectURL: AUTH_UI_URL,
        success: false
      };
    }

    const loginResp = await loginSSO(ssoToken);

    if (validated) {
      return {
        message: "valid SSO token",
        redirectURL: "",
        token: loginResp.token ?? undefined,
        userId: loginResp.message,
        success: validated
      }
    }

    return {
      message: "invalid SSO token",
      redirectURL: AUTH_UI_URL,
      success: false
    }
  },

};

async function loginSSO(ssoToken: any): Promise<AuthResponse> {
  const { AUTH_URL, DEFAULT_ROLE, ALLOWED_ROLES } = getEnv();

  try {
    const body = JSON.stringify({ ssoToken });
    const url = `${AUTH_URL}/userProfile`;
    const response = await fetch(url, { body, method: 'POST' });
    const json = await response.json() as CAMLoginResponse;
    const { userId = "", errorCode = false } = json;

    if (errorCode) {
      const { errorMessage } = json;
      return {
        message: errorMessage ?? "error logging into CAM",
        success: false,
        token: null,
      };
    }

    const { allowed_roles, default_role } = await getUserRoles(userId, DEFAULT_ROLE, ALLOWED_ROLES);

    return {
      message: userId,
      success: true,
      token: generateJwt(userId, default_role, allowed_roles),
    };
  } catch (error) {
    return {
      message: 'An unexpected error occurred',
      success: false,
      token: null,
    };
  }
}
