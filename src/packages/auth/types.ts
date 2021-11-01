export type LoginResponse = {
  message: string;
  ssoToken: string | null;
  success: boolean;
  username: string | null;
};

export type LogoutResponse = {
  message: string;
  success: boolean;
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

export type User = {
  filteredGroupList: string[];
  fullName: string;
  groupList: string[];
  userId: string;
};
