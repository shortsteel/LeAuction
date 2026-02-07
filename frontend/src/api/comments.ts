import client from './client';
import type { Comment } from '../types';

export const commentsApi = {
  list: (itemId: number, page = 1) =>
    client.get<{ comments: Comment[]; total: number; page: number; pages: number }>(
      `/items/${itemId}/comments`,
      { params: { page } }
    ),

  create: (itemId: number, content: string) =>
    client.post<{ comment: Comment }>(`/items/${itemId}/comments`, { content }),
};
