// User interface
export interface User {
  id: string;
  email: string;
  roles: UserRole[];
  provider?: string;
  isActive?: boolean;
}

// User roles enum
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

// Login request
export interface LoginRequest {
  email: string;
  password: string;
}

// Register request
export interface RegisterRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

// Auth response
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    user: User;
  };
}

// API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}
