import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  LogIn,
  LogOut,
  ShoppingBag,
  Plus,
  Boxes,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  Search,
  Filter,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { SellerAccount, ProductItem, Category } from '../types';
import { ProductModal } from './ProductModal';

interface SellerPortalProps {
  sellers: SellerAccount[];
  products: ProductItem[];
  categories: Category[];
  onSaveProduct: (productData: Partial<ProductItem>, isNew: boolean, existingId?: string) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onUpdateStock: (productId: string, newStock: number) => Promise<void>;
  onToggleActive: (productId: string, isActive: boolean) => Promise<void>;
  onNavigateHome: () => void;
}

export const SellerPortal: React.FC<SellerPortalProps> = ({
  sellers,
  products,
  categories,
  onSaveProduct,
  onDeleteProduct,
  onUpdateStock,
  onToggleActive,
  onNavigateHome,
}) => {
  // Current logged in seller state (persisted in sessionStorage)
  const [currentSeller, setCurrentSeller] = useState<SellerAccount | null>(() => {
    try {
      const saved = sessionStorage.getItem('chumphae_seller_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Login form inputs
  const [loginUserId, setLoginUserId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('user') || params.get('code') || '';
    } catch {
      return '';
    }
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Modal for adding / editing product
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Sync current seller state if updated in Firestore
  useEffect(() => {
    if (currentSeller) {
      const updated = sellers.find((s) => s.id === currentSeller.id);
      if (updated) {
        setCurrentSeller(updated);
        sessionStorage.setItem('chumphae_seller_session', JSON.stringify(updated));
      }
    }
  }, [sellers]);

  // Handle Login Submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanUser = loginUserId.trim().toLowerCase();
    const cleanPass = loginPassword.trim();

    if (!cleanUser || !cleanPass) {
      setLoginError('กรุณากรอก User ID และรหัสผ่าน');
      return;
    }

    setIsLoggingIn(true);
    try {
      // Find matching seller account
      const seller = sellers.find(
        (s) =>
          (s.userId.toLowerCase() === cleanUser || s.linkSlug.toLowerCase() === cleanUser) &&
          s.password === cleanPass
      );

      if (!seller) {
        setLoginError('User ID หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบหรือติดต่อผู้ดูแลร้าน');
        return;
      }

      // Check active state
      if (seller.isActive === false) {
        setLoginError('บัญชีผู้ขายนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลร้าน');
        return;
      }

      // Check expiry date
      const isExpired = new Date(seller.expiresAt).getTime() < Date.now();
      if (isExpired) {
        const expiredDateStr = new Date(seller.expiresAt).toLocaleDateString('th-TH');
        setLoginError(`บัญชีผู้ขายนี้หมดอายุการใช้งานแล้วเมื่อ ${expiredDateStr} กรุณาติดต่อผู้ดูแลร้านเพื่อต่ออายุ`);
        return;
      }

      // Success
      setCurrentSeller(seller);
      sessionStorage.setItem('chumphae_seller_session', JSON.stringify(seller));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    sessionStorage.removeItem('chumphae_seller_session');
    setCurrentSeller(null);
    setLoginPassword('');
  };

  // Check current seller expiration
  const isExpired = currentSeller ? new Date(currentSeller.expiresAt).getTime() < Date.now() : false;
  const remainingDays = currentSeller
    ? Math.ceil((new Date(currentSeller.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // Filter products belonging ONLY to this seller
  const sellerProducts = useMemo(() => {
    if (!currentSeller) return [];
    return products.filter((p) => p.sellerId === currentSeller.id);
  }, [products, currentSeller]);

  const filteredSellerProducts = useMemo(() => {
    return sellerProducts.filter((p) => {
      const matchSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;

      return matchSearch && matchCat;
    });
  }, [sellerProducts, searchQuery, categoryFilter]);

  // Product counts
  const totalProducts = sellerProducts.length;
  const inStockCount = sellerProducts.filter((p) => p.isActive && p.stock > 0).length;
  const outOfStockCount = sellerProducts.filter((p) => p.stock <= 0).length;

  // ========================================================
  // VIEW 1: SELLER LOGIN SCREEN
  // ========================================================
  if (!currentSeller) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-teal-200 shadow-xl max-w-md w-full overflow-hidden">
          
          {/* Header */}
          <div className="px-6 py-6 bg-gradient-to-r from-teal-800 to-teal-600 text-white text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mx-auto text-yellow-300">
              <Store className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black tracking-tight">เข้าสู่ระบบผู้ขาย (Seller Portal)</h2>
            <p className="text-xs text-teal-100">
              ระบบสำหรับผู้ขายลงรายการสินค้าและจัดการสต็อกร้านขายถูกที่นี่ชุมแพ
            </p>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            {loginError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-800 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  User ID (ชื่อผู้ใช้งานของผู้ขาย)
                </label>
                <input
                  type="text"
                  required
                  value={loginUserId}
                  onChange={(e) => setLoginUserId(e.target.value)}
                  placeholder="เช่น seller001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Password (รหัสผ่าน)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-mono text-xs tracking-wider pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>เข้าสู่ระบบจัดการสินค้า Seller</span>
              </button>
            </form>

            <div className="pt-3 border-t border-stone-100 text-center space-y-2">
              <p className="text-[11px] text-stone-500">
                ยังไม่มีบัญชีผู้ขาย? กรุณาติดต่อผู้ดูแลร้านเพื่อขอรับ User ID และรหัสผ่าน
              </p>
              <button
                type="button"
                onClick={onNavigateHome}
                className="text-xs text-teal-800 hover:underline font-semibold cursor-pointer"
              >
                ← กลับสู่หน้าร้านสำหรับลูกค้า
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ========================================================
  // VIEW 2: SELLER PORTAL DASHBOARD (When Authenticated)
  // ========================================================
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
      
      {/* 1. Seller Top Bar & Shop Info */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-amber-700 rounded-3xl p-4 sm:p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-yellow-300 shrink-0 border border-white/25">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black">{currentSeller.shopName}</h1>
              <span className="bg-white/20 text-yellow-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-white/20">
                User: {currentSeller.userId}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-teal-100 mt-0.5 flex-wrap">
              {isExpired ? (
                <span className="bg-red-500/90 text-white font-bold px-2 py-0.5 rounded-md text-[10px]">
                  ⚠️ บัญชีหมดอายุแล้ว
                </span>
              ) : (
                <span className="bg-emerald-500/90 text-white font-bold px-2 py-0.5 rounded-md text-[10px]">
                  🟢 ใช้งานได้ (เหลืออีก {remainingDays} วัน)
                </span>
              )}
              <span>หมดอายุ: {new Date(currentSeller.expiresAt).toLocaleDateString('th-TH')}</span>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-white/30"
            title="ดูหน้าร้านรวมมุมมองลูกค้า"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>ดูหน้าร้านรวม</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="ออกจากระบบผู้ขาย"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* Expiry Warning Banner if expired */}
      {isExpired && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-3xl text-red-900 flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-sm">บัญชีผู้ขายของคุณหมดอายุการใช้งานแล้ว</h4>
            <p>
              คุณไม่สามารถลงสินค้าใหม่หรือแก้ไขสินค้าได้ กรุณาติดต่อผู้ดูแลร้านขายถูกที่นี่ชุมแพเพื่อต่ออายุการใช้งาน
            </p>
          </div>
        </div>
      )}

      {/* 2. Seller Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>สินค้าของฉันทั้งหมด</span>
            <Boxes className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-stone-900">{totalProducts} รายการ</div>
          <p className="text-[10px] text-stone-400 mt-0.5">รวมสินค้าทุกหมวดหมู่ที่ลงขาย</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>พร้อมขาย (In Stock)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{inStockCount} รายการ</div>
          <p className="text-[10px] text-stone-400 mt-0.5">แสดงบนหน้าแรกให้ลูกค้าสั่งซื้อได้</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>สินค้าหมดสต็อก</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600">{outOfStockCount} รายการ</div>
          <p className="text-[10px] text-stone-400 mt-0.5">ถูกซ่อนจากหน้าร้านอัตโนมัติ</p>
        </div>
      </div>

      {/* 3. Products List Header & Action Button */}
      <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-teal-700" />
              <span>รายการสินค้าของร้าน {currentSeller.shopName}</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              สินค้าที่ลงขายที่นี่จะนำไป <strong>แสดงรวมที่หน้าแรกของร้านค้าทันทีแบบ Real-time</strong>
            </p>
          </div>

          <button
            type="button"
            disabled={isExpired}
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ ลงขายสินค้าใหม่</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-stone-50 px-3 py-2 rounded-xl border border-stone-200">
            <Search className="w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อสินค้าของคุณ..."
              className="w-full bg-transparent focus:outline-hidden text-xs text-stone-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-stone-400 hover:text-stone-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 cursor-pointer focus:outline-hidden"
          >
            <option value="all">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table of Seller's Products */}
        {filteredSellerProducts.length === 0 ? (
          <div className="p-10 text-center space-y-3 bg-stone-50 rounded-2xl border border-stone-200/80">
            <div className="w-14 h-14 rounded-full bg-teal-100/70 text-teal-800 flex items-center justify-center mx-auto text-2xl">
              🛍️
            </div>
            <h4 className="text-sm sm:text-base font-bold text-stone-800">
              {sellerProducts.length === 0
                ? 'คุณยังไม่มีสินค้าที่ลงขาย'
                : 'ไม่พบสินค้าตามคำค้นหา'}
            </h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {sellerProducts.length === 0
                ? 'คลิกปุ่ม "+ ลงขายสินค้าใหม่" ด้านบนเพื่อเพิ่มสินค้าของคุณเข้าสู่หน้าร้านรวม'
                : 'ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="p-3 font-bold">รูปภาพ & สินค้า</th>
                  <th className="p-3 font-bold">หมวดหมู่</th>
                  <th className="p-3 font-bold text-right">ราคาขาย</th>
                  <th className="p-3 font-bold text-center">สต็อก (ชิ้น)</th>
                  <th className="p-3 font-bold text-center">สถานะ</th>
                  <th className="p-3 font-bold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSellerProducts.map((prod) => {
                  const isOutOfStock = prod.stock <= 0;
                  const isLowStock = prod.stock > 0 && prod.stock <= 5;

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        isOutOfStock ? 'bg-red-50/20' : isLowStock ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Image & Name */}
                      <td className="p-3 align-middle">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.imageUrl || prod.images?.[0]}
                            alt={prod.name}
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-stone-200 bg-stone-100"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80';
                            }}
                          />
                          <div>
                            <div className="font-bold text-stone-900 text-xs sm:text-sm line-clamp-1">
                              {prod.name}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              หน่วย: {prod.unit}
                              {prod.condition && ` • ${prod.condition}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3 align-middle">
                        <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                          {prod.category}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="p-3 align-middle text-right font-bold text-red-600 text-sm">
                        ฿{prod.price.toLocaleString()}
                      </td>

                      {/* Stock Stepper */}
                      <td className="p-3 align-middle text-center">
                        <div className="inline-flex items-center gap-1 bg-stone-100 border border-stone-200 rounded-xl p-1">
                          <button
                            type="button"
                            disabled={prod.stock <= 0}
                            onClick={() => onUpdateStock(prod.id, Math.max(0, prod.stock - 1))}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-stone-200 text-stone-700 disabled:opacity-40 font-bold flex items-center justify-center cursor-pointer shadow-2xs text-xs"
                          >
                            -
                          </button>
                          <span className={`w-10 text-center font-bold text-xs ${isOutOfStock ? 'text-red-600' : ''}`}>
                            {prod.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateStock(prod.id, prod.stock + 1)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-stone-200 text-stone-700 font-bold flex items-center justify-center cursor-pointer shadow-2xs text-xs"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Active Status Toggle */}
                      <td className="p-3 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => onToggleActive(prod.id, !prod.isActive)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors border ${
                            prod.isActive && !isOutOfStock
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isOutOfStock
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : 'bg-stone-200 text-stone-600 border-stone-300'
                          }`}
                        >
                          {prod.isActive && !isOutOfStock
                            ? '🟢 เปิดขาย'
                            : isOutOfStock
                            ? '🔴 สินค้าหมด'
                            : '⚪ ปิดขาย'}
                        </button>
                      </td>

                      {/* Action buttons (Edit / Delete) */}
                      <td className="p-3 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(prod);
                              setIsProductModalOpen(true);
                            }}
                            className="p-1.5 text-stone-500 hover:text-teal-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขสินค้า"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`คุณต้องการลบสินค้า "${prod.name}" ใช่หรือไม่?`)) {
                                await onDeleteProduct(prod.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบสินค้า"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Product Create / Edit Modal for Seller */}
      {isProductModalOpen && (
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          product={editingProduct}
          categories={categories}
          sellerId={currentSeller.id}
          sellerName={currentSeller.shopName}
          onSave={async (data, isNew) => {
            await onSaveProduct(
              {
                ...data,
                sellerId: currentSeller.id,
                sellerName: currentSeller.shopName,
              },
              isNew,
              editingProduct?.id
            );
          }}
        />
      )}

    </div>
  );
};
