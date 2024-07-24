import { Request } from 'express';

export type JsonWebToken = string;

export type JwtDecode = {
  jwtErrorMessage: string;
  jwtPayload: JwtPayload | null;
};

export type JwtPayload = {
  'https://hasura.io/jwt/claims': Record<string, string | string[]>;
  username: string;
};

export type JwtSecret = {
  key: string;
  type: string;
};

export type AuthResponse = {
  message: string;
  success: boolean;
  token: JsonWebToken | null;
};

export type SessionResponse = {
  message: string;
  success: boolean;
};

export type UserResponse = {
  message: string;
  success: boolean;
  user: User | null;
};

export type UserId = string;

export type User = {
  id: UserId;
};

export type ValidateResponse = {
  success: boolean;
  message: string;
  userId?: string;
  token?: string;
  redirectURL?: string;
};

export interface AuthAdapter {
  validate(req: Request): Promise<ValidateResponse>;
  logout(req: Request): Promise<boolean>;
}

export type GroupRoleMapping = { [key: string]: string[] };

export type UserRoles = {
  default_role: string;
  allowed_roles: string[];
};
