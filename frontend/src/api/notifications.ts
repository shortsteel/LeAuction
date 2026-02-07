import client from './client';
import type { Notification } from '../types';

interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  page: number;
  pages: number;
}

export const notificationsApi = {
  list: (page = 1, perPage = 20) =>
    client.get<NotificationListResponse>('/notifications', {
      params: { page, per_page: perPage },
    }),

  unreadCount: () =>
    client.get<{ count: number }>('/notifications/unread-count'),

  markRead: (id: number) =>
    client.put<{ notification: Notification }>(`/notifications/${id}/read`),

  markAllRead: () =>
    client.put<{ message: string }>('/notifications/read-all'),
};
