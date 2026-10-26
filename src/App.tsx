/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  db,
  auth,
  googleProvider,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType,
  cleanFirestoreData,
} from './firebase';
import {
  ProductItem,
  Order,
  CartItem,
  Category,
  StoreSettings,
  AppUser,
  SellerAccount,
} from './types';
import { DEFAULT_STORE_SETTINGS, INITIAL_CATEGORIES } from './data/initialData';
import {
  getActiveCoverImage,
  saveActiveCoverImageLocally,
  isValidCoverUrl,
  DEFAULT_COVER_IMAGE,
} from './utils/coverImage';
import { Header } from './components/Header';
import { BannerHero } from './components/BannerHero';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { CoverImageModal } from './components/CoverImageModal';
import { SellerPortal } from './components/SellerPortal';
import { ChumPhaeMap } from './components/ChumPhaeMap';
import { playAdminOrderSound, playCustomerDeliveredSound } from './utils/sound';
import { loginAdminClient } from './utils/adminAuthClient';
import {
  MapPin,
  Phone,
  Truck,
  ShoppingBag,
  ShieldCheck,
  CheckCircle2,
  X,
  Package,
  AlertCircle,
  Loader2,
  Camera,
  Store,
} from 'lucide-react';

const ADMIN_EMAIL = 'yuttasas.62@gmail.com';

// Helper to detect if current URL is a customer-only storefront link (no admin menu)
const isPathCustomerOnly = (path: string = window.location.pathname, search: string = window.location.search) => {
  return (
    path === '/shop' ||
    path.startsWith('/shop') ||
    path === '/order' ||
    path.startsWith('/order') ||
    path === '/store' ||
    path.startsWith('/store') ||
    search.includes('mode=user') ||
    search.includes('customer=true') ||
    search.includes('customer=1')
  );
};

// Helper to detect if current URL is a Seller Portal link (/seller or ?code=... / ?user=...)
const isPathSeller = (path: string = window.location.pathname, search: string = window.location.search) => {
  return (
    path === '/seller' ||
    path.startsWith('/seller') ||
    search.includes('seller=true') ||
    search.includes('seller=1')
  );
};

// Generate and persist a unique device ID in localStorage for true per-device isolation ("เครื่องใครเครื่องมัน")
const getOrCreateDeviceId = (): string => {
  try {
    let id = localStorage.getItem('chumphae_device_id');
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('chumphae_device_id', id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
};

// Get list of order IDs placed specifically on this client device
const getLocalOrderIds = (): string[] => {
  try {
    const raw = localStorage.getItem('chumphae_my_orders');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalOrderId = (orderId: string) => {
  try {
    const list = getLocalOrderIds();
    if (!list.includes(orderId)) {
      localStorage.setItem('chumphae_my_orders', JSON.stringify([orderId, ...list]));
    }
  } catch (e) {
    console.warn('Failed to save order ID to localStorage:', e);
  }
};

export default function App() {
  // Navigation / Routing State (supports /admin, /seller, and customer storefront /shop)
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [isCustomerOnly, setIsCustomerOnly] = useState<boolean>(() =>
    isPathCustomerOnly(window.location.pathname, window.location.search)
  );
  const [isSellerMode, setIsSellerMode] = useState<boolean>(() =>
    isPathSeller(window.location.pathname, window.location.search)
  );

  // Sellers State (Persisted in Firestore collection 'sellers', max 200 users)
  const [sellers, setSellers] = useState<SellerAccount[]>([]);

  // Per-Device Isolation State ("เครื่องใครเครื่องมัน")
  const [deviceId] = useState<string>(getOrCreateDeviceId);
  const [myOrderIds, setMyOrderIds] = useState<string[]>(getLocalOrderIds);

  // Application Data States
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  
  // Initialize category from URL parameter (?cat=... or ?category=...) if present
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const catParam = params.get('cat') || params.get('category');
      return catParam || 'all';
    } catch {
      return 'all';
    }
  });

  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  // Cart State (stored locally in localStorage - 100% per-device independent)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('chumphae_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isPathAdmin = (path: string, search: string = window.location.search) => {
    // If the URL is explicitly a customer storefront link or seller link, admin mode is disabled
    if (isPathCustomerOnly(path, search) || isPathSeller(path, search)) {
      return false;
    }
    return (
      path === '/admin' ||
      path.startsWith('/admin') ||
      search.includes('admin=true') ||
      search.includes('admin=1')
    );
  };

  // Admin and Auth State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() =>
    isPathAdmin(window.location.pathname, window.location.search)
  );
  const isAdminModeRef = useRef<boolean>(isAdminMode);

  useEffect(() => {
    isAdminModeRef.current = isAdminMode;
  }, [isAdminMode]);

  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState<boolean>(false);
  const [isGlobalCoverModalOpen, setIsGlobalCoverModalOpen] = useState<boolean>(false);

  // Modals
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState<boolean>(false);
  const [currentTrackingOrderId, setCurrentTrackingOrderId] = useState<string | undefined>(undefined);
  const [isStoreLocationModalOpen, setIsStoreLocationModalOpen] = useState<boolean>(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<ProductItem | null>(null);

  // Prompt cover photo change (opens modal if admin, otherwise shows quick admin login)
  const handleOpenChangeCoverPrompt = () => {
    if (isAdminAuthenticated || currentUser?.role === 'admin') {
      setIsGlobalCoverModalOpen(true);
    } else {
      setIsAdminLoginOpen(true);
    }
  };

  const previousOrdersCountRef = useRef<number | null>(null);
  const previousOrderStatusMapRef = useRef<Record<string, string>>({});

  // Admin In-Page Login State
  const [adminUserField, setAdminUserField] = useState('admin');
  const [adminPassField, setAdminPassField] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  const handleAdminFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    if (!adminUserField.trim() || !adminPassField) {
      setAdminLoginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setAdminLoginLoading(true);
    try {
      const data = await loginAdminClient(adminUserField, adminPassField);
      if (!data.success) {
        throw new Error(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
      if (data.token) {
        sessionStorage.setItem('chumphae_admin_token', data.token);
      }
      if (data.user) {
        sessionStorage.setItem('chumphae_admin_user', JSON.stringify(data.user));
      }
      setIsAdminAuthenticated(true);
      setIsAdminMode(true);
      isAdminModeRef.current = true;
      navigateTo('/admin');
    } catch (err: any) {
      setAdminLoginError(err?.message || 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  // Sync Path on popstate
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      setCurrentPath(path);
      const isCustOnly = isPathCustomerOnly(path, search);
      setIsCustomerOnly(isCustOnly);
      const isSel = isPathSeller(path, search);
      setIsSellerMode(isSel);
      const isAdm = !isCustOnly && !isSel && isPathAdmin(path, search);
      setIsAdminMode(isAdm);
      isAdminModeRef.current = isAdm;
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
      const search = window.location.search;
      const isCustOnly = isPathCustomerOnly(path, search);
      setIsCustomerOnly(isCustOnly);
      const isSel = isPathSeller(path, search);
      setIsSellerMode(isSel);
      const isAdm = !isCustOnly && !isSel && isPathAdmin(path, search);
      setIsAdminMode(isAdm);
      isAdminModeRef.current = isAdm;
    }
  };

  // Verify Admin Session Token on Boot
  useEffect(() => {
    const token = sessionStorage.getItem('chumphae_admin_token');
    if (token) {
      // In SPA environment, valid session token stored in sessionStorage retains auth
      setIsAdminAuthenticated(true);
      if (isPathAdmin(window.location.pathname, window.location.search)) {
        setIsAdminMode(true);
        isAdminModeRef.current = true;
      }
    }
  }, []);

  // Save Cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chumphae_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  // 1. Firebase Boot & Auth Listener
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const isOwnerEmail = fbUser.email === ADMIN_EMAIL;
        const appUser: AppUser = {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email || 'ลูกค้าสมาชิก',
          email: fbUser.email || undefined,
          phone: fbUser.phoneNumber || undefined,
          role: isOwnerEmail ? 'admin' : 'customer',
        };
        setCurrentUser(appUser);
        if (isOwnerEmail) {
          setIsAdminAuthenticated(true);
        }

        try {
          await setDoc(doc(db, 'users', fbUser.uid), appUser, { merge: true });
        } catch (e) {
          console.warn('Could not sync user profile to Firestore:', e);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. REAL-TIME PRODUCTS LISTENER (READ DIRECTLY FROM FIRESTORE ONLY - NO SAMPLE DATA)
  useEffect(() => {
    const productsRef = collection(db, 'products');
    const unsubscribeProducts = onSnapshot(
      productsRef,
      (snapshot) => {
        const prods: ProductItem[] = [];
        snapshot.forEach((docSnap) => {
          prods.push({ id: docSnap.id, ...docSnap.data() } as ProductItem);
        });
        setProducts(prods);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    return () => unsubscribeProducts();
  }, []);

  // 3. REAL-TIME ORDERS LISTENER
  useEffect(() => {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribeOrders = onSnapshot(
      q,
      (snapshot) => {
        const ords: Order[] = [];
        snapshot.forEach((docSnap) => {
          ords.push({ id: docSnap.id, ...docSnap.data() } as Order);
        });

        // Determine strictly whether this session is currently on the Admin link
        const isCurrentlyAdmin =
          isAdminModeRef.current ||
          isPathAdmin(window.location.pathname, window.location.search) ||
          Boolean(sessionStorage.getItem('chumphae_admin_token'));

        // 1. Admin link sound: "มีออเดอร์เข้า" ONLY on admin link when new order arrives
        if (isCurrentlyAdmin) {
          if (
            previousOrdersCountRef.current !== null &&
            ords.length > previousOrdersCountRef.current
          ) {
            playAdminOrderSound();
          }
        }
        // 2. Customer link: Strict silence for incoming orders (NO order alert sound at all)

        previousOrdersCountRef.current = ords.length;
        const newStatusMap: Record<string, string> = {};
        ords.forEach((o) => {
          newStatusMap[o.id] = o.status;
        });
        previousOrderStatusMapRef.current = newStatusMap;

        setOrders(ords);
      },
      (error) => {
        onSnapshot(
          ordersRef,
          (fallbackSnap) => {
            const ords: Order[] = [];
            fallbackSnap.forEach((docSnap) => {
              ords.push({ id: docSnap.id, ...docSnap.data() } as Order);
            });
            ords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setOrders(ords);
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, 'orders');
          }
        );
      }
    );

    return () => unsubscribeOrders();
  }, []);

  // 4. REAL-TIME STORE SETTINGS LISTENER
  useEffect(() => {
    const settingsDocRef = doc(db, 'store_settings', 'main_config');
    const unsubscribeSettings = onSnapshot(
      settingsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as StoreSettings;
          const activeCover = getActiveCoverImage(data);
          if (data.coverImageUrl && isValidCoverUrl(data.coverImageUrl)) {
            saveActiveCoverImageLocally(data.coverImageUrl);
          } else {
            data.coverImageUrl = activeCover;
          }
          setSettings(data);
        } else {
          setDoc(settingsDocRef, DEFAULT_STORE_SETTINGS, { merge: true }).catch(() => {});
        }
      },
      (error) => {
        console.warn('Could not fetch store settings, using defaults', error);
      }
    );

    return () => unsubscribeSettings();
  }, []);

  // 5. REAL-TIME SELLERS LISTENER (Firestore 'sellers' collection - max 200 accounts)
  useEffect(() => {
    const sellersRef = collection(db, 'sellers');
    const unsubscribeSellers = onSnapshot(
      sellersRef,
      (snapshot) => {
        const list: SellerAccount[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SellerAccount);
        });
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setSellers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sellers');
      }
    );

    return () => unsubscribeSellers();
  }, []);

  // Admin Logout Handler
  const handleAdminLogout = async () => {
    const token = sessionStorage.getItem('chumphae_admin_token');
    if (token) {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }
    sessionStorage.removeItem('chumphae_admin_token');
    sessionStorage.removeItem('chumphae_admin_user');
    setIsAdminAuthenticated(false);
    setIsAdminMode(false);
    navigateTo('/');
    if (auth.currentUser) {
      await fbSignOut(auth).catch(() => {});
    }
  };

  // Google Sign-In (Optional alternative)
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setIsAdminLoginOpen(false);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        alert('เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ' + (err?.message || err));
      }
    }
  };

  // Cart Handlers
  const handleAddToCart = (product: ProductItem, quantityToAdd: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(product.stock, existing.quantity + quantityToAdd);
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prev, { product, quantity: Math.min(product.stock, quantityToAdd) }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          return { ...item, quantity: Math.min(quantity, item.product.stock) };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderSuccess = (newOrder: Order) => {
    saveLocalOrderId(newOrder.id);
    setMyOrderIds((prev) => [newOrder.id, ...prev.filter((id) => id !== newOrder.id)]);
    setCurrentTrackingOrderId(newOrder.id);
    setIsOrdersModalOpen(true);
  };

  // Admin DB CRUD Operations
  const handleUpdateProductStock = async (productId: string, newStock: number) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        stock: newStock,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
    }
  };

  const handleToggleProductActive = async (productId: string, isActive: boolean) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        isActive,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
    }
  };

  const handleSaveProduct = async (
    productData: Partial<ProductItem>,
    isNew: boolean,
    existingId?: string
  ) => {
    try {
      const cleanData = cleanFirestoreData(productData);
      if (isNew) {
        const newId = doc(collection(db, 'products')).id;
        const newProd = {
          ...cleanData,
          id: newId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as ProductItem;
        setProducts((prev) => [newProd, ...prev]);
        await setDoc(doc(db, 'products', newId), newProd);
      } else if (existingId) {
        setProducts((prev) =>
          prev.map((p) => (p.id === existingId ? { ...p, ...cleanData } as ProductItem : p))
        );
        await updateDoc(doc(db, 'products', existingId), {
          ...cleanData,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${existingId || 'new'}`);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      await deleteDoc(doc(db, 'products', productId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    }
  };

  const handleUpdateStoreSettings = async (newSettings: StoreSettings) => {
    try {
      if (newSettings.coverImageUrl) {
        saveActiveCoverImageLocally(newSettings.coverImageUrl);
      }
      setSettings(newSettings);
      await setDoc(doc(db, 'store_settings', 'main_config'), newSettings, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'store_settings/main_config');
    }
  };

  // Seller Management CRUD (Strictly enforces max 200 seller accounts)
  const handleSaveSeller = async (
    sellerData: Partial<SellerAccount>,
    isNew: boolean,
    existingId?: string
  ) => {
    try {
      if (isNew && sellers.length >= 200) {
        throw new Error('ไม่สามารถเพิ่มผู้ขายได้: ระบบจำกัดจำนวนบัญชีผู้ขายไว้สูงสุด 200 คน');
      }

      const cleanData = cleanFirestoreData(sellerData);
      if (isNew) {
        const newId = doc(collection(db, 'sellers')).id;
        const newSeller = {
          ...cleanData,
          id: newId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as SellerAccount;
        setSellers((prev) => [newSeller, ...prev]);
        await setDoc(doc(db, 'sellers', newId), newSeller);
      } else if (existingId) {
        setSellers((prev) =>
          prev.map((s) => (s.id === existingId ? { ...s, ...cleanData, updatedAt: new Date().toISOString() } as SellerAccount : s))
        );
        await updateDoc(doc(db, 'sellers', existingId), {
          ...cleanData,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `sellers/${existingId || 'new'}`);
      throw err;
    }
  };

  const handleDeleteSeller = async (sellerId: string) => {
    try {
      setSellers((prev) => prev.filter((s) => s.id !== sellerId));
      await deleteDoc(doc(db, 'sellers', sellerId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sellers/${sellerId}`);
      throw err;
    }
  };

  // Filtered Products for Customer View: ONLY published/active products that are IN STOCK (stock > 0)
  // If out of stock, automatically removed from customer storefront
  const publishedProducts = useMemo(() => {
    return products.filter((p) => p.isActive === true && p.stock > 0);
  }, [products]);

  const customerFilteredProducts = useMemo(() => {
    return publishedProducts.filter((p) => {
      const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchCategory;
    });
  }, [publishedProducts, selectedCategory]);

  const isUserAdmin = isAdminAuthenticated || currentUser?.role === 'admin';
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Active orders for customer tracking modal (strictly scoped per device "เครื่องใครเครื่องมัน")
  const myOrders = useMemo(() => {
    if (isAdminMode) {
      return orders;
    }
    const myIdsSet = new Set(myOrderIds);
    return orders.filter((o) => {
      // 1. Logged in customer
      if (currentUser && o.customerId === currentUser.id) return true;
      // 2. Orders made with this device's unique ID
      if (deviceId && o.customerId === deviceId) return true;
      // 3. Orders recorded locally in this device's storage
      if (myIdsSet.has(o.id)) return true;
      return false;
    });
  }, [orders, currentUser, deviceId, myOrderIds, isAdminMode]);

  const customerActiveOrdersCount = useMemo(() => {
    return myOrders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;
  }, [myOrders]);

  return (
    <div className="min-h-screen bg-amber-50/20 text-stone-900 flex flex-col font-['Prompt',sans-serif]">
      
      {/* 1. Header Bar (Reduced height, compact and responsive, hidden in Seller Portal) */}
      {!isSellerMode && (
        <Header
          settings={settings}
          cartCount={cartItemsCount}
          activeOrdersCount={isAdminMode ? orders.filter((o) => o.status === 'pending').length : customerActiveOrdersCount}
          currentUser={currentUser}
          isAdmin={isUserAdmin}
          isAdminMode={isAdminMode}
          isCustomerOnly={isCustomerOnly}
          onToggleAdminMode={() => {
            if (isAdminMode) {
              navigateTo('/');
            } else {
              navigateTo('/admin');
            }
          }}
          onOpenCart={() => setIsCartOpen(true)}
          onOpenMyOrders={() => {
            setCurrentTrackingOrderId(undefined);
            setIsOrdersModalOpen(true);
          }}
          onOpenAdmin={() => navigateTo('/admin')}
          onSignOut={handleAdminLogout}
          onOpenChangeCover={handleOpenChangeCoverPrompt}
        />
      )}

      {/* Main View Body */}
      <main className="flex-1">
        {isSellerMode ? (
          /* ======================================================== */
          /* SELLER PORTAL VIEW (/seller or custom seller link)       */
          /* ======================================================== */
          <SellerPortal
            sellers={sellers}
            products={products}
            categories={categories}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onUpdateStock={handleUpdateProductStock}
            onToggleActive={handleToggleProductActive}
            onNavigateHome={() => navigateTo('/')}
          />
        ) : isAdminMode ? (
          /* ======================================================== */
          /* ADMIN VIEW (/admin)                                     */
          /* ======================================================== */
          isUserAdmin ? (
            <AdminDashboard
              orders={orders}
              products={products}
              categories={categories}
              settings={settings}
              sellers={sellers}
              onUpdateProductStock={handleUpdateProductStock}
              onToggleProductActive={handleToggleProductActive}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onSaveSeller={handleSaveSeller}
              onDeleteSeller={handleDeleteSeller}
              onUpdateSettings={handleUpdateStoreSettings}
              onSignOut={handleAdminLogout}
            />
          ) : (
            /* Admin Access Gate & In-page Login Form when visiting /admin directly */
            <div className="max-w-md mx-auto my-8 sm:my-12 px-4">
              <div className="bg-white rounded-3xl border border-amber-200 shadow-lg overflow-hidden">
                <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-amber-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-yellow-300" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold">เข้าสู่ระบบผู้ดูแลร้านค้า (Admin)</h2>
                      <p className="text-[11px] text-yellow-100">ระบบจัดการร้านขายถูกที่นี่ชุมแพ</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    หน้านี้สำหรับเจ้าของร้าน <strong className="text-red-600">ขายถูกที่นี่ชุมแพ</strong> ในการจัดการสินค้า, ออเดอร์ลูกค้า, รายงานยอดขาย และการตั้งค่าร้าน
                  </p>

                  {adminLoginError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-red-800 text-xs">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{adminLoginError}</span>
                    </div>
                  )}

                  <form onSubmit={handleAdminFormLogin} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">
                        ชื่อผู้ใช้ / เบอร์โทรผู้ดูแล
                      </label>
                      <input
                        type="text"
                        required
                        value={adminUserField}
                        onChange={(e) => setAdminUserField(e.target.value)}
                        placeholder="admin หรือ 0992256601"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">
                        รหัสผ่านร้านค้า
                      </label>
                      <input
                        type="password"
                        required
                        value={adminPassField}
                        onChange={(e) => setAdminPassField(e.target.value)}
                        placeholder="••••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500 text-xs font-mono tracking-widest"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={adminLoginLoading}
                      className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {adminLoginLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังตรวจสอบสิทธิ์...</span>
                        </>
                      ) : (
                        <span>เข้าสู่ระบบจัดการร้าน</span>
                      )}
                    </button>
                  </form>

                  <div className="pt-2 border-t border-stone-100 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="w-full py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium rounded-xl border border-stone-200 transition-colors cursor-pointer"
                    >
                      เข้าสู่ระบบด้วย Google Account (สำหรับเจ้าของร้าน)
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('/')}
                      className="w-full py-2 text-stone-500 hover:text-stone-700 text-xs text-center transition-colors cursor-pointer"
                    >
                      ← กลับสู่หน้าร้านสำหรับลูกค้า
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          /* ======================================================== */
          /* CUSTOMER STOREFRONT VIEW (Streamlined & Compact Header) */
          /* ======================================================== */
          <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 pb-16">
            
            {/* 1. Cover Banner (Displays active cover photo set by admin) */}
            <BannerHero
              settings={settings}
              onOpenLocation={() => setIsStoreLocationModalOpen(true)}
            />

            {/* 2. Category Selector Pills (Clean & Compact, No Search Box) */}
            {categories.length > 0 && (
              <div className="px-3 sm:px-4">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none py-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-2xs ${
                      selectedCategory === 'all'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-50 border border-amber-200/80'
                    }`}
                  >
                    <span>✨</span>
                    <span>ดูทั้งหมด</span>
                  </button>

                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.slug;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(isSelected ? 'all' : cat.slug)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-2xs ${
                          isSelected
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-white text-stone-700 hover:bg-stone-50 border border-amber-200/80'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                        {isSelected && <span className="ml-0.5 text-[10px]">✕</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Products List Area */}
            <div className="px-3 sm:px-4">
              
              {/* Product Counter Header (Hidden if 0 products as requested) */}
              {customerFilteredProducts.length > 0 && (
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-sm sm:text-base font-bold text-stone-900">
                    รายการสินค้าพร้อมส่ง
                  </h2>
                  <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    {customerFilteredProducts.length} รายการ
                  </span>
                </div>
              )}

              {/* Empty State vs Products Grid */}
              {customerFilteredProducts.length === 0 ? (
                /* Beautiful empty state when no products in database or matching category */
                <div className="bg-white rounded-3xl border border-amber-200/90 p-10 sm:p-14 text-center space-y-3 shadow-2xs">
                  <div className="w-16 h-16 rounded-full bg-amber-100/70 text-amber-700 flex items-center justify-center mx-auto text-2xl">
                    🛍️
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-stone-800">
                    {selectedCategory !== 'all'
                      ? `ขณะนี้ยังไม่มีสินค้าในหมวดหมู่ "${categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}"`
                      : 'ขณะนี้ยังไม่มีสินค้า รอติดตามสินค้าใหม่เร็ว ๆ นี้'}
                  </h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    {selectedCategory !== 'all'
                      ? 'คุณสามารถเลือกดูหมวดหมู่อื่น หรือกดปุ่มดูสินค้าทั้งหมด'
                      : 'ทางร้านขายถูกที่นี่ชุมแพกำลังเตรียมเพิ่มรายการสินค้าของเล่น กิ๊บช๊อป ของใช้ไฟฟ้าทั่วไป เครื่องมือช่าง และสินค้าอื่นๆ ราคาประหยัด คุณภาพดี'}
                  </p>
                  {selectedCategory !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      ดูสินค้าทั้งหมด
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                  {customerFilteredProducts.map((product) => {
                    const cartItem = cart.find((i) => i.product.id === product.id);
                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        cartQuantity={cartItem ? cartItem.quantity : 0}
                        onAddToCart={handleAddToCart}
                        onSelectProduct={(p) => setSelectedProductForDetail(p)}
                      />
                    );
                  })}
                </div>
              )}

            </div>

          </div>
        )}
      </main>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        settings={settings}
        customerId={currentUser?.id || deviceId}
        defaultCustomerName={currentUser?.name}
        defaultCustomerPhone={currentUser?.phone}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Order Tracking Modal */}
      <OrderTrackingModal
        isOpen={isOrdersModalOpen}
        onClose={() => setIsOrdersModalOpen(false)}
        orders={myOrders}
        currentOrderId={currentTrackingOrderId}
      />

      {/* Admin Login Modal (Secure server-side password check) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={() => {
          setIsAdminAuthenticated(true);
          setIsAdminMode(true);
          navigateTo('/admin');
        }}
        onGoogleSignIn={handleGoogleSignIn}
      />

      {/* Store Location Map Modal */}
      {isStoreLocationModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-stone-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-600" />
                  พิกัดร้านขายถูกที่นี่ชุมแพ
                </h3>
                <p className="text-xs text-stone-500">
                  พิกัด: {settings.storeLat.toFixed(6)}, {settings.storeLng.toFixed(6)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStoreLocationModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ChumPhaeMap
              storeLat={settings.storeLat}
              storeLng={settings.storeLng}
              onLocationSelect={() => {}}
              readOnly={true}
            />

            <div className="flex items-center justify-between text-xs pt-2 border-t border-stone-100">
              <span className="text-stone-600">
                เบอร์โทร: <strong>{settings.storePhone}</strong>
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${settings.storeLat},${settings.storeLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
              >
                เปิดใน Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer (Hidden in Seller Portal) */}
      {!isSellerMode && (
        <footer className="bg-stone-900 text-stone-300 text-xs py-6 border-t border-amber-900/30 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div>
                <div className="font-extrabold text-white text-sm">ขายถูกที่นี่ชุมแพ</div>
                <div className="text-[11px] text-amber-300">
                  ของเล่น กิ๊บช๊อป ของใช้ไฟฟ้าทั่วไป เครื่องมือช่าง สินค้าอื่นๆ ราคาประหยัด ใกล้บ้านคุณ
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ตัดสต็อกจริง Transaction
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  <Truck className="w-3.5 h-3.5" /> ระยะทางถนนจริง OSRM
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <Phone className="w-3.5 h-3.5" /> {settings.storePhone}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-800 text-[10px] text-stone-500 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span>พิกัดร้าน 16.525223, 102.101480 อ.ชุมแพ จ.ขอนแก่น</span>
              
              {/* Quick Admin & Seller Links (Hidden when user opens customer storefront link) */}
              {!isCustomerOnly && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigateTo('/seller')}
                    className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-purple-300 border border-purple-700/60 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="เข้าสู่ระบบ Seller สำหรับผู้ขาย"
                  >
                    <Store className="w-3 h-3 text-purple-400" />
                    <span>เข้าสู่ระบบ Seller</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('/admin')}
                    className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="เข้าสู่ระบบผู้ดูแลร้านค้า Admin"
                  >
                    <ShieldCheck className="w-3 h-3 text-red-400" />
                    <span>เข้าสู่ระบบ Admin</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Admin Quick Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={() => {
          setIsAdminAuthenticated(true);
          setIsAdminLoginOpen(false);
          setIsGlobalCoverModalOpen(true);
        }}
        onGoogleSignIn={handleGoogleSignIn}
      />

      {/* Global Cover Image Modal (accessible from Storefront banner, Header, and Footer) */}
      <CoverImageModal
        isOpen={isGlobalCoverModalOpen}
        onClose={() => setIsGlobalCoverModalOpen(false)}
        currentCoverUrl={settings.coverImageUrl}
        onSaveCover={async (newCoverUrl: string) => {
          saveActiveCoverImageLocally(newCoverUrl);
          const updated = {
            ...settings,
            coverImageUrl: newCoverUrl,
          };
          await handleUpdateStoreSettings(updated);
        }}
      />

      {/* Customer Product Detail & Order Modal (Displays all 3-4 images and order actions) */}
      <ProductDetailModal
        isOpen={selectedProductForDetail !== null}
        onClose={() => setSelectedProductForDetail(null)}
        product={selectedProductForDetail}
        onAddToCart={(product, qty = 1) => {
          handleAddToCart(product, qty);
        }}
        onBuyNow={(product, qty = 1) => {
          handleAddToCart(product, qty);
          setIsCartOpen(true);
        }}
      />

    </div>
  );
}
