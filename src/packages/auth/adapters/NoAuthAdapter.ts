import { getEnv } from '../../../env.js';
import { generateJwt, getUserRoles } from '../functions.js';
import type { AuthAdapter, ValidateResponse } from '../types.js';

export const NoAuthAdapter: AuthAdapter = {
  logout: async (): Promise<boolean> => true,
  validate: async (): Promise<ValidateResponse> => {
    const { DEFAULT_ROLE_NO_AUTH, ALLOWED_ROLES_NO_AUTH } = getEnv();

    console.log('auth disabled, returning default roles');
    const userId = 'default_user';
    const { allowed_roles, default_role } = await getUserRoles(userId, DEFAULT_ROLE_NO_AUTH, ALLOWED_ROLES_NO_AUTH);

    return {
      message: userId,
      success: true,
      token: generateJwt(userId, default_role, allowed_roles) ?? undefined,
    };
  },
};
