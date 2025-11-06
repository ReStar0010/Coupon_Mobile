/**
 * Common type definitions
 */

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface AuthResponse {
  token?: string;
  user?: {
    id: string;
    email: string;
  };
}

