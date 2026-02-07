import client from './client';
import type { Transaction } from '../types';

export const transactionsApi = {
  get: (id: number) =>
    client.get<{ transaction: Transaction }>(`/transactions/${id}`),

  getByItem: (itemId: number) =>
    client.get<{ transaction: Transaction }>(`/transactions/item/${itemId}`),

  confirm: (id: number) =>
    client.post<{ transaction: Transaction }>(`/transactions/${id}/confirm`),

  my: () =>
    client.get<{ transactions: Transaction[] }>('/transactions/my'),
};
