import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  LayoutDashboard,
  Boxes,
  ShoppingBag,
  History,
  TrendingUp,
  Settings,
  LogOut,
  Phone,
  MapPin,
  CheckCircle,
  Truck,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Check,
  Undo2,
  Loader2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Search,
  EyeOff,
  Save,
  CreditCard,
  CheckCircle2,
  User,
  Store,
  Inbox,
  PackageCheck,
  XCircle,
  Camera,
  Filter,
  Bell,
  Send,
  HelpCircle,
  MessageCircle,
  Share2,
  QrCode,
  Link2,
  Download,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { Order, OrderStatus, ProductItem, StoreSettings, Category, ProductCondition, SellerAccount } from '../types';
import { db, updateOrderStatus, cancelOrderWithAtomicStockRestore, uploadImageFile } from '../firebase';
import { compressImage } from '../utils/imageCompressor';
import { ProductModal } from './ProductModal';
import { CoverImageModal } from './CoverImageModal';
import {
  getActiveCoverImage,
  saveActiveCoverImageLocally,
  isCustomCoverImage,
  DEFAULT_COVER_IMAGE,
  STATIC_COVER_IMAGE,
} from '../utils/coverImage';
import { playAdminOrderSound, unlockAudio } from '../utils/sound';
import { sendLineNotifyTest, triggerLineNotification } from '../utils/lineNotifyClient';
import { SalesAnalyticsChart } from './SalesAnalyticsChart';
import { CustomerLinkGenerator } from './CustomerLinkGenerator';
import { SellerManagement } from './SellerManagement';
import { GitHubGuideModal } from './GitHubGuideModal';
import { APP_REVISION } from '../version';

export type AdminTab = 'dashboard' | 'orders' | 'products' | 'customer_links' | 'sellers' | 'history' | 'reports' | 'settings';
export type OrderSubTab = 'incoming' | 'to_deliver' | 'delivered' | 'cancelled';

interface AdminDashboardProps {
  orders: Order[];
  products: ProductItem[];
  categories: Category[];
  settings: StoreSettings;
  sellers?: SellerAccount[];
  onUpdateProductStock: (productId: string, newStock: number) => Promise<void>;
  onToggleProductActive: (productId: string, isActive: boolean) => Promise<void>;
  onSaveProduct: (productData: Partial<ProductItem>, isNew: boolean, id?: string) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onSaveSeller?: (sellerData: Partial<SellerAccount>, isNew: boolean, id?: string) => Promise<void>;
  onDeleteSeller?: (sellerId: string) => Promise<void>;
  onUpdateSettings: (newSettings: StoreSettings) => Promise<void>;
  onSignOut: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  products,
  categories,
  settings,
  sellers = [],
  onUpdateProductStock,
  onToggleProductActive,
  onSaveProduct,
  onDeleteProduct,
  onSaveSeller = async () => {},
  onDeleteSeller = async () => {},
  onUpdateSettings,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Modals & Inspection State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
  const [viewingSlipUrl, setViewingSlipUrl] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Filters & Order Subtabs
  const [orderSubTab, setOrderSubTab] = useState<OrderSubTab>('incoming');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('all');
  const [productStockStatusFilter, setProductStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('in_stock');
  const LOW_STOCK_THRESHOLD = 5;
  const [lastSavedProductName, setLastSavedProductName] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [salesDateRange, setSalesDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [chartViewMode, setChartViewMode] = useState<'both' | 'orders' | 'revenue'>('both');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  // Store Settings Form State
  const [settingsForm, setSettingsForm] = useState<StoreSettings>(() => ({ ...settings }));
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMessage, setSettingsSuccessMessage] = useState<string | null>(null);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [showLineToken, setShowLineToken] = useState(false);
  const [isTestingLineNotify, setIsTestingLineNotify] = useState(false);
  const [lineNotifyTestResult, setLineNotifyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showLineHelpGuide, setShowLineHelpGuide] = useState(false);
  const [isResendingLineNotify, setIsResendingLineNotify] = useState(false);
  const [resendLineResult, setResendLineResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isGitHubGuideOpen, setIsGitHubGuideOpen] = useState(false);

  // Sync settingsForm when store settings update
  React.useEffect(() => {
    setSettingsForm((prev) => ({
      ...prev,
      ...settings,
      coverImageUrl: settings.coverImageUrl || prev.coverImageUrl || getActiveCoverImage(settings),
    }));
  }, [settings]);

  // Active Orders (In-progress: pending, confirmed, preparing, delivering)
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  }, [orders]);

  // 4 Specific Subtabs for Order Management (เดินหน้าห้ามย้อนกลับ):
  // 1. Tab ออเดอร์เข้า (pending) - เพื่อกดรับออเดอร์
  const incomingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );

  // 2. Tab ต้องจัดส่ง (confirmed, preparing) - กดยืนยันนำส่ง
  const toDeliverOrders = useMemo(
    () => orders.filter((o) => o.status === 'confirmed' || o.status === 'preparing'),
    [orders]
  );

  // 3. Tab ส่งสำเร็จ (delivering, completed) - กดยืนยันปิดงาน
  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.status === 'delivering' || o.status === 'completed'),
    [orders]
  );

  // 4. Tab ยกเลิก (cancelled) - กรณีลูกค้าไม่รับ / ยกเลิกคำสั่งซื้อ
  const cancelledOrders = useMemo(
    () => orders.filter((o) => o.status === 'cancelled'),
    [orders]
  );

  // Current Subtab Orders with status filter dropdown & search filter
  const currentSubTabOrders = useMemo(() => {
    let list: Order[] = [];

    // 1. If a specific status is chosen in the dropdown (e.g. pending, processing, completed)
    if (orderStatusFilter !== 'all') {
      if (orderStatusFilter === 'processing') {
        list = orders.filter((o) => o.status === 'preparing' || o.status === 'confirmed');
      } else {
        list = orders.filter((o) => o.status === orderStatusFilter);
      }
    } else {
      // 2. Default to active subtab when status dropdown is 'all'
      if (orderSubTab === 'incoming') list = incomingOrders;
      else if (orderSubTab === 'to_deliver') list = toDeliverOrders;
      else if (orderSubTab === 'delivered') list = deliveredOrders;
      else if (orderSubTab === 'cancelled') list = cancelledOrders;
      else list = orders;
    }

    if (!orderSearchQuery.trim()) return list;
    const q = orderSearchQuery.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.customerPhone?.includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.items?.some((it) => it.name.toLowerCase().includes(q))
    );
  }, [orders, orderStatusFilter, orderSubTab, incomingOrders, toDeliverOrders, deliveredOrders, cancelledOrders, orderSearchQuery]);

  // History Orders (Completed or Cancelled)
  const historyOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'completed' || o.status === 'cancelled');
  }, [orders]);

  // Filtered Active Orders
  const filteredActiveOrders = useMemo(() => {
    if (orderStatusFilter === 'all') return activeOrders;
    return activeOrders.filter((o) => o.status === orderStatusFilter);
  }, [activeOrders, orderStatusFilter]);

  // Filtered History Orders
  const filteredHistoryOrders = useMemo(() => {
    return historyOrders.filter((o) => {
      if (historyStatusFilter !== 'all' && o.status !== historyStatusFilter) return false;
      if (!historySearchQuery) return true;
      const q = historySearchQuery.toLowerCase();
      return (
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.customerPhone?.includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    });
  }, [historyOrders, historyStatusFilter, historySearchQuery]);

  const inStockCount = useMemo(() => products.filter((p) => p.stock > 0).length, [products]);
  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
    [products]
  );
  const outOfStockCount = useMemo(() => products.filter((p) => p.stock <= 0).length, [products]);

  // Filtered Products for Inventory
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = productCatFilter === 'all' || p.category === productCatFilter;
      const matchSearch =
        productSearchQuery === '' ||
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(productSearchQuery.toLowerCase());
      const matchStock =
        productStockStatusFilter === 'all' ||
        (productStockStatusFilter === 'in_stock' && p.stock > 0) ||
        (productStockStatusFilter === 'low_stock' && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD) ||
        (productStockStatusFilter === 'out_of_stock' && p.stock <= 0);
      return matchCat && matchSearch && matchStock;
    });
  }, [products, productCatFilter, productSearchQuery, productStockStatusFilter]);

  // Store Open/Close Toggle Handler
  const handleToggleStoreOpen = async () => {
    const nextState = !settings.isOpen;
    try {
      await onUpdateSettings({ ...settings, isOpen: nextState });
      setSettingsForm((prev) => ({ ...prev, isOpen: nextState }));
    } catch (err: any) {
      alert(`ไม่สามารถเปลี่ยนสถานะร้านค้าได้: ${err?.message || err}`);
    }
  };

  // Delete All Out of Stock Products
  const handleDeleteAllOutOfStock = async () => {
    const outOfStockItems = products.filter((p) => p.stock <= 0);
    if (outOfStockItems.length === 0) {
      alert('ไม่มีรายการสินค้าที่หมดในขณะนี้');
      return;
    }
    if (
      window.confirm(
        `คุณต้องการลบสินค้าที่หมดแล้วทั้งหมด ${outOfStockItems.length} รายการออกจากระบบใช่หรือไม่?`
      )
    ) {
      for (const item of outOfStockItems) {
        await onDeleteProduct(item.id);
      }
    }
  };

  // 7-Day Performance Calculation for Recharts
  const past7DaysData = useMemo(() => {
    const days: {
      dateKey: string;
      dayLabel: string;
      shortDate: string;
      orderCount: number;
      revenue: number;
      completedCount: number;
    }[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      const dayLabel = `${thaiDays[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
      const shortDate = `${d.getDate()}/${d.getMonth() + 1}`;

      const allDayOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(dateKey));
      const validDayOrders = allDayOrders.filter((o) => o.status !== 'cancelled');
      const dayRevenue = validDayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const dayCompleted = allDayOrders.filter((o) => o.status === 'completed').length;

      days.push({
        dateKey,
        dayLabel,
        shortDate,
        orderCount: validDayOrders.length,
        revenue: dayRevenue,
        completedCount: dayCompleted,
      });
    }

    return days;
  }, [orders]);

  const total7DayOrders = useMemo(
    () => past7DaysData.reduce((acc, curr) => acc + curr.orderCount, 0),
    [past7DaysData]
  );
  const total7DayRevenue = useMemo(
    () => past7DaysData.reduce((acc, curr) => acc + curr.revenue, 0),
    [past7DaysData]
  );
  const avgDailyOrders = (total7DayOrders / 7).toFixed(1);

  // Status Distribution for Donut Chart
  const statusDistribution = useMemo(() => {
    const statusCounts: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      delivering: 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach((o) => {
      if (statusCounts[o.status] !== undefined) {
        statusCounts[o.status]++;
      }
    });

    const statusMeta: Record<string, { label: string; color: string }> = {
      pending: { label: 'รอรับออเดอร์', color: '#f59e0b' },
      confirmed: { label: 'ยืนยันแล้ว', color: '#3b82f6' },
      preparing: { label: 'กำลังเตรียม', color: '#8b5cf6' },
      delivering: { label: 'กำลังส่ง', color: '#06b6d4' },
      completed: { label: 'สำเร็จแล้ว', color: '#10b981' },
      cancelled: { label: 'ยกเลิก', color: '#ef4444' },
    };

    const res = Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([st, count]) => ({
        name: statusMeta[st]?.label || st,
        value: count,
        color: statusMeta[st]?.color || '#9ca3af',
      }));

    return res.length > 0 ? res : [{ name: 'ยังไม่มีออเดอร์', value: 1, color: '#e5e7eb' }];
  }, [orders]);

  // Sales Metrics according to salesDateRange
  const salesMetrics = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const validOrders = orders.filter((o) => o.status !== 'cancelled');

    const filtered = validOrders.filter((o) => {
      if (salesDateRange === 'all') return true;
      const oDate = new Date(o.createdAt);
      if (salesDateRange === 'today') return o.createdAt.startsWith(todayStr);
      if (salesDateRange === '7days') {
        return (now.getTime() - oDate.getTime()) / (1000 * 3600 * 24) <= 7;
      }
      if (salesDateRange === '30days') {
        return (now.getTime() - oDate.getTime()) / (1000 * 3600 * 24) <= 30;
      }
      return true;
    });

    const todayOrders = validOrders.filter((o) => o.createdAt.startsWith(todayStr));
    const todaySales = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    let totalRevenue = 0;
    let totalCost = 0;
    const prodSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

    filtered.forEach((o) => {
      totalRevenue += o.totalAmount;
      o.items.forEach((item) => {
        const cost = (item.costPrice || 0) * item.quantity;
        totalCost += cost;
        if (!prodSales[item.productId]) {
          prodSales[item.productId] = { name: item.name, quantity: 0, revenue: 0 };
        }
        prodSales[item.productId].quantity += item.quantity;
        prodSales[item.productId].revenue += item.subtotal;
      });
    });

    const topProducts = Object.values(prodSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      todaySales,
      todayOrdersCount: todayOrders.length,
      totalRevenue,
      totalCost,
      estimatedProfit: totalRevenue - totalCost,
      ordersCount: filtered.length,
      dateFilteredOrders: filtered,
      topProducts,
    };
  }, [orders, salesDateRange]);

  // Order Status Transition Handler
  const handleAdvanceStatus = async (order: Order, nextStatus: OrderStatus) => {
    setUpdatingOrderId(order.id);
    try {
      await updateOrderStatus(order.id, nextStatus);
    } catch (err: any) {
      alert(`ไม่สามารถเปลี่ยนสถานะได้: ${err?.message || err}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Order Cancel Handler (Atomic Stock Restore)
  const handleCancelOrder = async (order: Order) => {
    if (
      !window.confirm(
        `คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำสั่งซื้อ #${order.orderNumber || order.id}? ระบบจะคืนสินค้าเข้าสต็อกของร้านค้าโดยอัตโนมัติ`
      )
    ) {
      return;
    }
    setUpdatingOrderId(order.id);
    try {
      await cancelOrderWithAtomicStockRestore(order.id, 'ผู้ดูแลร้านกดยกเลิก');
    } catch (err: any) {
      alert(`ไม่สามารถยกเลิกได้: ${err?.message || err}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Attach Proof of Delivery Photo Handler
  const [uploadingProofOrderId, setUploadingProofOrderId] = useState<string | null>(null);

  const handleAttachDeliveryProof = async (orderId: string, file: File) => {
    setUploadingProofOrderId(orderId);
    try {
      const { dataUrl } = await compressImage(file, 1024, 1024, 0.85);
      let finalUrl = dataUrl;
      try {
        const uploadedUrl = await uploadImageFile(file, 'delivery_proofs');
        if (uploadedUrl) finalUrl = uploadedUrl;
      } catch (e) {
        console.warn('Storage fallback to dataUrl', e);
      }

      await updateDoc(doc(db, 'orders', orderId), {
        deliveryProofImageUrl: finalUrl,
        deliveryProofTimestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      alert(`ไม่สามารถแนบรูปถ่ายการรับสินค้าได้: ${err?.message || err}`);
    } finally {
      setUploadingProofOrderId(null);
    }
  };

  // Export Sales to CSV
  const handleExportCSV = () => {
    const headers = ['OrderNumber', 'Date', 'Customer', 'Phone', 'Address', 'Status', 'Payment', 'Subtotal', 'DeliveryFee', 'TotalAmount'];
    const rows = salesMetrics.dateFilteredOrders.map((o) => [
      o.orderNumber || o.id,
      new Date(o.createdAt).toLocaleString('th-TH'),
      `"${o.customerName}"`,
      o.customerPhone,
      `"${o.deliveryAddress.replace(/"/g, '""')}"`,
      o.status,
      o.paymentMethod,
      o.subtotal,
      o.deliveryFee,
      o.totalAmount,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ChumPhae_Sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save Settings
  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccessMessage(null);
    try {
      await onUpdateSettings(settingsForm);
      setSettingsSuccessMessage('บันทึกการตั้งค่าร้านค้าเรียบร้อยแล้ว');
      setTimeout(() => setSettingsSuccessMessage(null), 3500);
    } catch (err: any) {
      alert(`ไม่สามารถบันทึกการตั้งค่าได้: ${err?.message || err}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Save new cover image (persists to localStorage + Firestore)
  const handleSaveCoverImage = async (newCoverUrl: string) => {
    saveActiveCoverImageLocally(newCoverUrl);
    const updated = {
      ...settingsForm,
      ...settings,
      coverImageUrl: newCoverUrl,
    };
    setSettingsForm(updated);
    await onUpdateSettings(updated);
    setSettingsSuccessMessage('บันทึกรูปภาพหน้าปกสำเร็จแล้ว! ระบบจะแสดงรูปนี้เป็นรูปหลักและไม่เปลี่ยนกลับ');
    setTimeout(() => setSettingsSuccessMessage(null), 4500);
  };

  // Reliable In-Memory Blob ZIP Downloader (Prevents browser from saving HTML fallback in iFrame)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleDirectDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      const response = await fetch('/chumphae-store-source.zip', {
        cache: 'no-store',
        headers: {
          'Accept': 'application/zip, application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('Server returned HTML');
      }

      const blob = await response.blob();
      const zipBlob = new Blob([blob], { type: 'application/zip' });
      const blobUrl = window.URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', 'chumphae-store-source.zip');
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(link);
      }, 1500);
    } catch {
      // Direct tab fallback if fetch or blob fails
      window.open('/chumphae-store-source.zip', '_blank');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        
        {/* ======================================================== */}
        {/* ADMIN SIDEBAR: 7 Menus from top to bottom + Open/Close   */}
        {/* ======================================================== */}
        <aside className="w-full lg:w-64 shrink-0 bg-white rounded-3xl p-3 sm:p-4 border border-amber-200/90 shadow-xs space-y-3">
          
          {/* ปุ่ม เปิดร้าน, ปิดร้าน */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-stone-400 px-1 uppercase tracking-wider">
              สถานะร้านค้าวันนี้
            </div>
            <button
              type="button"
              onClick={handleToggleStoreOpen}
              className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs sm:text-sm font-bold border transition-all cursor-pointer shadow-xs active:scale-95 ${
                settings.isOpen
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                  : 'bg-red-500 hover:bg-red-600 text-white border-red-600 shadow-red-500/20'
              }`}
              title="กดเพื่อสลับสถานะเปิดร้าน/ปิดร้านทันที"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  {settings.isOpen && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
                <span className="text-left font-black leading-tight">
                  {settings.isOpen ? '🟢 วันนี้เปิดร้าน' : '🔴 วันนี้ร้านปิด'}
                </span>
              </div>
              <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-semibold">
                {settings.isOpen ? 'กดปิด' : 'กดเปิด'}
              </span>
            </button>
          </div>

          {/* รูปภาพหน้าปกร้านค้า (Cover Image Quick Widget) */}
          <div className="bg-gradient-to-b from-amber-50/80 to-stone-50 border border-amber-200 rounded-2xl p-2.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-700">
              <span className="flex items-center gap-1">
                <span>🖼️</span>
                <span>รูปหน้าปกร้าน</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                isCustomCoverImage(settings)
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-stone-200 text-stone-600'
              }`}>
                {isCustomCoverImage(settings) ? 'รูปล่าสุด' : 'รูปเริ่มต้น'}
              </span>
            </div>

            {/* Thumbnail Preview */}
            <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-900 aspect-21/9 group shadow-2xs">
              <img
                src={getActiveCoverImage(settings)}
                alt="หน้าปกร้าน"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-stone-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded-lg backdrop-blur-xs">
                  คลิกเพื่อเปลี่ยนรูป
                </span>
              </div>
            </div>

            {/* ปุ่มเปลี่ยนรูปภาพหน้าปก อย่างง่าย */}
            <button
              type="button"
              onClick={() => setIsCoverModalOpen(true)}
              className="w-full py-2 px-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="กดเพื่อเปลี่ยนรูปหน้าปกร้านค้าอย่างง่าย"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>เปลี่ยนรูปภาพหน้าปก</span>
            </button>
          </div>

          {/* LINE Notify Status Card */}
          <div className="bg-gradient-to-b from-emerald-50/70 to-stone-50 border border-emerald-200 rounded-2xl p-2.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-700">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Bell className="w-3.5 h-3.5 text-emerald-600" />
                <span>แจ้งเตือน LINE</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                settings.lineNotifyToken && settings.lineNotifyEnabled !== false
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-stone-200 text-stone-600'
              }`}>
                {settings.lineNotifyToken && settings.lineNotifyEnabled !== false ? 'เปิดทำงาน' : 'ปิด/ยังไม่ตั้ง'}
              </span>
            </div>
            <p className="text-[10px] text-stone-500 leading-tight">
              {settings.lineNotifyToken && settings.lineNotifyEnabled !== false
                ? 'ส่งออเดอร์ใหม่เข้ามือถือทันที'
                : 'ตั้งค่า Token ในแท็บตั้งค่าร้าน'}
            </p>
          </div>

          <div className="border-t border-stone-100 pt-2">
            <div className="text-[10px] font-bold text-stone-400 px-1 mb-1.5 uppercase tracking-wider">
              เมนูจัดการร้านค้า (1-8)
            </div>

            {/* 7 Vertical Menu Items in exact sequence: Top to Bottom */}
            <nav className="flex flex-col gap-1">
              
              {/* 1. dashboard */}
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  activeTab === 'dashboard'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>1. Dashboard</span>
                </div>
              </button>

              {/* 2. การจัดการออเดอร์ */}
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  activeTab === 'orders'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="w-4 h-4" />
                  <span>2. การจัดการออเดอร์</span>
                </div>
                {incomingOrders.length > 0 ? (
                  <span className="bg-yellow-400 text-red-950 text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce">
                    {incomingOrders.length} ใหม่
                  </span>
                ) : activeOrders.length > 0 ? (
                  <span className="bg-stone-200 text-stone-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {activeOrders.length}
                  </span>
                ) : null}
              </button>

              {/* 3. การจัดการสินค้า */}
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  activeTab === 'products'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Boxes className="w-4 h-4" />
                  <span>3. การจัดการสินค้า</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-700">
                  {products.length}
                </span>
              </button>

              {/* 4. ลิงก์สั่งของลูกค้า (แท็บสร้างลิงก์สำหรับส่งลูกค้าโดยเฉพาะ) */}
              <button
                type="button"
                onClick={() => setActiveTab('customer_links')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  activeTab === 'customer_links'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Share2 className="w-4 h-4" />
                  <span>4. ลิงก์สั่งของลูกค้า</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === 'customer_links' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  ส่งลูกค้า
                </span>
              </button>

              {/* 5. จัดการ Seller (ผู้ขาย) - สูงสุด 200 บัญชี */}
              <button
                type="button"
                onClick={() => setActiveTab('sellers')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  activeTab === 'sellers'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Store className="w-4 h-4" />
                  <span>5. จัดการ Seller</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === 'sellers'
                    ? 'bg-white/20 text-white'
                    : sellers.length >= 200
                    ? 'bg-red-100 text-red-700'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {sellers.length}/200
                </span>
              </button>

              {/* 6. ประวัติการขาย */}
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  activeTab === 'history'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4" />
                  <span>6. ประวัติการขาย</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-700">
                  {historyOrders.length}
                </span>
              </button>

              {/* 7. รายงานยอดขาย */}
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  activeTab === 'reports'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>7. รายงานยอดขาย</span>
                </div>
              </button>

              {/* 8. ตั้งค่าร้าน */}
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-left ${
                  activeTab === 'settings'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4" />
                  <span>8. ตั้งค่าร้าน</span>
                </div>
              </button>

              {/* 9. ออกจากระบบ */}
              <div className="pt-2 mt-1 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('คุณต้องการออกจากระบบผู้ดูแลร้านค้าใช่หรือไม่?')) {
                      onSignOut();
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>9. ออกจากระบบ</span>
                </button>
              </div>
            </nav>
          </div>

          <div className="pt-2 text-[11px] text-stone-400 border-t border-stone-100 flex items-center justify-between">
            <span className="truncate">{settings.storeName}</span>
            <span className="font-mono text-stone-500 shrink-0">{settings.storePhone}</span>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* MAIN ADMIN CONTENT AREA                                  */}
        {/* ======================================================== */}
        <main className="flex-1 min-w-0 w-full space-y-4">

          {/* ======================================================== */}
          {/* GLOBAL TOP COVER BANNER (Always visible across all tabs) */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 rounded-3xl p-3.5 sm:p-4 text-white shadow-md flex flex-wrap items-center justify-between gap-3 border-2 border-amber-300">
            <div className="flex items-center gap-3">
              <div className="w-16 h-10 sm:w-24 sm:h-14 rounded-2xl overflow-hidden border-2 border-white/70 shadow-xs shrink-0 bg-stone-900">
                <img
                  src={getActiveCoverImage(settings)}
                  alt="หน้าปกร้าน"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black flex items-center gap-2">
                  <span>📸 รูปภาพหน้าปกร้านค้า (ปัจจุบัน)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {isCustomCoverImage(settings) ? '✓ รูปล่าสุดที่บันทึก' : 'รูปเริ่มต้นระบบ'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-100 mt-0.5">
                  แสดงที่ด้านบนสุดของเว็บหน้าร้านลูกค้า และจะไม่เปลี่ยนกลับมาใช้รูปเดิมของระบบ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  playAdminOrderSound();
                }}
                className="px-3.5 py-2 sm:py-2.5 bg-black/25 hover:bg-black/40 text-amber-200 hover:text-white rounded-2xl text-xs sm:text-xs font-bold border border-white/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs"
                title="คลิกเพื่อทดสอบเสียงแจ้งเตือนออเดอร์เข้า"
              >
                <span>🔔</span>
                <span>ทดสอบเสียงออเดอร์</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCoverModalOpen(true)}
                className="px-4 py-2 sm:py-2.5 bg-white hover:bg-amber-50 active:scale-95 text-red-700 font-black rounded-2xl text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all"
                title="กดเพื่อเปลี่ยนรูปภาพหน้าปกร้านค้าทันที"
              >
                <Camera className="w-4 h-4 text-red-600 shrink-0" />
                <span>เปลี่ยนรูปภาพหน้าปก</span>
              </button>

              <button
                type="button"
                onClick={handleDirectDownloadZip}
                disabled={isDownloadingZip}
                className="px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-black rounded-2xl text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all border border-emerald-400/40 disabled:opacity-60"
                title="กดเพื่อดาวน์โหลด Source Code ทั้งหมดของระบบเป็นไฟล์ ZIP (ขนาด ~3.2 MB รับประกันไฟล์ .zip 100%)"
              >
                {isDownloadingZip ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>กำลังส่งไฟล์ ZIP...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-emerald-200 shrink-0" />
                    <span>ดาวน์โหลดโค้ด (ZIP)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsGitHubGuideOpen(true)}
                className="px-3 py-2 sm:py-2.5 bg-stone-900/40 hover:bg-stone-900/60 active:scale-95 text-yellow-300 hover:text-yellow-200 font-bold rounded-2xl text-xs sm:text-xs border border-white/20 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                title="คลิกเพื่อดูคำแนะนำการแตกไฟล์ ZIP และวิธีอัปโหลดขึ้น GitHub"
              >
                <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
                <span>วิธีขึ้น GitHub</span>
              </button>

              <div className="hidden md:flex flex-col items-end text-[10px] text-white/90 font-mono bg-black/25 px-2.5 py-1 rounded-xl border border-white/15">
                <span className="font-bold text-amber-200">
                  Rev: {APP_REVISION}
                </span>
                <span className="text-[9px] text-emerald-300 font-semibold">✓ Deploy Verified</span>
              </div>
            </div>
          </div>

      {/* ======================================================== */}
      {/* 1. DASHBOARD OVERVIEW TAB                                */}
      {/* ======================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Quick Cover Image Banner */}
          <div className="bg-gradient-to-r from-amber-50 via-white to-red-50/60 border border-amber-300 rounded-3xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-20 sm:w-28 h-12 sm:h-14 rounded-2xl overflow-hidden border-2 border-amber-300 shadow-2xs shrink-0 bg-stone-900">
                <img
                  src={getActiveCoverImage(settings)}
                  alt="หน้าปกร้าน"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-2">
                  <span>รูปภาพหน้าปกร้านค้า (ปัจจุบัน)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isCustomCoverImage(settings)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-200 text-stone-700'
                  }`}>
                    {isCustomCoverImage(settings) ? '✓ รูปล่าสุดที่บันทึก' : 'รูปเริ่มต้นระบบ'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  แสดงที่ด้านบนสุดของลิงก์ลูกค้าทุกลิงก์ สามารถกดเปลี่ยนรูปใหม่ได้ง่ายๆ ทันที
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCoverModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-2xl text-xs font-black shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>เปลี่ยนรูปภาพหน้าปก</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
              <div className="text-[11px] text-stone-500 font-semibold">ยอดขายวันนี้</div>
              <div className="text-xl sm:text-2xl font-black text-red-600">
                ฿{salesMetrics.todaySales.toLocaleString()}
              </div>
              <div className="text-[10px] text-stone-400">{salesMetrics.todayOrdersCount} ออเดอร์</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
              <div className="text-[11px] text-stone-500 font-semibold">ออเดอร์ค้างส่ง</div>
              <div className="text-xl sm:text-2xl font-black text-amber-600">
                {activeOrders.length} รายการ
              </div>
              <div className="text-[10px] text-stone-400">{pendingCount} รอตรวจสอบ</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
              <div className="text-[11px] text-stone-500 font-semibold flex items-center justify-between">
                <span>สินค้าพร้อมขาย</span>
                {lowStockCount > 0 && (
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-100/80 border border-amber-200 px-1.5 py-0.2 rounded-md">
                    ⚠️ ใกล้หมด {lowStockCount}
                  </span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                {products.filter((p) => p.isActive && p.stock > 0).length} รายการ
              </div>
              <div className="text-[10px] text-stone-400">จากทั้งหมด {products.length} สินค้า</div>
            </div>

            {/* Seller Account Metric */}
            <div
              onClick={() => setActiveTab('sellers')}
              className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1 cursor-pointer hover:border-purple-300 hover:shadow-xs transition-all"
              title="คลิกเพื่อไปที่หน้าจัดการ Seller"
            >
              <div className="text-[11px] text-stone-500 font-semibold flex items-center justify-between">
                <span>ผู้ขาย (Seller)</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                  sellers.length >= 200 ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {sellers.length}/200
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-purple-700">
                {sellers.length} <span className="text-xs font-normal text-stone-400">บัญชี</span>
              </div>
              <div className="text-[10px] text-purple-600 font-semibold flex items-center justify-between">
                <span>สินค้า {products.filter((p) => p.sellerId).length} รายการ</span>
                <span>จัดการ →</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
              <div className="text-[11px] text-stone-500 font-semibold flex items-center justify-between">
                <span>สถานะร้านค้า</span>
                <span className="text-[10px] text-stone-400">กดสลับได้ทันที</span>
              </div>
              <button
                type="button"
                onClick={handleToggleStoreOpen}
                className={`w-full py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer shadow-2xs active:scale-95 ${
                  settings.isOpen
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${settings.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span>{settings.isOpen ? '🟢 วันนี้เปิดร้าน' : '🔴 วันนี้ร้านปิด'}</span>
              </button>
              <div className="text-[10px] text-stone-400 text-center">โทร {settings.storePhone}</div>
            </div>
          </div>

          {/* Daily & Weekly Sales Analytics Module (Recharts) */}
          <SalesAnalyticsChart orders={orders} defaultMode="daily" />

          {/* Quick Actions & Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Recent Orders Card */}
            <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-red-600" /> ออเดอร์ล่าสุด
                  </h3>
                  {/* Status Filter Dropdown on Dashboard */}
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-xl border border-stone-300 text-[11px] font-bold text-stone-700 bg-stone-50 focus:outline-hidden focus:border-red-500 cursor-pointer"
                  >
                    <option value="all">ออเดอร์ค้างส่งทั้งหมด ({activeOrders.length})</option>
                    <option value="pending">รอรับออเดอร์ ({orders.filter(o => o.status === 'pending').length})</option>
                    <option value="processing">กำลังจัดเตรียม ({orders.filter(o => o.status === 'preparing' || o.status === 'confirmed').length})</option>
                    <option value="delivering">กำลังนำส่ง ({orders.filter(o => o.status === 'delivering').length})</option>
                    <option value="completed">ส่งสำเร็จแล้ว ({orders.filter(o => o.status === 'completed').length})</option>
                    <option value="cancelled">ยกเลิกแล้ว ({orders.filter(o => o.status === 'cancelled').length})</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  ไปหน้าจัดการออเดอร์ →
                </button>
              </div>

              {(orderStatusFilter === 'all'
                ? activeOrders
                : orders.filter((o) =>
                    orderStatusFilter === 'processing'
                      ? o.status === 'preparing' || o.status === 'confirmed'
                      : o.status === orderStatusFilter
                  )
              ).length === 0 ? (
                <div className="text-center py-8 text-xs text-stone-500">
                  🎉 ไม่มีรายการออเดอร์ในสถานะที่เลือก
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {(orderStatusFilter === 'all'
                    ? activeOrders
                    : orders.filter((o) =>
                        orderStatusFilter === 'processing'
                          ? o.status === 'preparing' || o.status === 'confirmed'
                          : o.status === orderStatusFilter
                      )
                  ).slice(0, 6).map((o) => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-stone-900 flex items-center gap-2">
                          <span>#{o.orderNumber || o.id.slice(-6)}</span>
                          <span className="font-normal text-stone-600">{o.customerName}</span>
                          <span className="text-[10px] text-stone-400">({o.customerPhone})</span>
                        </div>
                        <div className="text-[11px] text-stone-500 truncate max-w-xs">
                          {o.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="font-black text-red-600">฿{o.totalAmount}</div>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            {o.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInspectingOrder(o)}
                          className="p-1 text-stone-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-stone-900">การจัดการด่วน</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                  className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มสินค้าใหม่</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="w-full py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-stone-600" />
                  <span>ตรวจสอบออเดอร์ ({activeOrders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('customer_links')}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
                >
                  <Share2 className="w-4 h-4 text-yellow-200" />
                  <span>สร้างลิงก์สั่งของลูกค้า (ไม่มีเมนูแอดมิน)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="w-full py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-stone-600" />
                  <span>ตั้งค่าร้านค้า & พิกัด</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. จัดการสินค้า (PRODUCTS MANAGEMENT)                     */}
      {/* ======================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Success Banner when product is saved */}
          {lastSavedProductName && (
            <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-2xl flex items-center justify-between text-xs text-emerald-900 shadow-2xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  บันทึกสินค้า <strong>"{lastSavedProductName}"</strong> เรียบร้อยแล้ว! ข้อมูลแสดงบนหน้าแรกของร้านทันที
                </span>
              </div>
              <a
                href="/"
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold text-[11px] hover:bg-emerald-700 transition-colors shadow-2xs flex items-center gap-1 shrink-0"
              >
                <span>ดูที่หน้าแรก</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Action & Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl sm:rounded-3xl border border-stone-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อสินค้าในสต็อก..."
                  className="w-full bg-transparent focus:outline-hidden text-stone-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={productCatFilter}
                  onChange={(e) => setProductCatFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 focus:outline-hidden"
                >
                  <option value="all">ทุกหมวดหมู่</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-xs cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มสินค้า</span>
                </button>
              </div>
            </div>

            {/* Product Status Filter Bar & Out of stock batch delete */}
            <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setProductStockStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                    productStockStatusFilter === 'all'
                      ? 'bg-white text-stone-900 font-bold shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  ทั้งหมด ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProductStockStatusFilter('in_stock')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                    productStockStatusFilter === 'in_stock'
                      ? 'bg-emerald-500 text-white font-bold shadow-2xs'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  พร้อมขาย ({inStockCount})
                </button>
                <button
                  type="button"
                  onClick={() => setProductStockStatusFilter('low_stock')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                    productStockStatusFilter === 'low_stock'
                      ? 'bg-amber-500 text-white font-bold shadow-2xs'
                      : 'text-amber-800 hover:bg-amber-100/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>ใกล้หมด (≤ 5) ({lowStockCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductStockStatusFilter('out_of_stock')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1.5 ${
                    productStockStatusFilter === 'out_of_stock'
                      ? 'bg-red-500 text-white font-bold shadow-2xs'
                      : 'text-red-700 hover:bg-red-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  สินค้าหมด ({outOfStockCount})
                </button>
              </div>

              {/* Batch delete out of stock items button */}
              {outOfStockCount > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllOutOfStock}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                  title="ลบสินค้าที่สต็อกหมดทั้งหมดออกจากระบบ"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>ลบสินค้าที่หมดทั้งหมด ({outOfStockCount} รายการ)</span>
                </button>
              )}
            </div>
          </div>

          {/* Low Stock Alert Banner */}
          {lowStockCount > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0 border border-amber-300/60 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-amber-950">
                      มีสินค้าสต็อกใกล้หมด {lowStockCount} รายการ
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800 border border-amber-300">
                      คงเหลือ ≤ {LOW_STOCK_THRESHOLD} ชิ้น
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    ควรเติมสต็อกสินค้าให้เพียงพอกับการสั่งซื้อ เพื่อป้องกันสินค้าขาดสต็อกหน้าร้าน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductStockStatusFilter(productStockStatusFilter === 'low_stock' ? 'all' : 'low_stock')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                  productStockStatusFilter === 'low_stock'
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/60'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>{productStockStatusFilter === 'low_stock' ? 'แสดงสินค้าทั้งหมด' : 'กรองเฉพาะสินค้าใกล้หมด'}</span>
              </button>
            </div>
          )}

          {/* Products Table */}
          {products.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-3">
              <Boxes className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="font-bold text-base text-stone-800">ยังไม่มีสินค้าในฐานข้อมูล</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                กดปุ่ม "เพิ่มสินค้า" เพื่อเริ่มลงรายการสินค้าจริง รูปภาพ ราคา และจำนวนสต็อกสำหรับร้านขายถูกที่นี่ชุมแพ
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                + เพิ่มสินค้าแรกของร้าน
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                    <tr>
                      <th className="p-3 font-bold">รูปภาพ</th>
                      <th className="p-3 font-bold">ชื่อสินค้า</th>
                      <th className="p-3 font-bold">หมวดหมู่</th>
                      <th className="p-3 font-bold">ราคาขาย</th>
                      <th className="p-3 font-bold">ต้นทุน</th>
                      <th className="p-3 font-bold text-center">สต็อก</th>
                      <th className="p-3 font-bold text-center">สถานะสินค้า</th>
                      <th className="p-3 font-bold text-center">เผยแพร่หน้าร้าน</th>
                      <th className="p-3 font-bold text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredProducts.map((p) => {
                      const isOutOfStock = p.stock <= 0;
                      const isLowStock = p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD;

                      return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isOutOfStock
                            ? 'bg-red-50/25 hover:bg-red-50/50'
                            : isLowStock
                            ? 'bg-amber-50/40 hover:bg-amber-100/40'
                            : 'hover:bg-stone-50/60'
                        }`}
                      >
                        <td className="p-3">
                          <div className="relative w-11 h-11 shrink-0">
                            <img
                              src={p.imageUrl || p.images?.[0]}
                              alt={p.name}
                              className="w-full h-full object-cover rounded-xl border border-stone-200"
                            />
                            {p.images && p.images.length > 1 && (
                              <span className="absolute -bottom-1 -right-1 bg-red-600 text-white text-[9px] font-bold px-1 py-0.2 rounded-md shadow-2xs">
                                {p.images.length} รูป
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-stone-900 flex items-center gap-1.5 flex-wrap">
                            <span>{p.name}</span>
                            {p.sellerName ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200" title={`ลงขายโดย Seller: ${p.sellerName}`}>
                                🏪 {p.sellerName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600">
                                🏠 ร้านหลัก
                              </span>
                            )}
                            {isLowStock && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-2xs">
                                <AlertTriangle className="w-3 h-3 text-white" />
                                <span>ใกล้หมด (เหลือ {p.stock} {p.unit})</span>
                              </span>
                            )}
                            {isOutOfStock && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-600 text-white shadow-2xs">
                                <span>สินค้าหมด</span>
                              </span>
                            )}
                            {p.condition && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                                p.condition === 'new'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.condition === 'used'
                                  ? 'bg-sky-100 text-sky-800'
                                  : p.condition === 'new_defective'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {p.condition === 'new'
                                  ? 'สินค้าใหม่'
                                  : p.condition === 'used'
                                  ? 'สินค้ามือ 2'
                                  : p.condition === 'new_defective'
                                  ? 'ใหม่มีตำหนิ'
                                  : 'งานช่างชำรุด'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-stone-400">หน่วย: {p.unit}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-[10px] font-semibold">
                            {categories.find((c) => c.slug === p.category)?.icon}{' '}
                            {categories.find((c) => c.slug === p.category)?.name || p.category}
                          </span>
                        </td>
                        <td className="p-3 font-black text-red-600">
                          ฿{p.price.toLocaleString()}
                        </td>
                        <td className="p-3 text-stone-500">
                          ฿{p.costPrice || 0}
                        </td>
                        <td className="p-3 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <div className={`inline-flex items-center gap-1 p-0.5 rounded-xl border ${
                              isOutOfStock
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : isLowStock
                                ? 'bg-amber-50 border-amber-300 text-amber-900'
                                : 'bg-stone-100 border-stone-200 text-stone-700'
                            }`}>
                              <button
                                type="button"
                                onClick={() => onUpdateProductStock(p.id, Math.max(0, p.stock - 1))}
                                className="w-5 h-5 rounded-lg bg-white hover:bg-stone-200 flex items-center justify-center font-bold text-stone-700 shadow-2xs cursor-pointer"
                                title="ลด 1"
                              >
                                -
                              </button>
                              <span className={`w-8 text-center font-black ${
                                isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-700' : 'text-stone-800'
                              }`}>
                                {p.stock}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateProductStock(p.id, p.stock + 1)}
                                className="w-5 h-5 rounded-lg bg-white hover:bg-stone-200 flex items-center justify-center font-bold text-stone-700 shadow-2xs cursor-pointer"
                                title="เพิ่ม 1"
                              >
                                +
                              </button>
                            </div>
                            {isLowStock && (
                              <span className="text-[9px] font-bold text-amber-700 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                <span>ควรเติมสต็อก</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => onUpdateProductStock(p.id, p.stock > 0 ? p.stock : 10)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                p.stock > 0
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-stone-600 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title="คลิกเพื่อตั้งสถานะเป็นพร้อมขาย (สต็อก > 0)"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${p.stock > 0 ? 'bg-white' : 'bg-emerald-500'}`} />
                              <span>พร้อมขาย</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateProductStock(p.id, 0)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                p.stock <= 0
                                  ? 'bg-red-600 text-white shadow-2xs'
                                  : 'text-stone-600 hover:text-red-700 hover:bg-red-50'
                              }`}
                              title="คลิกเพื่อตั้งสถานะเป็นสินค้าหมด (สต็อก 0)"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${p.stock <= 0 ? 'bg-white' : 'bg-red-500'}`} />
                              <span>สินค้าหมด</span>
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => onToggleProductActive(p.id, !p.isActive)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              p.isActive
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                            }`}
                          >
                            {p.isActive ? '🟢 เผยแพร่แล้ว' : '⚪ ซ่อนไว้'}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Delete Out of Stock Button if product is out of stock */}
                            {p.stock <= 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`ต้องการลบสินค้า "${p.name}" ที่หมดแล้วนี้ออกจากระบบหรือไม่?`)) {
                                    onDeleteProduct(p.id);
                                  }
                                }}
                                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="ลบสินค้าที่หมดแล้วนี้"
                              >
                                <Trash2 className="w-3 h-3 text-red-600" />
                                <span>ลบสินค้าหมด</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(p);
                                setIsProductModalOpen(true);
                              }}
                              className="p-1.5 text-stone-600 hover:text-blue-600 rounded-lg cursor-pointer transition-colors"
                              title="แก้ไขสินค้า"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`ต้องการลบสินค้า "${p.name}" หรือไม่?`)) {
                                  onDeleteProduct(p.id);
                                }
                              }}
                              className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg cursor-pointer transition-colors"
                              title="ลบสินค้า"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. สร้างลิงก์สั่งซื้อสำหรับลูกค้า (CUSTOMER STOREFRONT LINKS) */}
      {/* ======================================================== */}
      {activeTab === 'customer_links' && (
        <CustomerLinkGenerator
          settings={settings}
          categories={categories}
          totalActiveProducts={products.filter((p) => p.isActive && p.stock > 0).length}
        />
      )}

      {/* ======================================================== */}
      {/* 5. จัดการ Seller (ผู้ขาย) - จำกัด 200 บัญชี                */}
      {/* ======================================================== */}
      {activeTab === 'sellers' && (
        <SellerManagement
          sellers={sellers}
          products={products}
          onSaveSeller={onSaveSeller}
          onDeleteSeller={onDeleteSeller}
        />
      )}

      {/* ======================================================== */}
      {/* 2. การจัดการออเดอร์ (ORDERS MANAGEMENT - 4 STATUS TABS)   */}
      {/* ======================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          
          {/* 4 Status Tabs Bar */}
          <div className="bg-white p-2.5 sm:p-3 rounded-3xl border border-stone-200 shadow-2xs">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              
              {/* Tab 1: ออเดอร์เข้า (เพื่อกดรับออเดอร์) */}
              <button
                type="button"
                onClick={() => {
                  setOrderSubTab('incoming');
                  setOrderStatusFilter('all');
                }}
                className={`p-3 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-2 transition-all cursor-pointer border text-left ${
                  orderSubTab === 'incoming' && orderStatusFilter === 'all'
                    ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                    : 'bg-stone-50/70 border-transparent text-stone-600 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${orderSubTab === 'incoming' && orderStatusFilter === 'all' ? 'bg-amber-200/70 text-amber-900' : 'bg-stone-200/60 text-stone-500'}`}>
                    <Inbox className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm">ออเดอร์เข้า</div>
                    <div className="text-[10px] text-stone-500">เพื่อกดรับออเดอร์</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                  incomingOrders.length > 0
                    ? 'bg-amber-400 text-amber-950 animate-bounce'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {incomingOrders.length}
                </span>
              </button>

              {/* Tab 2: ต้องจัดส่ง (กดยืนยันนำส่ง) */}
              <button
                type="button"
                onClick={() => {
                  setOrderSubTab('to_deliver');
                  setOrderStatusFilter('all');
                }}
                className={`p-3 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-2 transition-all cursor-pointer border text-left ${
                  orderSubTab === 'to_deliver' && orderStatusFilter === 'all'
                    ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-xs'
                    : 'bg-stone-50/70 border-transparent text-stone-600 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${orderSubTab === 'to_deliver' && orderStatusFilter === 'all' ? 'bg-blue-200/70 text-blue-900' : 'bg-stone-200/60 text-stone-500'}`}>
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm">ต้องจัดส่ง</div>
                    <div className="text-[10px] text-stone-500">กดยืนยันนำส่ง</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                  toDeliverOrders.length > 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {toDeliverOrders.length}
                </span>
              </button>

              {/* Tab 3: ส่งสำเร็จ (กดยืนยัน) */}
              <button
                type="button"
                onClick={() => {
                  setOrderSubTab('delivered');
                  setOrderStatusFilter('all');
                }}
                className={`p-3 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-2 transition-all cursor-pointer border text-left ${
                  orderSubTab === 'delivered' && orderStatusFilter === 'all'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-stone-50/70 border-transparent text-stone-600 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${orderSubTab === 'delivered' && orderStatusFilter === 'all' ? 'bg-emerald-200/70 text-emerald-900' : 'bg-stone-200/60 text-stone-500'}`}>
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm">ส่งสำเร็จ</div>
                    <div className="text-[10px] text-stone-500">กดยืนยันปิดงาน</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black shrink-0 ${
                  deliveredOrders.length > 0
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  {deliveredOrders.length}
                </span>
              </button>

              {/* Tab 4: ยกเลิก (กรณีลูกค้าไม่รับ) */}
              <button
                type="button"
                onClick={() => {
                  setOrderSubTab('cancelled');
                  setOrderStatusFilter('all');
                }}
                className={`p-3 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-2 transition-all cursor-pointer border text-left ${
                  orderSubTab === 'cancelled' && orderStatusFilter === 'all'
                    ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-xs'
                    : 'bg-stone-50/70 border-transparent text-stone-600 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${orderSubTab === 'cancelled' && orderStatusFilter === 'all' ? 'bg-rose-200/70 text-rose-900' : 'bg-stone-200/60 text-stone-500'}`}>
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm">ยกเลิก</div>
                    <div className="text-[10px] text-stone-500">กรณีลูกค้าไม่รับ</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-stone-200 text-stone-600 shrink-0">
                  {cancelledOrders.length}
                </span>
              </button>

            </div>
          </div>

          {/* Search bar & Filter Dropdown inside Orders Tab */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            {/* Search Input */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 focus-within:border-red-500 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="ค้นหาตามเลขที่ออเดอร์, ชื่อลูกค้า, เบอร์โทร หรือสินค้า..."
                className="w-full bg-transparent focus:outline-hidden text-stone-900 placeholder:text-stone-400 text-xs"
              />
              {orderSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOrderSearchQuery('')}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Dropdown to allow viewing orders by status */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="order-status-filter" className="font-bold text-stone-700 flex items-center gap-1.5 shrink-0 text-xs">
                <Filter className="w-3.5 h-3.5 text-red-600" />
                <span>กรองสถานะ:</span>
              </label>
              <select
                id="order-status-filter"
                value={orderStatusFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setOrderStatusFilter(val);
                  if (val === 'pending') setOrderSubTab('incoming');
                  else if (val === 'confirmed' || val === 'preparing' || val === 'processing') setOrderSubTab('to_deliver');
                  else if (val === 'delivering' || val === 'completed') setOrderSubTab('delivered');
                  else if (val === 'cancelled') setOrderSubTab('cancelled');
                }}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-800 font-bold text-xs focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500 cursor-pointer shadow-2xs"
              >
                <option value="all">ทุกสถานะ (ตามแท็บ)</option>
                <option value="pending">🟡 รอรับออเดอร์ (Pending)</option>
                <option value="processing">🟣 กำลังจัดเตรียม (Processing / Preparing)</option>
                <option value="confirmed">🔵 รับออเดอร์แล้ว (Confirmed)</option>
                <option value="delivering">🚚 กำลังนำส่ง (Delivering)</option>
                <option value="completed">🟢 ส่งสำเร็จแล้ว (Completed)</option>
                <option value="cancelled">🔴 ยกเลิกแล้ว (Cancelled)</option>
              </select>
            </div>

            <div className="w-full sm:w-auto text-right font-semibold text-stone-500 text-[11px] flex items-center justify-between sm:justify-end gap-2">
              <span>
                แสดง <strong className="text-stone-800">{currentSubTabOrders.length}</strong> รายการ
              </span>
              {orderStatusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('all')}
                  className="text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
                >
                  (✕ ล้างตัวกรอง)
                </button>
              )}
            </div>
          </div>

          {/* Orders list in current Subtab / Filter */}
          {currentSubTabOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-xs text-stone-500 space-y-2">
              <div className="text-3xl">📦</div>
              <div className="font-bold text-stone-700 text-sm">ไม่มีออเดอร์ในสถานะที่เลือก</div>
              <p className="text-stone-400">
                {orderStatusFilter !== 'all'
                  ? `ไม่พบออเดอร์ที่มีสถานะ "${orderStatusFilter}" ในขณะนี้`
                  : orderSubTab === 'incoming'
                  ? 'ไม่มีออเดอร์เข้าใหม่ที่รอรับในขณะนี้'
                  : orderSubTab === 'to_deliver'
                  ? 'ไม่มีออเดอร์ที่ต้องนำส่งในขณะนี้'
                  : orderSubTab === 'delivered'
                  ? 'ยังไม่มีออเดอร์ที่นำส่งสำเร็จ'
                  : 'ไม่มีประวัติออเดอร์ที่ถูกยกเลิก'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentSubTabOrders.map((order) => {
                const isUpdating = updatingOrderId === order.id;

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl border border-stone-200 p-4 sm:p-5 shadow-xs space-y-3.5 hover:border-amber-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Order Header: ID, Time, Fulfillment Badge */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-stone-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-stone-900">
                              #{order.orderNumber || order.id.slice(-6)}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              order.status === 'pending'
                                ? 'bg-amber-100 text-amber-900'
                                : order.status === 'confirmed' || order.status === 'preparing'
                                ? 'bg-blue-100 text-blue-900'
                                : order.status === 'delivering'
                                ? 'bg-purple-100 text-purple-900 animate-pulse'
                                : order.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-rose-100 text-rose-900'
                            }`}>
                              {order.status === 'pending' && 'ออเดอร์เข้าใหม่'}
                              {order.status === 'confirmed' && 'รับออเดอร์แล้ว'}
                              {order.status === 'preparing' && 'กำลังเตรียมสินค้า'}
                              {order.status === 'delivering' && 'กำลังนำส่ง'}
                              {order.status === 'completed' && 'ส่งสำเร็จแล้ว'}
                              {order.status === 'cancelled' && 'ยกเลิกแล้ว'}
                            </span>
                            {order.lineNotifyStatus === 'sent' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1 shrink-0" title={`ส่งแจ้งเตือนเข้า LINE แล้ว${order.lineNotifiedAt ? ` (${new Date(order.lineNotifiedAt).toLocaleTimeString('th-TH')})` : ''}`}>
                                <MessageCircle className="w-2.5 h-2.5 text-emerald-600" />
                                <span>LINE แล้ว</span>
                              </span>
                            )}
                            {order.lineNotifyStatus === 'failed' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 flex items-center gap-1 shrink-0" title={order.lineNotifyError || 'ส่ง LINE ไม่สำเร็จ'}>
                                <span>⚠️ LINE ไม่สำเร็จ</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(order.createdAt).toLocaleString('th-TH')}</span>
                          </div>
                        </div>

                        {/* Fulfillment Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 ${
                          order.fulfillmentType === 'pickup'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : order.fulfillmentType === 'meetup'
                            ? 'bg-purple-50 text-purple-800 border border-purple-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          {order.fulfillmentType === 'pickup' ? (
                            <>🏪 รับสินค้าที่ร้าน</>
                          ) : order.fulfillmentType === 'meetup' ? (
                            <>🤝 นัดรับสินค้า (099-225-6601)</>
                          ) : (
                            <>🛵 ให้นำส่ง {order.distanceKm ? `(~${order.distanceKm} กม.)` : ''}</>
                          )}
                        </span>
                      </div>

                      {/* Customer Info Box */}
                      <div className="p-3 bg-stone-50 rounded-2xl text-xs space-y-1.5">
                        <div className="font-bold text-stone-900 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-stone-500" />
                            {order.customerName}
                          </span>
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-bold bg-white px-2 py-0.5 rounded-lg border border-stone-200 shadow-2xs hover:border-red-300"
                          >
                            <Phone className="w-3 h-3" />
                            <span>โทร {order.customerPhone}</span>
                          </a>
                        </div>
                        <div className="text-stone-600 text-[11px] flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{order.deliveryAddress || 'รับสินค้าที่ร้านชุมแพ'}</span>
                        </div>
                        {order.notes && (
                          <div className="text-[11px] text-amber-900 bg-amber-50 p-1.5 rounded-lg border border-amber-200/60">
                            <strong>หมายเหตุลูกค้า:</strong> {order.notes}
                          </div>
                        )}
                      </div>

                      {/* รายละเอียดสินค้าที่แสดงใน tab: 1) รูปสินค้าไม่ต้องใหญ่มาก 2) ชื่อสินค้า 3) ราคา */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-stone-500">
                          รายการสินค้า ({order.items?.length || 0})
                        </div>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto divide-y divide-stone-100 pr-1">
                          {order.items.map((it, idx) => {
                            const matchedProd = products.find((p) => p.id === it.productId);
                            const itemImage = it.imageUrl || matchedProd?.imageUrl;

                            return (
                              <div key={idx} className="pt-1.5 first:pt-0 flex items-center gap-2.5">
                                {/* 1) รูปสินค้าไม่ต้องใหญ่มาก */}
                                <div className="w-12 h-12 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-stone-200">
                                  {itemImage ? (
                                    <img
                                      src={itemImage}
                                      alt={it.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 font-bold">
                                      สินค้า
                                    </div>
                                  )}
                                </div>

                                {/* 2) ชื่อสินค้า */}
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-stone-900 text-xs truncate">
                                    {it.name}
                                  </div>
                                  <div className="text-[11px] text-stone-500">
                                    จำนวน: <span className="font-bold text-stone-800">{it.quantity} {it.unit}</span>
                                  </div>
                                </div>

                                {/* 3) ราคา */}
                                <div className="text-right shrink-0">
                                  <div className="font-black text-red-600 text-xs sm:text-sm">
                                    ฿{it.subtotal.toLocaleString()}
                                  </div>
                                  <div className="text-[10px] text-stone-400">
                                    @฿{it.price.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Total Breakdown */}
                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                        <div className="text-stone-500">
                          ค่าจัดส่ง: {
                            order.fulfillmentType === 'pickup'
                              ? 'ฟรี (รับที่ร้าน)'
                              : order.fulfillmentType === 'meetup'
                              ? 'ยังไม่รวมค่าส่ง'
                              : `฿${order.deliveryFee}`
                          }
                        </div>
                        <div className="font-black text-sm sm:text-base text-red-600">
                          ยอดรวมสุทธิ: ฿{order.totalAmount.toLocaleString()}
                          {order.fulfillmentType === 'meetup' && (
                            <span className="text-[10px] text-amber-700 block font-normal text-right">
                              *ยังไม่รวมค่าจัดส่ง
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ถ่ายรูปการรับสินค้าแนบ กรณีจัดส่งแล้ว / ส่งสำเร็จ */}
                      {(order.status === 'delivering' || order.status === 'completed') && (
                        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 bg-stone-50/70 p-2.5 rounded-2xl">
                          <div className="flex items-center gap-2">
                            {order.deliveryProofImageUrl ? (
                              <div className="flex items-center gap-2">
                                <a
                                  href={order.deliveryProofImageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-400 shrink-0 block shadow-2xs"
                                  title="คลิกเพื่อดูรูปหลักฐานขนาดเต็ม"
                                >
                                  <img
                                    src={order.deliveryProofImageUrl}
                                    alt="รูปการรับสินค้า"
                                    className="w-full h-full object-cover"
                                  />
                                </a>
                                <div>
                                  <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>แนบรูปรับสินค้าแล้ว</span>
                                  </div>
                                  {order.deliveryProofTimestamp && (
                                    <div className="text-[10px] text-stone-400">
                                      {new Date(order.deliveryProofTimestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                                <Camera className="w-3.5 h-3.5 text-amber-600" />
                                <span>ยังไม่ได้แนบรูปรับสินค้า</span>
                              </div>
                            )}
                          </div>

                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95">
                            {uploadingProofOrderId === order.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                                <span>กำลังบันทึกรูป...</span>
                              </>
                            ) : (
                              <>
                                <Camera className="w-3.5 h-3.5 text-amber-700" />
                                <span>{order.deliveryProofImageUrl ? 'เปลี่ยนรูปรับสินค้า' : 'ถ่ายรูปการรับสินค้าแนบ'}</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              disabled={uploadingProofOrderId === order.id}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleAttachDeliveryProof(order.id, f);
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar: 4) ปุ่มดูรายละเอียด + Action Buttons (เดินหน้าห้ามย้อนกลับ) */}
                    <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                      {/* 4) ปุ่มดูรายละเอียด */}
                      <button
                        type="button"
                        onClick={() => setInspectingOrder(order)}
                        className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-stone-600" />
                        <span>ดูรายละเอียด</span>
                      </button>

                      {/* One-way progression actions */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        
                        {/* Tab 1 (ออเดอร์เข้า): กดรับออเดอร์ -> ย้ายไปต้องจัดส่ง */}
                        {order.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleCancelOrder(order)}
                              className="px-2.5 py-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold cursor-pointer border border-stone-200 transition-colors"
                            >
                              ยกเลิก (ลูกค้าไม่รับ)
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleAdvanceStatus(order, 'preparing')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                            >
                              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>กดรับออเดอร์</span>
                            </button>
                          </>
                        )}

                        {/* Tab 2 (ต้องจัดส่ง): กดยืนยันนำส่ง -> ย้ายไปส่งสำเร็จ */}
                        {(order.status === 'confirmed' || order.status === 'preparing') && (
                          <>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleCancelOrder(order)}
                              className="px-2.5 py-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold cursor-pointer border border-stone-200 transition-colors"
                            >
                              ยกเลิก (ลูกค้าไม่รับ)
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleAdvanceStatus(order, 'delivering')}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                            >
                              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                              <span>กดยืนยันนำส่ง</span>
                            </button>
                          </>
                        )}

                        {/* Tab 3 (ส่งสำเร็จ): กดยืนยันปิดงาน / แสดงส่งสำเร็จ */}
                        {order.status === 'delivering' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleAdvanceStatus(order, 'completed')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                          >
                            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            <span>กดยืนยันส่งสำเร็จ</span>
                          </button>
                        )}

                        {order.status === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span>ยืนยันส่งสำเร็จเรียบร้อย</span>
                          </span>
                        )}

                        {/* Tab 4 (ยกเลิก): แสดงสถานะยกเลิก */}
                        {order.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 text-stone-600 border border-stone-200 text-xs font-semibold">
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            <span>ลูกค้าไม่รับ / ยกเลิกแล้ว</span>
                          </span>
                        )}

                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ======================================================== */}
      {/* 4. ประวัติการขาย (SALES HISTORY / CLOSED ORDERS)         */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-stone-50 px-3 py-2 rounded-xl border border-stone-200 focus-within:border-red-500 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="ค้นหาตามเลขที่ออเดอร์, ชื่อลูกค้า, เบอร์โทร..."
                className="w-full bg-transparent focus:outline-hidden text-stone-900 placeholder:text-stone-400 text-xs"
              />
              {historySearchQuery && (
                <button
                  type="button"
                  onClick={() => setHistorySearchQuery('')}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="history-status-filter" className="font-bold text-stone-700 flex items-center gap-1.5 shrink-0 text-xs">
                <Filter className="w-3.5 h-3.5 text-red-600" />
                <span>สถานะ:</span>
              </label>
              <select
                id="history-status-filter"
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-800 font-bold text-xs focus:outline-hidden focus:border-red-500 cursor-pointer shadow-2xs"
              >
                <option value="all">ทั้งหมด (All Closed)</option>
                <option value="completed">🟢 ส่งสำเร็จแล้ว (Completed)</option>
                <option value="cancelled">🔴 ยกเลิกแล้ว (Cancelled)</option>
              </select>
            </div>

            <div className="w-full sm:w-auto text-right font-semibold text-stone-500 text-[11px] flex items-center justify-between sm:justify-end gap-2">
              <span>
                แสดง <strong className="text-stone-800">{filteredHistoryOrders.length}</strong> / {historyOrders.length} รายการ
              </span>
              {historyStatusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('all')}
                  className="text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
                >
                  (✕ ล้างตัวกรอง)
                </button>
              )}
            </div>
          </div>

          {filteredHistoryOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-xs text-stone-500">
              ยังไม่มีประวัติการขายที่ปิดงาน
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
                    <tr>
                      <th className="p-3 font-bold">เลขที่ออเดอร์</th>
                      <th className="p-3 font-bold">วันที่ / เวลา</th>
                      <th className="p-3 font-bold">ลูกค้า</th>
                      <th className="p-3 font-bold">ชำระเงิน</th>
                      <th className="p-3 font-bold">สถานะ</th>
                      <th className="p-3 font-bold text-right">ยอดรวมสุทธิ</th>
                      <th className="p-3 font-bold text-center">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredHistoryOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-stone-50/60">
                        <td className="p-3 font-mono font-bold text-stone-900">
                          #{o.orderNumber || o.id.slice(-6)}
                        </td>
                        <td className="p-3 text-stone-500">
                          {new Date(o.createdAt).toLocaleString('th-TH')}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold">{o.customerName}</div>
                          <div className="text-[10px] text-stone-400">{o.customerPhone}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px]">
                            {o.paymentMethod === 'promptpay' ? 'PromptPay' : 'เก็บปลายทาง'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                              o.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {o.status === 'completed' ? 'จัดส่งสำเร็จ' : 'ยกเลิก'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-red-600">
                          ฿{o.totalAmount.toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setInspectingOrder(o)}
                            className="p-1.5 text-stone-600 hover:text-blue-600 rounded-lg cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. รายงานยอดขาย (RECHARTS PERFORMANCE & ANALYTICS)        */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
              <div className="text-[11px] text-stone-500 font-semibold">ยอดขายวันนี้</div>
              <div className="text-xl sm:text-2xl font-black text-red-600">
                ฿{salesMetrics.todaySales.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
              <div className="text-[11px] text-stone-500 font-semibold">ยอดขายรวม ({salesDateRange})</div>
              <div className="text-xl sm:text-2xl font-black text-stone-900">
                ฿{salesMetrics.totalRevenue.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
              <div className="text-[11px] text-stone-500 font-semibold">ประมาณการกำไรสุทธิ</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600">
                ฿{salesMetrics.estimatedProfit.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
              <div className="text-[11px] text-stone-500 font-semibold">ต้นทุนสินค้ารวม</div>
              <div className="text-xl sm:text-2xl font-black text-amber-600">
                ฿{salesMetrics.totalCost.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Recharts Visual Trends - Daily & Weekly Interactive Module */}
          <SalesAnalyticsChart orders={orders} defaultMode="weekly" />

          {/* Secondary Distribution & Status breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Donut Chart */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-amber-200 shadow-xs flex flex-col justify-between space-y-2">
              <h3 className="font-bold text-sm text-stone-900">สัดส่วนสถานะออเดอร์</h3>
              <div className="w-full h-48 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3}>
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-stone-900">{orders.length}</span>
                  <span className="text-[10px] text-stone-500">ออเดอร์ทั้งหมด</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {statusDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-1 bg-stone-50 rounded">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales Highlights & Performance Summary */}
            <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-3xl border border-amber-200 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <h3 className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> สรุปประสิทธิภาพร้านค้า
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  ภาพรวมประสิทธิภาพการขายและการจัดส่งของร้าน
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <div className="text-[10px] text-stone-500 font-semibold">อัตราส่งสำเร็จ</div>
                  <div className="text-lg font-black text-emerald-600">
                    {orders.length > 0
                      ? `${Math.round((orders.filter(o => o.status === 'completed').length / orders.length) * 100)}%`
                      : '0%'}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {orders.filter(o => o.status === 'completed').length} จาก {orders.length} ออเดอร์
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <div className="text-[10px] text-stone-500 font-semibold">เฉลี่ยต่อวัน (7 วัน)</div>
                  <div className="text-lg font-black text-amber-600">
                    ฿{Math.round(total7DayRevenue / 7).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {avgDailyOrders} ออเดอร์/วัน
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <div className="text-[10px] text-stone-500 font-semibold">ออเดอร์รอตรวจสอบ</div>
                  <div className="text-lg font-black text-red-600">
                    {orders.filter(o => o.status === 'pending').length} รายการ
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {orders.filter(o => o.status === 'pending').length > 0 ? '⚠️ มีออเดอร์ต้องกดรับ' : 'ไม่มีออเดอร์ค้าง'}
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                  <div className="text-[10px] text-stone-500 font-semibold">สินค้าพร้อมขาย</div>
                  <div className="text-lg font-black text-blue-600">
                    {products.filter(p => p.isActive && p.stock > 0).length} รายการ
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {products.filter(p => p.stock <= 0).length} รายการสินค้าหมด
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                <span>💡 สลับดูกราฟรายวันและรายสัปดาห์ได้ที่ปุ่มด้านบน</span>
                <span className="font-bold text-amber-800">อัปเดตแบบเรียลไทม์</span>
              </div>
            </div>
          </div>

          {/* Date range filter & CSV Export */}
          <div className="bg-white p-3 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold">ช่วงเวลา:</span>
              {(['today', '7days', '30days', 'all'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSalesDateRange(r)}
                  className={`px-2.5 py-1 rounded-lg font-bold ${salesDateRange === r ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-600'}`}
                >
                  {r === 'today' && 'วันนี้'}
                  {r === '7days' && '7 วัน'}
                  {r === '30days' && '30 วัน'}
                  {r === 'all' && 'ทั้งหมด'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ส่งออก Excel (CSV)</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. ตั้งค่าร้าน (STORE SETTINGS)                           */}
      {/* ======================================================== */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div>
              <h3 className="font-extrabold text-base text-stone-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-red-600" /> ตั้งค่าร้านค้า & พิกัดจัดส่ง
              </h3>
              <p className="text-xs text-stone-500">
                พิกัดร้านขายถูกที่นี่ชุมแพ: 16.525223, 102.101480 • เบอร์โทร: 099-225-6601
              </p>
            </div>
          </div>

          {settingsSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{settingsSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettingsSubmit} className="space-y-4 text-xs">
            {/* Open / Close Store Toggle */}
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-stone-900">สถานะเปิด-ปิดร้านค้า</span>
                <p className="text-[11px] text-stone-500">
                  {settingsForm.isOpen ? 'ขณะนี้ร้านเปิดรับออเดอร์ตามปกติ' : 'ขณะนี้ปิดรับออเดอร์ชั่วคราว'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.isOpen}
                  onChange={(e) => setSettingsForm({ ...settingsForm, isOpen: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>

            {/* Store Cover Image Section (รูปภาพหน้าปกร้านค้า) */}
            <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-stone-900 flex items-center gap-1.5 text-xs">
                    <Camera className="w-4 h-4 text-amber-600" />
                    <span>รูปภาพหน้าปกร้านค้า (Store Banner Cover)</span>
                  </span>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    รูปภาพที่จะแสดงด้านบนสุดของหน้าร้านทุกลิงก์ (ระบบจะใช้รูปนี้เป็นรูปหลักและไม่เปลี่ยนกลับเป็นรูปเดิม)
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isCustomCoverImage(settingsForm)
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-stone-700'
                }`}>
                  {isCustomCoverImage(settingsForm) ? '✓ รูปล่าสุดที่บันทึก' : 'รูปเริ่มต้น'}
                </span>
              </div>

              {/* Cover Preview Image */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-300 bg-stone-900 group shadow-2xs">
                <img
                  src={getActiveCoverImage(settingsForm)}
                  alt="รูปหน้าปกร้าน"
                  className="w-full h-auto object-cover max-h-[160px]"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== DEFAULT_COVER_IMAGE) {
                      target.src = DEFAULT_COVER_IMAGE;
                    } else if (target.src !== STATIC_COVER_IMAGE) {
                      target.src = STATIC_COVER_IMAGE;
                    }
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCoverModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>เปลี่ยนรูปภาพหน้าปก อย่างง่าย</span>
                </button>

                <span className="text-[11px] text-stone-500">
                  รองรับ: ถ่ายภาพจากมือถือ / อัปโหลดไฟล์ / ใส่ลิงก์ URL
                </span>
              </div>
            </div>

            {/* Phone & Store Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">ชื่อร้าน</label>
                <input
                  type="text"
                  required
                  value={settingsForm.storeName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, storeName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">เบอร์โทรศัพท์ร้านค้า</label>
                <input
                  type="text"
                  required
                  value={settingsForm.storePhone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, storePhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden font-bold"
                />
              </div>
            </div>

            {/* Coordinates */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-red-600" /> พิกัดร้านค้าชุมแพ (จุดเริ่มต้นจัดส่ง)
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">Latitude (ละติจูด)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={settingsForm.storeLat}
                    onChange={(e) => setSettingsForm({ ...settingsForm, storeLat: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">Longitude (ลองจิจูด)</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={settingsForm.storeLng}
                    onChange={(e) => setSettingsForm({ ...settingsForm, storeLng: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Rates */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-600" /> กำหนดอัตราค่าจัดส่ง
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">ค่าส่งเริ่มต้น (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={settingsForm.baseDeliveryFee}
                    onChange={(e) => setSettingsForm({ ...settingsForm, baseDeliveryFee: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">ต่อ กม. ถัดไป (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={settingsForm.perKmFee}
                    onChange={(e) => setSettingsForm({ ...settingsForm, perKmFee: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">ส่งฟรีเมื่อครบ (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={settingsForm.freeDeliveryThreshold}
                    onChange={(e) => setSettingsForm({ ...settingsForm, freeDeliveryThreshold: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden font-bold text-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* PromptPay Info */}
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
              <span className="font-bold text-stone-900 flex items-center gap-1.5 text-xs">
                <CreditCard className="w-4 h-4 text-blue-600" /> ข้อมูลบัญชีรับเงิน PromptPay
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">เบอร์พร้อมเพย์ / เลขบัตร</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.promptpayNumber || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, promptpayNumber: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">ชื่อบัญชีรับเงิน</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.promptpayName || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, promptpayName: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* LINE Notify Integration */}
            <div className="p-4 bg-emerald-50/80 rounded-2xl border-2 border-emerald-300 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-stone-900">
                      ระบบแจ้งเตือนออเดอร์ใหม่เข้า LINE Notify
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      แจ้งเตือนเข้ามือถือเจ้าของร้านทันที โดยไม่ต้องเปิดหน้าจอแอดมินทิ้งไว้
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.lineNotifyEnabled ?? true}
                    onChange={(e) => setSettingsForm({ ...settingsForm, lineNotifyEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-800">
                    LINE Notify Access Token
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLineHelpGuide(!showLineHelpGuide)}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{showLineHelpGuide ? 'ซ่อนวิธีขอ Token' : 'วิธีขอ Token ฟรี'}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showLineToken ? 'text' : 'password'}
                    placeholder="วาง LINE Notify Access Token ที่นี่..."
                    value={settingsForm.lineNotifyToken || ''}
                    onChange={(e) => {
                      setSettingsForm({ ...settingsForm, lineNotifyToken: e.target.value });
                      setLineNotifyTestResult(null);
                    }}
                    className="w-full pl-3 pr-16 py-2 rounded-xl border border-stone-200 focus:outline-hidden font-mono text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLineToken(!showLineToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    {showLineToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Guide accordion */}
              {showLineHelpGuide && (
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 text-xs text-stone-600 space-y-2 animate-fadeIn">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>💡 วิธีขอ LINE Notify Token (ใช้เวลา 1 นาที ฟรี 100%):</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
                    <li>เข้าเว็บไซต์ <a href="https://notify-bot.line.me" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">notify-bot.line.me</a> ผ่านมือถือหรือคอมพิวเตอร์</li>
                    <li>ล็อกอินด้วยบัญชี LINE แล้วกดที่ชื่อมุมขวาบน เลือก <strong>"หน้าของฉัน (My Page)"</strong></li>
                    <li>เลื่อนลงมากดปุ่ม <strong>"ออก Access Token (Generate token)"</strong></li>
                    <li>ตั้งชื่อบอท เช่น <strong>"ร้านชุมแพ"</strong> และเลือกแชทที่ต้องการรับ (แนะนำเลือกแชท 1-on-1 หรือกลุ่มร้านค้า)</li>
                    <li>คัดลอกรหัส Token นำมาวางในช่องด้านบนนี้ แล้วกดปุ่ม <strong>"บันทึกการตั้งค่าร้าน"</strong></li>
                  </ol>
                </div>
              )}

              {/* Test button & status */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200/60">
                <button
                  type="button"
                  disabled={isTestingLineNotify || !settingsForm.lineNotifyToken?.trim()}
                  onClick={async () => {
                    if (!settingsForm.lineNotifyToken?.trim()) return;
                    setIsTestingLineNotify(true);
                    setLineNotifyTestResult(null);
                    try {
                      const res = await sendLineNotifyTest(settingsForm.lineNotifyToken);
                      setLineNotifyTestResult({ success: res.success, message: res.message });
                    } catch (err: any) {
                      setLineNotifyTestResult({ success: false, message: err?.message || 'ทดสอบล้มเหลว' });
                    } finally {
                      setIsTestingLineNotify(false);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                    settingsForm.lineNotifyToken?.trim()
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  {isTestingLineNotify ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังส่งข้อความทดสอบ...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>🧪 ทดสอบส่งข้อความเข้า LINE ทันที</span>
                    </>
                  )}
                </button>

                {lineNotifyTestResult && (
                  <div
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 ${
                      lineNotifyTestResult.success
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    {lineNotifyTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    <span>{lineNotifyTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-2"
              >
                {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>บันทึกการตั้งค่าร้าน</span>
              </button>
            </div>
          </form>
        </div>
      )}
        </main>
      </div>

      {/* Order Detail Modal with Comprehensive Product Table */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4">
          <div className="relative bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base sm:text-lg text-stone-900">
                    รายละเอียดออเดอร์ #{inspectingOrder.orderNumber || inspectingOrder.id.slice(-6)}
                  </h3>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    inspectingOrder.status === 'pending'
                      ? 'bg-amber-100 text-amber-900'
                      : inspectingOrder.status === 'confirmed' || inspectingOrder.status === 'preparing'
                      ? 'bg-blue-100 text-blue-900'
                      : inspectingOrder.status === 'delivering'
                      ? 'bg-purple-100 text-purple-900'
                      : inspectingOrder.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-rose-100 text-rose-900'
                  }`}>
                    {inspectingOrder.status === 'pending' && 'ออเดอร์เข้าใหม่'}
                    {inspectingOrder.status === 'confirmed' && 'รับออเดอร์แล้ว'}
                    {inspectingOrder.status === 'preparing' && 'กำลังจัดเตรียม'}
                    {inspectingOrder.status === 'delivering' && 'กำลังนำส่ง'}
                    {inspectingOrder.status === 'completed' && 'ส่งสำเร็จแล้ว'}
                    {inspectingOrder.status === 'cancelled' && 'ยกเลิกแล้ว'}
                  </span>
                </div>
                <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>สั่งเมื่อ: {new Date(inspectingOrder.createdAt).toLocaleString('th-TH')}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingOrder(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Customer & Fulfillment Information Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="space-y-1">
                <div className="font-bold text-stone-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-stone-500" />
                  <span>ผู้สั่ง: {inspectingOrder.customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-600">เบอร์โทร:</span>
                  <a
                    href={`tel:${inspectingOrder.customerPhone}`}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-bold bg-white px-2 py-0.5 rounded-lg border border-stone-200 shadow-2xs"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{inspectingOrder.customerPhone}</span>
                  </a>
                </div>
                <div className="pt-1">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold text-[11px] ${
                    inspectingOrder.fulfillmentType === 'pickup'
                      ? 'bg-amber-100 text-amber-900'
                      : inspectingOrder.fulfillmentType === 'meetup'
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-blue-100 text-blue-900'
                  }`}>
                    {inspectingOrder.fulfillmentType === 'pickup'
                      ? '🏪 มารับสินค้าที่ร้าน'
                      : inspectingOrder.fulfillmentType === 'meetup'
                      ? '🤝 นัดรับสินค้า (โทร 099-225-6601)'
                      : '🛵 จัดส่งถึงบ้าน'}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-stone-600">
                <div className="flex items-start gap-1">
                  <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-stone-900">ที่อยู่จัดส่ง:</span>{' '}
                    <span>{inspectingOrder.deliveryAddress || 'รับสินค้าที่ร้านชุมแพ'}</span>
                  </div>
                </div>
                {inspectingOrder.distanceKm && (
                  <div className="text-[11px] text-stone-500 pl-5">
                    ระยะทาง: ~{inspectingOrder.distanceKm} กม. • ค่าส่ง: ฿{inspectingOrder.deliveryFee}
                  </div>
                )}
                {inspectingOrder.customerLat && inspectingOrder.customerLng && (
                  <div className="pl-5 pt-0.5">
                    <a
                      href={`https://www.google.com/maps?q=${inspectingOrder.customerLat},${inspectingOrder.customerLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>เปิดพิกัดใน Google Maps ({inspectingOrder.customerLat.toFixed(4)}, {inspectingOrder.customerLng.toFixed(4)})</span>
                    </a>
                  </div>
                )}
                {inspectingOrder.notes && (
                  <div className="pt-1 text-amber-800 bg-amber-50/90 p-2 rounded-xl border border-amber-200 text-[11px]">
                    <strong>หมายเหตุลูกค้า:</strong> {inspectingOrder.notes}
                  </div>
                )}
              </div>
            </div>

            {/* ตารางแสดงสินค้า (Product Items Table as previously created) */}
            <div className="space-y-2">
              <div className="font-black text-xs text-stone-800 uppercase tracking-wider flex items-center justify-between">
                <span>ตารางรายการสินค้าที่สั่งซื้อ</span>
                <span className="text-stone-400 font-normal">ทั้งหมด {inspectingOrder.items.length} รายการ</span>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-stone-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100/80 text-stone-700 font-bold border-b border-stone-200">
                    <tr>
                      <th className="p-2.5 text-center w-10">ลำดับ</th>
                      <th className="p-2.5 w-14">รูป</th>
                      <th className="p-2.5">ชื่อสินค้า</th>
                      <th className="p-2.5 text-right">ราคา/หน่วย</th>
                      <th className="p-2.5 text-center">จำนวน</th>
                      <th className="p-2.5 text-right">รวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {inspectingOrder.items.map((it, idx) => {
                      const matchedProd = products.find((p) => p.id === it.productId);
                      const itemImg = it.imageUrl || matchedProd?.imageUrl;

                      return (
                        <tr key={idx} className="hover:bg-stone-50/60">
                          <td className="p-2.5 text-center font-bold text-stone-400">{idx + 1}</td>
                          <td className="p-2.5">
                            <div className="w-10 h-10 rounded-xl bg-stone-100 overflow-hidden border border-stone-200">
                              {itemImg ? (
                                <img src={itemImg} alt={it.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-stone-400 font-bold">
                                  ภาพ
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-stone-900">{it.name}</div>
                            <div className="text-[10px] text-stone-400">หน่วย: {it.unit}</div>
                          </td>
                          <td className="p-2.5 text-right font-medium text-stone-700">
                            ฿{it.price.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-center font-bold text-stone-900">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="p-2.5 text-right font-black text-red-600">
                            ฿{it.subtotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-stone-50/80 border-t border-stone-200 font-bold text-xs text-stone-800">
                    <tr>
                      <td colSpan={4} className="p-2.5 text-right text-stone-500">ยอดรวมสินค้า:</td>
                      <td colSpan={2} className="p-2.5 text-right font-bold">
                        ฿{inspectingOrder.subtotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="p-2.5 text-right text-stone-500">
                        {inspectingOrder.fulfillmentType === 'pickup'
                          ? 'รับเองที่ร้าน (ไม่มีค่าจัดส่ง):'
                          : inspectingOrder.fulfillmentType === 'meetup'
                          ? 'ค่าจัดส่ง (จุดนัดรับ):'
                          : 'ค่าจัดส่งถึงที่:'}
                      </td>
                      <td colSpan={2} className="p-2.5 text-right font-bold text-stone-700">
                        {inspectingOrder.fulfillmentType === 'pickup'
                          ? '฿0'
                          : inspectingOrder.fulfillmentType === 'meetup'
                          ? 'ยังไม่รวมค่าจัดส่ง'
                          : `฿${inspectingOrder.deliveryFee.toLocaleString()}`}
                      </td>
                    </tr>
                    <tr className="border-t border-stone-200 bg-red-50/40 text-sm">
                      <td colSpan={4} className="p-3 text-right font-black text-stone-900">ยอดชำระสุทธิทั้งสิ้น:</td>
                      <td colSpan={2} className="p-3 text-right font-black text-red-600 text-base">
                        ฿{inspectingOrder.totalAmount.toLocaleString()}
                        {inspectingOrder.fulfillmentType === 'meetup' && (
                          <span className="text-[10px] text-amber-700 block font-normal">
                            *ยังไม่รวมค่าจัดส่ง
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Proof of delivery photo (แนบรูปถ่ายการรับสินค้า) */}
            {inspectingOrder.deliveryProofImageUrl ? (
              <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>📸 รูปถ่ายหลักฐานการรับสินค้า / ส่งมอบสำเร็จ</span>
                  </span>
                  {inspectingOrder.deliveryProofTimestamp && (
                    <span className="text-[11px] font-normal text-stone-500">
                      {new Date(inspectingOrder.deliveryProofTimestamp).toLocaleString('th-TH')}
                    </span>
                  )}
                </div>
                <img
                  src={inspectingOrder.deliveryProofImageUrl}
                  alt="Delivery Proof"
                  className="max-h-64 object-contain rounded-xl border border-emerald-200 mx-auto bg-white shadow-2xs"
                />
              </div>
            ) : (
              (inspectingOrder.status === 'delivering' || inspectingOrder.status === 'completed') && (
                <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 flex items-center justify-between gap-2">
                  <span className="text-xs text-amber-900 font-semibold flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-600" />
                    <span>ยังไม่ได้แนบรูปถ่ายการรับสินค้า</span>
                  </span>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs">
                    <Camera className="w-3.5 h-3.5 text-amber-700" />
                    <span>ถ่ายรูปการรับสินค้าแนบ</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAttachDeliveryProof(inspectingOrder.id, f);
                      }}
                    />
                  </label>
                </div>
              )
            )}

            {/* Slip image if available */}
            {inspectingOrder.slipUrl && (
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                <span className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" /> สลิปหลักฐานการโอนเงิน
                </span>
                <img
                  src={inspectingOrder.slipUrl}
                  alt="Payment Slip"
                  className="max-h-56 object-contain rounded-xl border border-stone-200 mx-auto bg-white shadow-2xs"
                />
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectingOrder(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  ปิดหน้าต่าง
                </button>

                {/* Resend / Send Line Notification Button */}
                <button
                  type="button"
                  disabled={isResendingLineNotify}
                  onClick={async () => {
                    setIsResendingLineNotify(true);
                    setResendLineResult(null);
                    try {
                      const res = await triggerLineNotification(inspectingOrder.id, inspectingOrder);
                      setResendLineResult({ success: res.success, message: res.message });
                      setTimeout(() => setResendLineResult(null), 4000);
                    } catch (err: any) {
                      setResendLineResult({ success: false, message: err?.message || 'ส่งไม่สำเร็จ' });
                    } finally {
                      setIsResendingLineNotify(false);
                    }
                  }}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  title="ส่งข้อมูลออเดอร์นี้เข้า LINE Notify อีกครั้ง"
                >
                  {isResendingLineNotify ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังส่ง LINE...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{inspectingOrder.lineNotifyStatus === 'sent' ? 'ส่งเข้า LINE ซ้ำ' : 'ส่งเข้า LINE'}</span>
                    </>
                  )}
                </button>

                {resendLineResult && (
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${resendLineResult.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {resendLineResult.message}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {inspectingOrder.status === 'pending' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleAdvanceStatus(inspectingOrder, 'preparing');
                      setInspectingOrder(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>กดรับออเดอร์ทันที</span>
                  </button>
                )}

                {(inspectingOrder.status === 'confirmed' || inspectingOrder.status === 'preparing') && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleAdvanceStatus(inspectingOrder, 'delivering');
                      setInspectingOrder(null);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>กดยืนยันนำส่ง</span>
                  </button>
                )}

                {inspectingOrder.status === 'delivering' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleAdvanceStatus(inspectingOrder, 'completed');
                      setInspectingOrder(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>กดยืนยันส่งสำเร็จ</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Edit / Add Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        categories={categories}
        onSave={async (data, isNew) => {
          await onSaveProduct(data, isNew, editingProduct?.id);
          setLastSavedProductName(data.name || 'สินค้าใหม่');
          setTimeout(() => setLastSavedProductName(null), 6000);
        }}
      />

      {/* Cover Image Modal */}
      <CoverImageModal
        isOpen={isCoverModalOpen}
        onClose={() => setIsCoverModalOpen(false)}
        currentCoverUrl={settingsForm.coverImageUrl || settings.coverImageUrl}
        onSaveCover={handleSaveCoverImage}
      />

      {/* GitHub & Source Download Guide Modal */}
      <GitHubGuideModal
        isOpen={isGitHubGuideOpen}
        onClose={() => setIsGitHubGuideOpen(false)}
      />
    </div>
  );
};
