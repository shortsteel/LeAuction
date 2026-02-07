import client from './client';
import type { User } from '../types';

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nickname: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (data: LoginData) =>
    client.post<AuthResponse>('/auth/login', data),

  register: (data: RegisterData) =>
    client.post<AuthResponse>('/auth/register', data),

  getProfile: () =>
    client.get<{ user: User }>('/auth/me'),

  updateProfile: (data: { nickname?: string; avatar_url?: string }) =>
    client.put<{ user: User }>('/auth/me', data),

  changePassword: (data: { old_password: string; new_password: string }) =>
    client.post<{ message: string }>('/auth/change-password', data),
};
