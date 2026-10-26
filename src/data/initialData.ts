import { Category, StoreSettings } from '../types';
import { DEFAULT_COVER_IMAGE, getActiveCoverImage } from '../utils/coverImage';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'ขายถูกที่นี่ชุมแพ',
  storeSubtitle: 'ของเล่น กิ๊บช๊อป ของใช้ไฟฟ้าทั่วไป เครื่องมือช่าง สินค้าอื่นๆ ราคาประหยัด คุณภาพดี',
  storePhone: '099-225-6601',
  storeAddress: 'ต.ชุมแพ อ.ชุมแพ จ.ขอนแก่น (ใกล้สี่แยกชุมแพ)',
  storeLat: 16.525223,
  storeLng: 102.101480,
  promptpayNumber: '099-225-6601',
  promptpayName: 'ขายถูกที่นี่ชุมแพ (บัญชีร้านค้า)',
  baseDeliveryFee: 20, // 0 - 3 km
  baseKm: 3,
  perKmFee: 5, // +5 THB per additional km
  freeDeliveryThreshold: 500, // free if >= 500 THB
  isOpen: true,
  coverImageUrl: getActiveCoverImage(),
  lineNotifyToken: '',
  lineNotifyEnabled: true,
};

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-toys', name: 'ของเล่น', icon: '🧸', slug: 'toys' },
  { id: 'cat-giftshop', name: 'กิ๊บช๊อป', icon: '🎀', slug: 'giftshop' },
  { id: 'cat-general-electrical', name: 'ของใช้ไฟฟ้าทั่วไป', icon: '🔌', slug: 'general-electrical' },
  { id: 'cat-tools', name: 'เครื่องมือช่าง', icon: '🔧', slug: 'tools' },
  { id: 'cat-others', name: 'สินค้าอื่นๆ', icon: '📦', slug: 'others' },
];
