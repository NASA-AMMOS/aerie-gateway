import { getEnv } from '../../../env.js';
import type { AuthAdapter, ValidateResponse } from "../types.js";

export const DefaultAuthAdapter: AuthAdapter = {
  logout: async (_cookies: any): Promise<boolean> => true,
  validate: async (_cookies: any): Promise<ValidateResponse> => {
    const { AUTH_UI_URL } = getEnv();
    return {
      message: "SSO token auth is disabled",
      success: false,
      redirectURL: AUTH_UI_URL,
    }
  }
}

