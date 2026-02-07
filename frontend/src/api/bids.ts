import client from './client';
import type { Bid, AuctionItemDetail } from '../types';

export const bidsApi = {
  place: (itemId: number, amount: number) =>
    client.post<{ bid: Bid; item: AuctionItemDetail }>(`/bids/item/${itemId}`, { amount }),

  list: (itemId: number) =>
    client.get<{ bids: Bid[] }>(`/bids/item/${itemId}`),
};
