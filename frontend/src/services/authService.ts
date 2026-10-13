import type { AuthResponse, LoginRequest, SignupRequest, User } from '@/types/api';

import { request } from './apiClient';

export const signup = (body: SignupRequest) =>
  request<AuthResponse>('/api/auth/signup', { method: 'POST', body, auth: false });

export const login = (body: LoginRequest) =>
  request<AuthResponse>('/api/auth/login', { method: 'POST', body, auth: false });

export const getCurrentUser = () => request<User>('/api/users/me');

export const logoutRemote = () => request<void>('/api/auth/logout', { method: 'POST' });
