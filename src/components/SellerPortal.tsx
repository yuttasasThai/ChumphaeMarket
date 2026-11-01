import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Bell,
  Volume2,
  VolumeX,
  Phone,
  MessageCircle,
  Send,
  UserPlus,
  Copy,
  Share2,
  QrCode,
  MapPin,
  Calendar,
  FileCheck,
  RotateCcw,
} from 'lucide-react';
import { SellerAccount, ProductItem, Category, Order, OrderStatus } from '../types';
import { ProductModal } from './ProductModal';
import { playSellerOrderSound, unlockAudio } from '../utils/sound';
import { sendSellerActivationLine, sendSellerLineTest } from '../utils/lineNotifyClient';
import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';

interface SellerPortalProps {
  sellers: SellerAccount[];
  products: ProductItem[];
  categories: Category[];
  orders?: Order[];
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
  orders = [],
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

  // Active view tab when logged in: 'products' | 'orders' | 'line'
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'line'>('products');

  // Sound alert preference
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundTestSuccess, setSoundTestSuccess] = useState(false);

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

  // Registration modal & state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regShopName, setRegShopName] = useState('');
  const [regSellerName, setRegSellerName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regLineId, setRegLineId] = useState('');
  const [regLineNotifyToken, setRegLineNotifyToken] = useState('');
  const [regUserId, setRegUserId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccessData, setRegSuccessData] = useState<{
    activationUrl: string;
    lineShareUrl: string;
    shopName: string;
    lineSent: boolean;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Activation banner state from URL
  const [activationAlert, setActivationAlert] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Modal for adding / editing product
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Orders filter
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'preparing' | 'completed'>('all');

  // LINE settings within seller dashboard
  const [editLineToken, setEditLineToken] = useState('');
  const [editLineId, setEditLineId] = useState('');
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [lineStatusMsg, setLineStatusMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Previous orders count reference for sound alert
  const prevSellerOrderCountRef = useRef<number | null>(null);

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

  // Handle URL ?activate=TOKEN on mount
  useEffect(() => {
    const handleUrlActivation = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('activate');
        if (!token) return;

        // Find seller with this activationToken
        let targetSeller = sellers.find((s) => s.activationToken === token);

        if (!targetSeller) {
          // Query Firestore directly
          const q = query(collection(db, 'sellers'), where('activationToken', '==', token));
          const snap = await getDocs(q);
          if (!snap.empty) {
            targetSeller = { id: snap.docs[0].id, ...snap.docs[0].data() } as SellerAccount;
          }
        }

        if (targetSeller) {
          // Activate seller
          await updateDoc(doc(db, 'sellers', targetSeller.id), {
            isActivated: true,
            isActive: true,
            activatedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          setActivationAlert({
            type: 'success',
            message: `🎉 ยืนยันร้านค้า "${targetSeller.shopName}" ผ่าน LINE เรียบร้อยแล้ว! ร้านของคุณเปิดใช้งานแล้ว คุณสามารถเข้าสู่ระบบด้านล่างได้ทันที`,
          });
          setLoginUserId(targetSeller.userId);
        } else {
          setActivationAlert({
            type: 'error',
            message: 'ไม่พบรหัสยืนยันการเปิดใช้งาน หรือลิงก์นี้หมดอายุแล้ว กรุณาติดต่อผู้ดูแลร้าน',
          });
        }
      } catch (err: any) {
        console.warn('Activation error:', err);
        setActivationAlert({
          type: 'error',
          message: `เกิดข้อผิดพลาดในการยืนยัน: ${err?.message || err}`,
        });
      }
    };

    handleUrlActivation();
  }, [sellers]);

  // Sync edit LINE token state when seller logs in
  useEffect(() => {
    if (currentSeller) {
      setEditLineToken(currentSeller.lineNotifyToken || '');
      setEditLineId(currentSeller.lineId || '');
    }
  }, [currentSeller]);

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

  // Filter orders that contain items belonging to this seller
  const sellerOrders = useMemo(() => {
    if (!currentSeller) return [];
    return orders.filter((o) =>
      o.items?.some((it) => it.sellerId === currentSeller.id)
    );
  }, [orders, currentSeller]);

  const pendingSellerOrdersCount = useMemo(() => {
    return sellerOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
  }, [sellerOrders]);

  const filteredSellerOrders = useMemo(() => {
    if (orderFilter === 'all') return sellerOrders;
    if (orderFilter === 'pending') {
      return sellerOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed');
    }
    if (orderFilter === 'preparing') {
      return sellerOrders.filter((o) => o.status === 'preparing');
    }
    if (orderFilter === 'completed') {
      return sellerOrders.filter((o) => o.status === 'completed' || o.status === 'delivering');
    }
    return sellerOrders;
  }, [sellerOrders, orderFilter]);

  // Sound alert on new incoming orders for this seller
  useEffect(() => {
    if (!currentSeller || !soundEnabled) return;

    if (
      prevSellerOrderCountRef.current !== null &&
      sellerOrders.length > prevSellerOrderCountRef.current
    ) {
      playSellerOrderSound(currentSeller.shopName);
    }

    prevSellerOrderCountRef.current = sellerOrders.length;
  }, [sellerOrders, currentSeller, soundEnabled]);

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
      if (seller.isActive === false && seller.isActivated === false) {
        setLoginError('บัญชีผู้ขายนี้ยังไม่ได้ยืนยันเปิดใช้งานผ่าน LINE กรุณาแตะลิงก์ยืนยันใน LINE ก่อนเข้าสู่ระบบ');
        return;
      }

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
      unlockAudio();
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

  // Test sound alert
  const handleTestSound = () => {
    unlockAudio();
    playSellerOrderSound(currentSeller?.shopName || 'ร้านค้าของคุณ');
    setSoundTestSuccess(true);
    setTimeout(() => setSoundTestSuccess(false), 3000);
  };

  // Handle Register Co-Seller
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const shop = regShopName.trim();
    const user = regUserId.trim().toLowerCase();
    const pass = regPassword.trim();
    const phone = regPhone.trim();
    const lineId = regLineId.trim();
    const token = regLineNotifyToken.trim();

    if (!shop || !user || !pass || !phone) {
      setRegError('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
      return;
    }

    if (sellers.some((s) => s.userId.toLowerCase() === user)) {
      setRegError(`User ID "${user}" มีผู้ใช้งานแล้ว กรุณาเลือก User ID อื่น`);
      return;
    }

    setRegSubmitting(true);
    try {
      const newId = doc(collection(db, 'sellers')).id;
      const activationToken = `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 90);

      const newSellerData: SellerAccount = {
        id: newId,
        userId: user,
        password: pass,
        shopName: shop,
        phone,
        lineId,
        lineNotifyToken: token,
        lineNotifyEnabled: Boolean(token),
        linkSlug: user,
        expiresAt: defaultExpiry.toISOString(),
        isActive: false, // Inactive until activated via LINE
        isActivated: false,
        activationToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'sellers', newId), newSellerData);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const activationUrl = `${origin}/seller?activate=${activationToken}`;
      const lineMsg = `สวัสดีครับ ยืนยันการเปิดร้านค้า "${shop}" บนระบบขายถูกที่นี่ชุมแพ แตะลิงก์นี้เพื่อเปิดใช้งาน: ${activationUrl}`;
      const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(lineMsg)}`;

      let lineSent = false;
      if (token) {
        try {
          const sendRes = await sendSellerActivationLine(token, shop, activationUrl);
          lineSent = sendRes.success;
        } catch (lineErr) {
          console.warn('Failed to dispatch LINE activation notify:', lineErr);
        }
      }

      setRegSuccessData({
        activationUrl,
        lineShareUrl,
        shopName: shop,
        lineSent,
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      setRegError(err?.message || 'เกิดข้อผิดพลาดในการลงทะเบียนร้านค้า');
    } finally {
      setRegSubmitting(false);
    }
  };

  // Handle Save LINE settings from seller dashboard
  const handleSaveLineSettings = async () => {
    if (!currentSeller) return;
    setIsSavingLine(true);
    setLineStatusMsg(null);
    try {
      const cleanToken = editLineToken.trim();
      const cleanLineId = editLineId.trim();

      await updateDoc(doc(db, 'sellers', currentSeller.id), {
        lineNotifyToken: cleanToken,
        lineId: cleanLineId,
        lineNotifyEnabled: Boolean(cleanToken),
        updatedAt: new Date().toISOString(),
      });

      const updated = {
        ...currentSeller,
        lineNotifyToken: cleanToken,
        lineId: cleanLineId,
        lineNotifyEnabled: Boolean(cleanToken),
      };
      setCurrentSeller(updated);
      sessionStorage.setItem('chumphae_seller_session', JSON.stringify(updated));

      setLineStatusMsg({ success: true, text: 'บันทึกการตั้งค่า LINE สำเร็จแล้ว!' });
    } catch (err: any) {
      setLineStatusMsg({ success: false, text: err?.message || 'เกิดข้อผิดพลาดในการบันทึก' });
    } finally {
      setIsSavingLine(false);
    }
  };

  // Test LINE Notify from seller dashboard
  const handleTestLineNotify = async () => {
    if (!currentSeller) return;
    const tokenToTest = editLineToken.trim() || currentSeller.lineNotifyToken;
    if (!tokenToTest) {
      setLineStatusMsg({ success: false, text: 'กรุณากรอก LINE Notify Token ก่อนทดสอบ' });
      return;
    }

    setIsTestingLine(true);
    setLineStatusMsg(null);
    try {
      const res = await sendSellerLineTest(tokenToTest, currentSeller.shopName);
      if (res.success) {
        setLineStatusMsg({ success: true, text: 'ส่งข้อความทดสอบเข้า LINE เรียบร้อยแล้ว! ตรวจสอบแชท LINE ของคุณได้เลย 🎉' });
      } else {
        setLineStatusMsg({ success: false, text: res.message || 'ทดสอบไม่สำเร็จ กรุณาตรวจสอบ Token อีกครั้ง' });
      }
    } catch (err: any) {
      setLineStatusMsg({ success: false, text: err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' });
    } finally {
      setIsTestingLine(false);
    }
  };

  // Quick mark order prepared by seller
  const handleMarkOrderPrepared = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'preparing',
        updatedAt: new Date().toISOString(),
      });
      alert('อัปเดตสถานะเป็น "กำลังจัดเตรียมสินค้า" เรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err?.message || err}`);
    }
  };

  // Check current seller expiration
  const isExpired = currentSeller ? new Date(currentSeller.expiresAt).getTime() < Date.now() : false;
  const remainingDays = currentSeller
    ? Math.ceil((new Date(currentSeller.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // Product counts
  const totalProducts = sellerProducts.length;
  const inStockCount = sellerProducts.filter((p) => p.isActive && p.stock > 0).length;
  const outOfStockCount = sellerProducts.filter((p) => p.stock <= 0).length;

  // ========================================================
  // VIEW 1: SELLER LOGIN & REGISTRATION SCREEN
  // ========================================================
  if (!currentSeller) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-3 sm:p-4 bg-stone-100/60">
        <div className="bg-white rounded-3xl border border-teal-200 shadow-xl max-w-lg w-full overflow-hidden">
          
          {/* Header */}
          <div className="px-6 py-6 bg-gradient-to-r from-teal-800 via-teal-700 to-amber-700 text-white text-center space-y-1.5">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto text-yellow-300 shadow-xs border border-white/20">
              <Store className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black tracking-tight">เข้าสู่ระบบผู้ขาย (Seller Portal)</h2>
            <p className="text-xs text-teal-100 max-w-sm mx-auto">
              ระบบสำหรับผู้ขายร่วมลงรายการสินค้า ดูออเดอร์ และรับแจ้งเตือนผ่าน LINE
            </p>
          </div>

          {/* Activation Alert if redirected with ?activate= */}
          {activationAlert && (
            <div
              className={`p-4 mx-6 mt-4 rounded-2xl text-xs font-bold flex items-start gap-2.5 ${
                activationAlert.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                  : 'bg-red-50 text-red-900 border border-red-300'
              }`}
            >
              {activationAlert.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span className="leading-relaxed">{activationAlert.message}</span>
            </div>
          )}

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
                  placeholder="เช่น seller001 หรือ seller_phen"
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
                className="w-full py-3 bg-gradient-to-r from-teal-700 to-teal-600 hover:from-teal-800 hover:to-teal-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>เข้าสู่ระบบจัดการสินค้าและออเดอร์</span>
              </button>
            </form>

            {/* Registration Banner button */}
            <div className="pt-3 border-t border-stone-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setRegError(null);
                  setRegSuccessData(null);
                  setIsRegisterOpen(true);
                }}
                className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
              >
                <UserPlus className="w-4 h-4 text-amber-700" />
                <span>ยังไม่มีบัญชี? สมัครเปิดร้านค้า / ผู้ขายร่วม (ยืนยันผ่าน LINE)</span>
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="text-xs text-stone-500 hover:text-stone-800 hover:underline cursor-pointer"
                >
                  ← กลับสู่หน้าร้านสำหรับลูกค้า
                </button>
              </div>
            </div>
          </div>

          {/* Registration Modal */}
          {isRegisterOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
                <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-800 to-emerald-800 text-white flex items-center justify-between sticky top-0 z-10 border-b border-teal-700">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-yellow-300" />
                    <h3 className="font-bold text-base">สมัครเปิดร้านค้า / ผู้ขายร่วม</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="p-1.5 text-teal-200 hover:text-white rounded-lg hover:bg-white/10"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-4 text-xs">
                  {regSuccessData ? (
                    <div className="space-y-4 animate-in fade-in">
                      <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-950 space-y-2">
                        <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>ลงทะเบียนร้านค้าสำเร็จแล้ว! (ขั้นตอนสุดท้าย: ยืนยันผ่าน LINE)</span>
                        </div>
                        <p className="text-xs text-emerald-800 leading-relaxed">
                          ร้านค้า: <strong>{regSuccessData.shopName}</strong>
                          <br />
                          {regSuccessData.lineSent ? (
                            <span className="text-emerald-700 font-bold">
                              ✓ ส่งลิงก์เปิดใช้งานเข้า LINE ของคุณเรียบร้อยแล้ว แตะลิงก์ใน LINE เพื่อเปิดใช้งานได้ทันที!
                            </span>
                          ) : (
                            <span>
                              กรุณาส่งหรือเปิดลิงก์ด้านล่างนี้ใน LINE เพื่อเปิดใช้งานร้านค้าของคุณครับ
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Direct LINE Share Button */}
                      <a
                        href={regSuccessData.lineShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-black rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 text-center text-sm"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span>📲 แตะส่งลิงก์ยืนยันเข้า LINE ของฉันทันที (LINE Share)</span>
                      </a>

                      {/* Direct Activation on this device */}
                      <a
                        href={regSuccessData.activationUrl}
                        className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-2xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 text-center text-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>เปิดใช้งานบนอุปกรณ์นี้ทันที (Activate Now)</span>
                      </a>

                      {/* Copy Link */}
                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                        <div className="text-[11px] font-bold text-stone-600">ลิงก์เปิดใช้งาน:</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={regSuccessData.activationUrl}
                            className="flex-1 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200 text-[10px] font-mono text-stone-700"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(regSuccessData.activationUrl);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2500);
                            }}
                            className="px-3 py-1.5 bg-stone-800 text-white rounded-lg font-bold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedLink ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3">
                      {regError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span>{regError}</span>
                        </div>
                      )}

                      <div>
                        <label className="block font-bold text-stone-700 mb-1">
                          ชื่อร้านค้าของคุณ <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={regShopName}
                          onChange={(e) => setRegShopName(e.target.value)}
                          placeholder="เช่น ป้าเพ็ญไก่ย่าง หรือ สวนผักชุมแพ"
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">
                            ชื่อ-นามสกุล ผู้ขาย <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={regSellerName}
                            onChange={(e) => setRegSellerName(e.target.value)}
                            placeholder="เช่น เพ็ญศิริ มีชัย"
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-stone-700 mb-1">
                            เบอร์โทรศัพท์ติดต่อ <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            required
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="08X-XXX-XXXX"
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-teal-600"
                          />
                        </div>
                      </div>

                      {/* LINE Section */}
                      <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-2">
                        <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                          <MessageCircle className="w-4 h-4 text-[#06C755]" />
                          <span>ข้อมูล LINE สำหรับรับการแจ้งเตือนออเดอร์</span>
                        </div>

                        <div>
                          <label className="block font-semibold text-stone-700 mb-0.5 text-[11px]">
                            LINE ID ของคุณ (สำหรับให้แอดมินติดต่อ)
                          </label>
                          <input
                            type="text"
                            value={regLineId}
                            onChange={(e) => setRegLineId(e.target.value)}
                            placeholder="เช่น pa_phen68"
                            className="w-full px-3 py-1.5 bg-white rounded-lg border border-stone-200 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-stone-700 mb-0.5 text-[11px]">
                            LINE Notify Token (รับข้อความแจ้งเตือนออเดอร์เข้าไลน์ทันที)
                          </label>
                          <input
                            type="text"
                            value={regLineNotifyToken}
                            onChange={(e) => setRegLineNotifyToken(e.target.value)}
                            placeholder="วาง Token เช่น lk4h98... (ถ้ามี)"
                            className="w-full px-3 py-1.5 bg-white rounded-lg border border-stone-200 font-mono text-[11px] focus:outline-hidden"
                          />
                          <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
                            💡 วิธีรับ Token ฟรี: เข้าเว็บ <a href="https://notify-bot.line.me" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">notify-bot.line.me</a> ล็อกอินด้วย LINE แล้วกดสร้าง Token เลือก 1-on-1 chat (สามารถใส่ภายหลังได้)
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-bold text-stone-700 mb-1">
                            User ID ที่ต้องการใช้ <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={regUserId}
                            onChange={(e) => setRegUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            placeholder="เช่น seller_phen"
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 font-mono focus:outline-hidden focus:border-teal-600"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-stone-700 mb-1">
                            รหัสผ่าน (Password) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 font-mono focus:outline-hidden focus:border-teal-600"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={regSubmitting}
                          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 text-xs sm:text-sm"
                        >
                          <Send className="w-4 h-4" />
                          <span>{regSubmitting ? 'กำลังส่งข้อมูล...' : 'สมัครและสร้างลิงก์ยืนยันผ่าน LINE'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ========================================================
  // VIEW 2: SELLER PORTAL DASHBOARD (Authenticated)
  // ========================================================
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-5">
      
      {/* 1. Seller Top Bar & Shop Info */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-amber-700 rounded-3xl p-4 sm:p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-yellow-300 shrink-0 border border-white/25 shadow-xs">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black">{currentSeller.shopName}</h1>
              <span className="bg-white/20 text-yellow-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-white/20">
                User: {currentSeller.userId}
              </span>
              {currentSeller.isActivated ? (
                <span className="bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  ✓ ยืนยันผ่าน LINE แล้ว
                </span>
              ) : (
                <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  รอยืนยัน
                </span>
              )}
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

        {/* Top Actions: Sound toggle, Test sound, View storefront, Logout */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
          {/* Test Sound button */}
          <button
            type="button"
            onClick={handleTestSound}
            className="flex items-center gap-1.5 px-3 py-2 bg-yellow-400 hover:bg-yellow-300 text-stone-900 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs"
            title="กดเพื่อทดสอบเสียงเตือนออเดอร์ใหม่"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{soundTestSuccess ? '✓ กำลังส่งเสียง...' : 'ทดสอบเสียงเตือน'}</span>
          </button>

          {/* Sound toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
              soundEnabled
                ? 'bg-emerald-600/80 text-white border-emerald-400'
                : 'bg-stone-800 text-stone-400 border-stone-600'
            }`}
            title={soundEnabled ? 'ปิดเสียงเตือน' : 'เปิดเสียงเตือน'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'เสียง: เปิด' : 'เสียง: ปิด'}</span>
          </button>

          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-white/30"
            title="ดูหน้าร้านรวมมุมมองลูกค้า"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">หน้าร้านรวม</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="ออกจากระบบผู้ขาย"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ออก</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveTab('orders')}
          className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
            activeTab === 'orders' ? 'border-amber-500 ring-2 ring-amber-300' : 'border-stone-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>ออเดอร์ของร้านฉัน</span>
            <Bell className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-amber-700">{sellerOrders.length}</div>
            {pendingSellerOrdersCount > 0 && (
              <span className="text-[11px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full animate-pulse">
                รอจัดเตรียม {pendingSellerOrdersCount}
              </span>
            )}
          </div>
          <p className="text-[10px] text-stone-400 mt-0.5">แตะเพื่อดูคำสั่งซื้อที่ต้องส่ง</p>
        </div>

        <div
          onClick={() => setActiveTab('products')}
          className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
            activeTab === 'products' ? 'border-teal-500 ring-2 ring-teal-300' : 'border-stone-200 hover:border-teal-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>สินค้าทั้งหมด</span>
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

        <div
          onClick={() => setActiveTab('line')}
          className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs ${
            activeTab === 'line' ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-stone-200 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-stone-500 font-bold mb-1">
            <span>แจ้งเตือน LINE</span>
            <MessageCircle className="w-4 h-4 text-[#06C755]" />
          </div>
          <div className="text-base font-black text-emerald-700 mt-1">
            {currentSeller.lineNotifyToken ? '🟢 เชื่อมต่อแล้ว' : '⚪ ยังไม่ตั้งค่า'}
          </div>
          <p className="text-[10px] text-stone-400 mt-0.5">แตะเพื่อทดสอบ / ตั้งค่า LINE</p>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'products'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>สินค้าของฉัน ({totalProducts})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer relative ${
            activeTab === 'orders'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>คำสั่งซื้อของฉัน ({sellerOrders.length})</span>
          {pendingSellerOrdersCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('line')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'line'
              ? 'bg-[#06C755] text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>ตั้งค่า LINE แจ้งเตือน</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SELLER PRODUCTS LIST                              */}
      {/* ======================================================== */}
      {activeTab === 'products' && (
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
                  : 'ลองเปลี่ยนคำค้นหาหรือหมวดหมู่สินค้า'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSellerProducts.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-stone-200 rounded-2xl p-3 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between gap-3"
                >
                  <div className="flex gap-3">
                    <img
                      src={p.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'}
                      alt={p.name}
                      className="w-20 h-20 rounded-xl object-cover shrink-0 bg-stone-100 border border-stone-100"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-md border border-teal-100 truncate">
                          {p.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {p.isActive ? 'เปิดขาย' : 'ปิดอยู่'}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate" title={p.name}>
                        {p.name}
                      </h4>
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-red-600 text-sm">฿{p.price.toLocaleString()}</span>
                        <span className="text-[11px] text-stone-400">/{p.unit}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-stone-600">
                        สต็อก: <span className={p.stock > 0 ? 'text-emerald-600' : 'text-red-500'}>{p.stock}</span> {p.unit}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      disabled={isExpired}
                      onClick={() => {
                        setEditingProduct(p);
                        setIsProductModalOpen(true);
                      }}
                      className="flex-1 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>แก้ไข</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExpired}
                      onClick={() => onToggleActive(p.id, !p.isActive)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                        p.isActive ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                      title={p.isActive ? 'ปิดการขายชั่วคราว' : 'เปิดขายทันที'}
                    >
                      {p.isActive ? 'ซ่อน' : 'เปิด'}
                    </button>

                    <button
                      type="button"
                      disabled={isExpired}
                      onClick={() => {
                        if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า "${p.name}"?`)) {
                          onDeleteProduct(p.id);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                      title="ลบสินค้านี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SELLER ORDERS LIST (ออเดอร์ของฉัน)                  */}
      {/* ======================================================== */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-600" />
                <span>คำสั่งซื้อสินค้าในร้านของคุณ ({sellerOrders.length} ออเดอร์)</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                รายการออเดอร์ที่มีสินค้าจากร้านของคุณ พร้อมข้อมูลการจัดส่งและช่องทางติดต่อลูกค้า
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setOrderFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  orderFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                ทั้งหมด ({sellerOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  orderFilter === 'pending' ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                รอรับ/จัดเตรียม ({pendingSellerOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  orderFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                ส่งแล้ว
              </button>
            </div>
          </div>

          {filteredSellerOrders.length === 0 ? (
            <div className="p-10 text-center space-y-3 bg-stone-50 rounded-2xl border border-stone-200/80">
              <div className="w-14 h-14 rounded-full bg-amber-100/70 text-amber-800 flex items-center justify-center mx-auto text-2xl">
                📦
              </div>
              <h4 className="text-sm sm:text-base font-bold text-stone-800">
                {sellerOrders.length === 0
                  ? 'ยังไม่มีคำสั่งซื้อสินค้าในร้านของคุณ'
                  : 'ไม่พบออเดอร์ตามตัวกรองที่เลือก'}
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                เมื่อลูกค้าสั่งซื้อสินค้าจากร้านของคุณ ระบบจะส่งเสียงเตือน และส่งข้อความเข้า LINE ทันทีครับ
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSellerOrders.map((order) => {
                // Filter only items in this order that belong to this seller
                const myItems = (order.items || []).filter((it) => it.sellerId === currentSeller.id);
                const mySubtotal = myItems.reduce((acc, it) => acc + (it.subtotal || it.price * it.quantity), 0);

                let statusBadge = (
                  <span className="bg-yellow-100 text-yellow-900 border border-yellow-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
                    ⏳ รอรับออเดอร์
                  </span>
                );
                if (order.status === 'preparing') {
                  statusBadge = (
                    <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
                      🍳 กำลังจัดเตรียม
                    </span>
                  );
                } else if (order.status === 'delivering') {
                  statusBadge = (
                    <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
                      🛵 ไรเดอร์กำลังนำส่ง
                    </span>
                  );
                } else if (order.status === 'completed') {
                  statusBadge = (
                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
                      ✓ ส่งสำเร็จแล้ว
                    </span>
                  );
                } else if (order.status === 'cancelled') {
                  statusBadge = (
                    <span className="bg-red-100 text-red-900 border border-red-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
                      ✕ ยกเลิกแล้ว
                    </span>
                  );
                }

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl border border-stone-200 bg-white shadow-xs space-y-3 hover:border-amber-300 transition-colors"
                  >
                    {/* Order Head */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-sm text-stone-900">
                          #{order.orderNumber || order.id}
                        </span>
                        {statusBadge}
                        <span className="text-[11px] text-stone-500">
                          {order.createdAt ? new Date(order.createdAt).toLocaleString('th-TH') : ''}
                        </span>
                      </div>

                      {/* Customer Contact */}
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>โทรหาลูกค้า: {order.customerPhone}</span>
                        </a>
                      </div>
                    </div>

                    {/* Customer & Delivery Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700 bg-stone-50/80 p-3 rounded-xl border border-stone-200/70">
                      <div>
                        <span className="font-bold text-stone-900">ลูกค้า: </span>
                        <span>{order.customerName}</span>
                      </div>
                      <div>
                        <span className="font-bold text-stone-900">รูปแบบรับสินค้า: </span>
                        <span className="text-amber-800 font-bold">
                          {order.fulfillmentType === 'pickup'
                            ? 'มารับเองที่ร้านชุมแพ'
                            : order.fulfillmentType === 'meetup'
                            ? 'นัดรับสินค้า'
                            : 'จัดส่งถึงที่'}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-bold text-stone-900">ที่อยู่จัดส่ง: </span>
                        <span className="text-stone-600">{order.deliveryAddress || '-'}</span>
                      </div>
                      {order.notes && (
                        <div className="sm:col-span-2 text-red-700 font-medium">
                          <span className="font-bold">หมายเหตุลูกค้า: </span>
                          <span>{order.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Items belonging to this seller */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-xs font-bold text-stone-800 flex items-center justify-between">
                        <span>🛍️ สินค้าของร้านคุณที่ต้องจัดเตรียม ({myItems.length} รายการ):</span>
                        <span className="text-amber-800 font-black text-xs sm:text-sm">
                          ยอดรวมร้านคุณ: ฿{mySubtotal.toLocaleString()}
                        </span>
                      </div>

                      <div className="divide-y divide-stone-100 bg-amber-50/40 rounded-xl p-2.5 border border-amber-200/60">
                        {myItems.map((it, idx) => (
                          <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-stone-900">{it.name}</span>
                              <span className="text-stone-500">
                                x {it.quantity} {it.unit || 'ชิ้น'}
                              </span>
                            </div>
                            <span className="font-bold text-stone-900">
                              ฿{(it.subtotal || it.price * it.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action buttons for seller */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 flex-wrap">
                      <div className="text-[11px] text-stone-500">
                        จัดส่งร่วมกับสินค้าหลักร้านชุมแพ (แอดมินช่วยติดตามการส่ง)
                      </div>
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleMarkOrderPrepared(order.id)}
                          className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>แจ้งเตรียมสินค้าแล้ว (พร้อมส่ง)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LINE NOTIFICATION SETTINGS                         */}
      {/* ======================================================== */}
      {activeTab === 'line' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#06C755]/10 text-[#06C755] flex items-center justify-center shrink-0 border border-[#06C755]/20">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900">
                ตั้งค่าระบบแจ้งเตือนออเดอร์เข้า LINE ผู้ขาย
              </h3>
              <p className="text-xs text-stone-500">
                เมื่อมีลูกค้าสั่งซื้อสินค้าในร้านของคุณ ระบบจะส่งข้อความแจ้งเตือนเข้าแชท LINE ของคุณทันที
              </p>
            </div>
          </div>

          {lineStatusMsg && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2 ${
                lineStatusMsg.success
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                  : 'bg-red-50 text-red-900 border border-red-300'
              }`}
            >
              {lineStatusMsg.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{lineStatusMsg.text}</span>
            </div>
          )}

          <div className="space-y-4 max-w-xl text-xs">
            <div>
              <label className="block font-bold text-stone-700 mb-1">
                LINE ID ของคุณ (สำหรับติดต่อ)
              </label>
              <input
                type="text"
                value={editLineId}
                onChange={(e) => setEditLineId(e.target.value)}
                placeholder="เช่น pa_phen68"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">
                LINE Notify Token ของร้านคุณ
              </label>
              <input
                type="text"
                value={editLineToken}
                onChange={(e) => setEditLineToken(e.target.value)}
                placeholder="เช่น qwert12345yuiop..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 font-mono text-xs focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2 text-stone-700">
              <div className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                <span>💡</span>
                <span>วิธีขอ LINE Notify Token ฟรีใน 3 ขั้นตอน:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed pl-1">
                <li>เปิดเบราว์เซอร์เข้าไปที่ <a href="https://notify-bot.line.me" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">notify-bot.line.me</a> แล้วล็อกอินด้วยบัญชี LINE</li>
                <li>แตะที่ชื่อโปรไฟล์มุมขวาบน เลือก <strong>"My page (หน้าของฉัน)"</strong> แล้วเลื่อนลงไปแตะปุ่ม <strong>"Generate token (ออก Token)"</strong></li>
                <li>ตั้งชื่อ Token เช่น <code>ร้านป้าเพ็ญ</code> และเลือกแชท <strong>"1-on-1 chat with LINE Notify"</strong> จากนั้นกดปุ่ม Generate แล้วคัดลอก Token มาวางในช่องด้านบน</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <button
                type="button"
                disabled={isSavingLine}
                onClick={handleSaveLineSettings}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSavingLine ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า LINE'}
              </button>

              <button
                type="button"
                disabled={isTestingLine || !editLineToken}
                onClick={handleTestLineNotify}
                className="px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTestingLine ? 'กำลังส่งข้อความ...' : 'ทดสอบส่งเข้า LINE ของฉัน'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal for Seller */}
      {isProductModalOpen && (
        <ProductModal
          isOpen={isProductModalOpen}
          product={editingProduct}
          categories={categories}
          sellerId={currentSeller.id}
          sellerName={currentSeller.shopName}
          onClose={() => {
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
          onSave={async (prodData, isNew) => {
            await onSaveProduct(prodData, isNew, editingProduct?.id);
            setIsProductModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}

    </div>
  );
};
