export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export type ProductCondition = 'new' | 'used' | 'new_defective' | 'repair_parts';

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  condition?: ProductCondition;
  price: number;
  costPrice: number;
  stock: number;
  unit: string;
  imageUrl: string;
  images?: string[];
  description: string;
  isActive: boolean;
  sellerId?: string;
  sellerName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SellerAccount {
  id: string;
  userId: string;
  password: string;
  shopName: string;
  phone?: string;
  linkSlug: string;
  expiresAt: string; // ISO string e.g. 2026-12-31T23:59:59.000Z
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  costPrice?: number;
  quantity: number;
  unit: string;
  subtotal: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  fulfillmentType?: 'pickup' | 'delivery' | 'meetup';
  customerLat?: number;
  customerLng?: number;
  distanceKm?: number;
  deliveryFee: number;
  deliveryFeeNotice?: string;
  subtotal: number;
  totalAmount: number;
  items: OrderItem[];
  paymentMethod?: 'promptpay' | 'cod';
  slipUrl?: string;
  deliveryProofImageUrl?: string;
  deliveryProofTimestamp?: string;
  status: OrderStatus;
  notes?: string;
  cancelReason?: string;
  cancelledAt?: string;
  lineNotifyStatus?: 'sent' | 'failed' | 'pending';
  lineNotifiedAt?: string;
  lineNotifyError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  slug: string;
}

export interface StoreSettings {
  id?: string;
  storeName: string;
  storeSubtitle: string;
  storePhone: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  promptpayNumber: string;
  promptpayName: string;
  baseDeliveryFee: number;
  baseKm: number;
  perKmFee: number;
  freeDeliveryThreshold: number;
  isOpen: boolean;
  coverImageUrl?: string;
  lineNotifyToken?: string;
  lineNotifyEnabled?: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'customer';
  address?: string;
  defaultLat?: number;
  defaultLng?: number;
}
