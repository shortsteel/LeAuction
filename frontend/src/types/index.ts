export interface User {
  id: number;
  email: string;
  nickname: string;
  avatar_url: string;
  created_at: string;
}

export interface PublicUser {
  id: number;
  nickname: string;
  avatar_url: string;
}

export interface ItemImage {
  id: number;
  image_url: string;
  sort_order: number;
}

export interface AuctionItemCard {
  id: number;
  title: string;
  category: string;
  condition: string;
  current_price: number;
  starting_price: number;
  buyout_price: number | null;
  bid_count: number;
  end_time: string | null;
  status: string;
  image_url: string | null;
  seller: PublicUser | null;
  reserve_met: boolean;
  has_reserve: boolean;
  // Extra fields for my-bids
  my_max_bid?: number;
  is_leading?: boolean;
  is_winner?: boolean;
}

export interface AuctionItemDetail {
  id: number;
  seller_id: number;
  seller: PublicUser | null;
  title: string;
  description: string;
  category: string;
  condition: string;
  starting_price: number;
  reserve_price?: number | null; // only visible to seller
  increment: number;
  buyout_price: number | null;
  current_price: number;
  bid_count: number;
  start_time: string | null;
  end_time: string | null;
  status: string;
  winner_id: number | null;
  images: ItemImage[];
  reserve_met?: boolean;
  has_reserve?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: number;
  item_id: number;
  bidder_id: number;
  bidder: PublicUser | null;
  amount: number;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  related_item_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface Transaction {
  id: number;
  item_id: number;
  seller_id: number;
  buyer_id: number;
  final_price: number;
  seller_confirmed: boolean;
  buyer_confirmed: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

// Constants
export const CATEGORY_MAP: Record<string, string> = {
  electronics: '电子产品',
  food: '食品饮料',
  daily: '生活用品',
  other: '其他',
};

export const CONDITION_MAP: Record<string, string> = {
  new: '全新',
  like_new: '几乎全新',
  good: '轻微使用痕迹',
  fair: '明显使用痕迹',
};

export const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  ended_won: '已成交',
  ended_unsold: '已流拍',
  cancelled: '已取消',
  completed: '已完成',
};

export const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  active: 'processing',
  ended_won: 'success',
  ended_unsold: 'warning',
  cancelled: 'error',
  completed: 'cyan',
};
