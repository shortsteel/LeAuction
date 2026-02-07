import client from './client';
import type { AuctionItemCard, AuctionItemDetail, PaginatedResponse } from '../types';

export interface CreateItemData {
  title: string;
  description?: string;
  category?: string;
  condition?: string;
  starting_price: number;
  reserve_price?: number | null;
  increment?: number;
  buyout_price?: number | null;
  image_urls: string[];
}

export interface ListItemsParams {
  page?: number;
  per_page?: number;
  category?: string;
  sort?: string;
  search?: string;
  status?: string;
}

export const itemsApi = {
  create: (data: CreateItemData) =>
    client.post<{ item: AuctionItemDetail }>('/items', data),

  list: (params: ListItemsParams = {}) =>
    client.get<PaginatedResponse<AuctionItemCard>>('/items', { params }),

  get: (id: number) =>
    client.get<{ item: AuctionItemDetail }>(`/items/${id}`),

  update: (id: number, data: Partial<CreateItemData>) =>
    client.put<{ item: AuctionItemDetail }>(`/items/${id}`, data),

  publish: (id: number, duration: { duration_days?: number; duration_hours?: number }) =>
    client.post<{ item: AuctionItemDetail }>(`/items/${id}/publish`, duration),

  cancel: (id: number) =>
    client.post<{ item: AuctionItemDetail }>(`/items/${id}/cancel`),

  delete: (id: number) =>
    client.delete<{ message: string }>(`/items/${id}/delete`),

  myItems: (status?: string) =>
    client.get<{ items: AuctionItemCard[] }>('/items/my', { params: status ? { status } : {} }),

  myBids: () =>
    client.get<{ items: AuctionItemCard[] }>('/items/my-bids'),
};
