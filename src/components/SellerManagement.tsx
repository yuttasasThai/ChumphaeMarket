import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Key,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  ShoppingBag,
  Phone,
  Store,
  Sparkles,
  ShieldAlert,
  Share2,
} from 'lucide-react';
import { SellerAccount, ProductItem } from '../types';

interface SellerManagementProps {
  sellers: SellerAccount[];
  products: ProductItem[];
  onSaveSeller: (sellerData: Partial<SellerAccount>, isNew: boolean, id?: string) => Promise<void>;
  onDeleteSeller: (sellerId: string) => Promise<void>;
}

const MAX_SELLERS_LIMIT = 200;

export const SellerManagement: React.FC<SellerManagementProps> = ({
  sellers,
  products,
  onSaveSeller,
  onDeleteSeller,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<SellerAccount | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form inputs
  const [formUserId, setFormUserId] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formShopName, setFormShopName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLinkSlug, setFormLinkSlug] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  // Password visibility state per seller ID
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedSellerId, setCopiedSellerId] = useState<string | null>(null);
  const [copiedInfoId, setCopiedInfoId] = useState<string | null>(null);

  // Origin for links
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // Calculate seller status helper
  const isSellerExpired = (expiresAt: string) => {
    return new Date(expiresAt).getTime() < Date.now();
  };

  const getRemainingDays = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Products count per seller
  const sellerProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.sellerId) {
        counts[p.sellerId] = (counts[p.sellerId] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Open modal for creating new seller
  const handleOpenCreate = () => {
    if (sellers.length >= MAX_SELLERS_LIMIT) {
      alert(`ไม่สามารถเพิ่ม Seller ได้แล้ว เนื่องจากครบจำนวนจำกัด ${MAX_SELLERS_LIMIT} บัญชีแล้ว`);
      return;
    }

    setEditingSeller(null);
    const nextSeq = (sellers.length + 1).toString().padStart(3, '0');
    setFormUserId(`seller${nextSeq}`);
    setFormPassword(Math.random().toString(36).slice(-8));
    setFormShopName('');
    setFormPhone('');
    setFormLinkSlug(`seller${nextSeq}`);
    
    // Default expiration: +90 days from now
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 90);
    setFormExpiresAt(defaultExpiry.toISOString().slice(0, 10));

    setFormIsActive(true);
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for editing existing seller
  const handleOpenEdit = (seller: SellerAccount) => {
    setEditingSeller(seller);
    setFormUserId(seller.userId);
    setFormPassword(seller.password);
    setFormShopName(seller.shopName);
    setFormPhone(seller.phone || '');
    setFormLinkSlug(seller.linkSlug || seller.userId);
    setFormExpiresAt(seller.expiresAt ? seller.expiresAt.slice(0, 10) : '');
    setFormIsActive(seller.isActive ?? true);
    setFormNotes(seller.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Preset Expiry helper (+X days)
  const handleSetPresetExpiry = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setFormExpiresAt(d.toISOString().slice(0, 10));
  };

  // Submit create or edit seller
  const handleSubmitSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUser = formUserId.trim().toLowerCase();
    const cleanPass = formPassword.trim();
    const cleanShop = formShopName.trim();
    const cleanSlug = (formLinkSlug.trim() || cleanUser).toLowerCase().replace(/[^a-z0-9_-]/g, '');

    if (!cleanUser) {
      setFormError('กรุณาระบุ User ID สำหรับเข้าสู่ระบบ');
      return;
    }

    if (!cleanPass) {
      setFormError('กรุณาระบุรหัสผ่าน (Password)');
      return;
    }

    if (!cleanShop) {
      setFormError('กรุณาระบุชื่อร้านค้า หรือชื่อผู้ขาย');
      return;
    }

    if (!formExpiresAt) {
      setFormError('กรุณาระบุวันหมดอายุของบัญชีผู้ขาย');
      return;
    }

    // Check duplicate userId
    const isDuplicate = sellers.some(
      (s) => s.userId.toLowerCase() === cleanUser && s.id !== editingSeller?.id
    );
    if (isDuplicate) {
      setFormError(`User ID "${cleanUser}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`);
      return;
    }

    setIsSaving(true);
    try {
      const expiryDate = new Date(`${formExpiresAt}T23:59:59.999Z`).toISOString();
      const payload: Partial<SellerAccount> = {
        userId: cleanUser,
        password: cleanPass,
        shopName: cleanShop,
        phone: formPhone.trim(),
        linkSlug: cleanSlug,
        expiresAt: expiryDate,
        isActive: formIsActive,
        notes: formNotes.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (!editingSeller) {
        payload.createdAt = new Date().toISOString();
      }

      await onSaveSeller(payload, !editingSeller, editingSeller?.id);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล Seller');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy Seller Login Link
  const handleCopyLink = async (seller: SellerAccount) => {
    const link = `${origin}/seller?code=${encodeURIComponent(seller.linkSlug || seller.userId)}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
      }
      setCopiedSellerId(seller.id);
      setTimeout(() => setCopiedSellerId(null), 2500);
    } catch {
      alert(`ลิงก์สำหรับผู้ขาย: ${link}`);
    }
  };

  // Copy formatted Login Credentials for sending in LINE / Chat
  const handleCopyCredentials = async (seller: SellerAccount) => {
    const link = `${origin}/seller?code=${encodeURIComponent(seller.linkSlug || seller.userId)}`;
    const expiryFormatted = new Date(seller.expiresAt).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const text = `🛒 ข้อมูลเข้าสู่ระบบผู้ขาย (Seller) - ร้านขายถูกที่นี่ชุมแพ
🏪 ร้านค้า: ${seller.shopName}
🔗 ลิงก์สำหรับลงขายสินค้า:
👉 ${link}

👤 User ID: ${seller.userId}
🔑 Password: ${seller.password}
📅 วันหมดอายุ: ${expiryFormatted}

📌 คุณสามารถกดเข้าสู่ระบบผ่านลิงก์ด้านบน เพื่อลงขายสินค้า, แก้ไขราคา และปรับจำนวนสต็อกได้ทันที (สินค้าจะแสดงรวมที่หน้าร้านหลักของลูกค้าทั้งหมด)`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedInfoId(seller.id);
      setTimeout(() => setCopiedInfoId(null), 2500);
    } catch {
      alert('คัดลอกข้อมูลไม่สำเร็จ');
    }
  };

  // Toggle password view
  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered sellers list
  const filteredSellers = useMemo(() => {
    return sellers.filter((s) => {
      const matchSearch =
        searchQuery === '' ||
        s.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone && s.phone.includes(searchQuery));

      if (!matchSearch) return false;

      const expired = isSellerExpired(s.expiresAt);
      if (statusFilter === 'active') return s.isActive && !expired;
      if (statusFilter === 'expired') return expired;
      if (statusFilter === 'inactive') return !s.isActive;

      return true;
    });
  }, [sellers, searchQuery, statusFilter]);

  // Summary counts
  const totalSellers = sellers.length;
  const activeSellersCount = sellers.filter((s) => s.isActive && !isSellerExpired(s.expiresAt)).length;
  const expiredSellersCount = sellers.filter((s) => isSellerExpired(s.expiresAt)).length;
  const totalSellerProducts = Object.values(sellerProductCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      
      {/* 1. Header Banner & Limit Bar */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-amber-600 rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-yellow-200 text-xs font-bold border border-white/25">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ระบบจัดการผู้ขายร่วม (Multi-Seller Portal)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              จัดการ Seller และสร้างลิงก์ลงขายสินค้า
            </h2>
            <p className="text-xs sm:text-sm text-yellow-100 leading-relaxed">
              สร้างลิงก์และบัญชีผู้ใช้งาน (User ID / Password / วันหมดอายุ) ให้กับผู้ขาย โดยสินค้าที่ Seller ลงขายทั้งหมดจะนำไป
              <strong> รวมกันที่หน้าร้านหลักของลูกค้าทันที</strong> (จำกัดสูงสุด 200 ผู้ขาย)
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={totalSellers >= MAX_SELLERS_LIMIT}
            className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all shadow-lg active:scale-95 cursor-pointer bg-yellow-400 hover:bg-yellow-300 text-teal-950 disabled:opacity-50 disabled:cursor-not-allowed border border-yellow-200"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ สร้างบัญชี Seller ใหม่</span>
          </button>
        </div>

        {/* 200 User Capacity Indicator */}
        <div className="mt-5 pt-4 border-t border-white/20 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2 text-yellow-100">
              <Users className="w-4 h-4 text-yellow-300" />
              <span>ความจุบัญชีผู้ขาย (Quota): <strong>{totalSellers} / {MAX_SELLERS_LIMIT} บัญชี</strong></span>
            </span>
            <span className="text-white bg-white/20 px-2.5 py-0.5 rounded-full text-[11px]">
              {MAX_SELLERS_LIMIT - totalSellers > 0
                ? `ว่างอีก ${MAX_SELLERS_LIMIT - totalSellers} ที่`
                : 'ครบตามจำนวนจำกัดแล้ว'}
            </span>
          </div>

          <div className="w-full bg-black/30 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/20">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalSellers >= MAX_SELLERS_LIMIT
                  ? 'bg-red-400'
                  : totalSellers > 160
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, (totalSellers / MAX_SELLERS_LIMIT) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>Seller ทั้งหมด</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900">{totalSellers}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">จำกัดสูงสุด {MAX_SELLERS_LIMIT} คน</p>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>ใช้งานได้ (Active)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700">{activeSellersCount}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">ยังไม่หมดอายุและเปิดใช้งาน</p>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>หมดอายุ (Expired)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700">{expiredSellersCount}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">ต้องต่ออายุเพื่อลงขายต่อ</p>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>สินค้าที่ Seller ลง</span>
            <ShoppingBag className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-stone-900">{totalSellerProducts}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">แสดงรวมที่หน้าร้านหลัก</p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อร้านค้า, User ID, เบอร์โทร..."
            className="w-full bg-transparent focus:outline-hidden text-xs text-stone-800 placeholder:text-stone-400"
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

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            ทั้งหมด ({sellers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            ใช้งานได้ ({activeSellersCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'expired'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            หมดอายุ ({expiredSellersCount})
          </button>
        </div>
      </div>

      {/* 4. Sellers Table / Card List */}
      {filteredSellers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-10 sm:p-14 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto text-2xl">
            👥
          </div>
          <h3 className="text-base sm:text-lg font-bold text-stone-800">
            {sellers.length === 0 ? 'ยังไม่มีบัญชี Seller ในระบบ' : 'ไม่พบข้อมูล Seller ที่ค้นหา'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {sellers.length === 0
              ? 'คุณสามารถกดปุ่ม "+ สร้างบัญชี Seller ใหม่" ด้านบน เพื่อสร้าง User ID, Password, วันหมดอายุ และส่งลิงก์ให้ผู้ขายได้ทันที'
              : 'ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองสถานะ'}
          </p>
          {sellers.length === 0 && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              + สร้าง Seller บัญชีแรก
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="p-3.5 font-bold">ชื่อร้านค้า / ผู้ขาย</th>
                  <th className="p-3.5 font-bold">User ID & Password</th>
                  <th className="p-3.5 font-bold">ลิงก์เข้าสู่ระบบ Seller</th>
                  <th className="p-3.5 font-bold">วันหมดอายุ</th>
                  <th className="p-3.5 font-bold text-center">สินค้าที่ลง</th>
                  <th className="p-3.5 font-bold text-center">สถานะ</th>
                  <th className="p-3.5 font-bold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSellers.map((seller) => {
                  const expired = isSellerExpired(seller.expiresAt);
                  const remainingDays = getRemainingDays(seller.expiresAt);
                  const prodCount = sellerProductCounts[seller.id] || 0;
                  const isPassVisible = visiblePasswords[seller.id] || false;
                  const sellerPortalLink = `${origin}/seller?code=${encodeURIComponent(seller.linkSlug || seller.userId)}`;

                  return (
                    <tr
                      key={seller.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        expired ? 'bg-amber-50/20' : !seller.isActive ? 'bg-red-50/20 opacity-75' : ''
                      }`}
                    >
                      {/* Shop Name & Phone */}
                      <td className="p-3.5 align-middle">
                        <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-teal-700 shrink-0" />
                          <span>{seller.shopName}</span>
                        </div>
                        {seller.phone && (
                          <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-stone-400" />
                            <span>{seller.phone}</span>
                          </div>
                        )}
                        {seller.notes && (
                          <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-1.5 py-0.5 mt-1 inline-block">
                            โน้ต: {seller.notes}
                          </div>
                        )}
                      </td>

                      {/* User ID & Password */}
                      <td className="p-3.5 align-middle font-mono">
                        <div className="flex items-center gap-1 font-bold text-stone-800 text-xs">
                          <span className="text-stone-400 font-sans text-[10px]">User:</span>
                          <span className="bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                            {seller.userId}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-stone-400 font-sans text-[10px]">Pass:</span>
                          <span className="bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200 text-red-700 font-bold">
                            {isPassVisible ? seller.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(seller.id)}
                            className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                            title={isPassVisible ? 'ซ่อนรหัสผ่าน' : 'ดูรหัสผ่าน'}
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Seller Portal Link & Quick Share */}
                      <td className="p-3.5 align-middle">
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(seller)}
                              className={`px-2 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer border ${
                                copiedSellerId === seller.id
                                  ? 'bg-emerald-600 text-white border-emerald-700'
                                  : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                              }`}
                              title="คัดลอกลิงก์เข้าระบบ Seller"
                            >
                              {copiedSellerId === seller.id ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>คัดลอกลิงก์แล้ว!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-stone-500" />
                                  <span>คัดลอกลิงก์</span>
                                </>
                              )}
                            </button>

                            <a
                              href={sellerPortalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-stone-400 hover:text-teal-700 rounded-lg hover:bg-stone-100 transition-colors"
                              title="เปิดทดสอบหน้า Seller Portal ในแท็บใหม่"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(seller)}
                            className={`px-2 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer border ${
                              copiedInfoId === seller.id
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-200'
                            }`}
                            title="คัดลอกข้อความสรุปพร้อม User ID, รหัสผ่าน และลิงก์สำหรับส่งให้ผู้ขายใน LINE / Chat"
                          >
                            {copiedInfoId === seller.id ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>คัดลอกข้อมูลส่ง Seller แล้ว!</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="w-3 h-3" />
                                <span>คัดลอกข้อมูลส่ง LINE</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Expiration Date & Countdown */}
                      <td className="p-3.5 align-middle">
                        <div className="font-bold text-stone-800">
                          {new Date(seller.expiresAt).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        {expired ? (
                          <span className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>หมดอายุแล้ว ({Math.abs(remainingDays)} วันก่อน)</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>เหลืออีก {remainingDays} วัน</span>
                          </span>
                        )}
                      </td>

                      {/* Products Count */}
                      <td className="p-3.5 align-middle text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-black bg-stone-100 text-stone-800 border border-stone-200">
                          {prodCount} ชิ้น
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 align-middle text-center">
                        {!seller.isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-600">
                            ระงับใช้งาน
                          </span>
                        ) : expired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            หมดอายุ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            🟢 ใช้งานได้
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(seller)}
                            className="p-1.5 text-stone-500 hover:text-teal-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขข้อมูล Seller หรือต่ออายุ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              if (
                                window.confirm(
                                  `คุณต้องการลบบัญชีผู้ขาย "${seller.shopName}" (${seller.userId}) ใช่หรือไม่?`
                                )
                              ) {
                                await onDeleteSeller(seller.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบบัญชีผู้ขายนี้"
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
        </div>
      )}

      {/* 5. Create / Edit Seller Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-700 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-yellow-300" />
                <h3 className="font-bold text-base sm:text-lg">
                  {editingSeller ? 'แก้ไขข้อมูลผู้ขาย (Seller)' : 'สร้างบัญชี Seller ใหม่'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitSeller} className="p-6 overflow-y-auto space-y-4 text-xs">
              
              {formError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Shop Name */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  ชื่อร้านค้า หรือชื่อผู้ขาย <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formShopName}
                  onChange={(e) => setFormShopName(e.target.value)}
                  placeholder="เช่น ร้านสมชายของเล่น, เจ๊นิดเครื่องใช้ไฟฟ้า"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-xs"
                />
              </div>

              {/* User ID and Password in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    User ID (ชื่อผู้ใช้) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUserId}
                    onChange={(e) => {
                      setFormUserId(e.target.value);
                      if (!editingSeller) {
                        setFormLinkSlug(e.target.value);
                      }
                    }}
                    placeholder="เช่น seller001, somchai"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-xs font-mono"
                  />
                  <span className="text-[10px] text-stone-400">ใช้สำหรับล็อกอินเข้า Seller Portal</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-stone-800">
                      Password (รหัสผ่าน) <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormPassword(Math.random().toString(36).slice(-8))}
                      className="text-[10px] text-teal-700 hover:underline font-bold cursor-pointer"
                    >
                      สุ่มรหัสผ่าน
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Phone & Link Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    เบอร์โทรติดต่อผู้ขาย
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    รหัสต่อท้ายลิงก์ (Link Slug)
                  </label>
                  <input
                    type="text"
                    value={formLinkSlug}
                    onChange={(e) => setFormLinkSlug(e.target.value)}
                    placeholder="seller001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600 text-xs font-mono"
                  />
                  <span className="text-[10px] text-stone-400">/seller?code={formLinkSlug || 'code'}</span>
                </div>
              </div>

              {/* Expiration Date with Presets */}
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-stone-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-700" />
                    <span>วันหมดอายุการใช้งาน (Expires At) <span className="text-red-500">*</span></span>
                  </label>
                </div>

                <input
                  type="date"
                  required
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-white font-bold text-xs focus:outline-hidden focus:border-teal-600"
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-stone-400">ปุ่มลัด:</span>
                  <button
                    type="button"
                    onClick={() => handleSetPresetExpiry(30)}
                    className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-200 text-[10px] font-semibold cursor-pointer"
                  >
                    +30 วัน
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetExpiry(90)}
                    className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-200 text-[10px] font-semibold cursor-pointer"
                  >
                    +90 วัน (3 เดือน)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetExpiry(180)}
                    className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-200 text-[10px] font-semibold cursor-pointer"
                  >
                    +180 วัน (6 เดือน)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetExpiry(365)}
                    className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-700 rounded-md border border-stone-200 text-[10px] font-semibold cursor-pointer"
                  >
                    +1 ปี
                  </button>
                </div>
              </div>

              {/* Status & Notes */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sellerActiveCheck"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="sellerActiveCheck" className="font-bold text-stone-800 cursor-pointer">
                    เปิดใช้งานบัญชีผู้ขายนี้ (Active)
                  </label>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    หมายเหตุภายในของร้าน (Notes)
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="เช่น ชำระค่าธรรมเนียมรายปีแล้ว, แผงล็อก C4 ตลาดชุมแพ"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'กำลังบันทึก...' : editingSeller ? 'บันทึกการแก้ไข' : 'ยืนยันสร้าง Seller'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
