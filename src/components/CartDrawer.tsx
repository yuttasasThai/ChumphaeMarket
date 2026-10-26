import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Store,
  Truck,
  ExternalLink,
} from 'lucide-react';
import { CartItem, StoreSettings, Order } from '../types';
import { placeOrderWithAtomicStockDeduction } from '../firebase';
import { DistanceCalculationResult } from '../server/distanceHandler';
import { triggerLineNotification } from '../utils/lineNotifyClient';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  settings: StoreSettings;
  customerId?: string;
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onOrderSuccess: (order: Order) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  settings,
  customerId,
  defaultCustomerName = '',
  defaultCustomerPhone = '',
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
}) => {
  // Step in checkout: 'cart' | 'checkout'
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');

  // Customer Form State (pickup, delivery, meetup)
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery' | 'meetup'>('pickup');
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isOutOfAreaAlertOpen, setIsOutOfAreaAlertOpen] = useState(false);

  // Location & Backend Road Calculation
  const [customerLat, setCustomerLat] = useState<number>(settings.storeLat);
  const [customerLng, setCustomerLng] = useState<number>(settings.storeLng);
  const [distanceInfo, setDistanceInfo] = useState<DistanceCalculationResult | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Submission state & error message
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync defaults
  useEffect(() => {
    if (defaultCustomerName && !customerName) setCustomerName(defaultCustomerName);
    if (defaultCustomerPhone && !customerPhone) setCustomerPhone(defaultCustomerPhone);
  }, [defaultCustomerName, defaultCustomerPhone]);

  // Subtotal calculation
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Calculate road distance via backend
  const calculateDistanceThroughBackend = async (lat: number, lng: number) => {
    setIsCalculatingDistance(true);
    try {
      const res = await fetch('/api/calculate-distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: settings.storeLat, lng: settings.storeLng },
          destination: { lat, lng },
          orderSubtotal: subtotal,
        }),
      });

      if (!res.ok) {
        throw new Error('ไม่สามารถคำนวณระยะทางได้');
      }

      const data: DistanceCalculationResult = await res.json();
      setDistanceInfo(data);
      if (data.distanceKm > 12 && fulfillmentType === 'delivery') {
        setIsOutOfAreaAlertOpen(true);
      }
    } catch (err) {
      console.warn('Backend distance calculation error:', err);
      const dist = 3.5;
      const fee = subtotal >= settings.freeDeliveryThreshold ? 0 : settings.baseDeliveryFee;
      setDistanceInfo({
        origin: { lat: settings.storeLat, lng: settings.storeLng },
        destination: { lat, lng },
        distanceKm: dist,
        durationMinutes: 10,
        calculationMethod: 'calibrated_road_curvature',
        deliveryFee: fee,
        freeDeliveryEligible: fee === 0,
        note: 'คำนวณตามโครงข่ายถนนชุมแพ',
      });
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // Trigger distance calculation when location changes in delivery mode
  useEffect(() => {
    if (isOpen && step === 'checkout' && fulfillmentType === 'delivery' && customerLat && customerLng) {
      calculateDistanceThroughBackend(customerLat, customerLng);
    }
  }, [isOpen, step, fulfillmentType, customerLat, customerLng, subtotal]);

  // Check out of area when distanceInfo changes or switching to delivery
  useEffect(() => {
    if (fulfillmentType === 'delivery' && distanceInfo && distanceInfo.distanceKm > 12) {
      setIsOutOfAreaAlertOpen(true);
    }
  }, [fulfillmentType, distanceInfo]);

  // Handle GPS location acquisition
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง GPS');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCustomerLat(lat);
        setCustomerLng(lng);
        calculateDistanceThroughBackend(lat, lng);
      },
      (err) => {
        setIsLocating(false);
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณากรอกที่อยู่และจุดสังเกต');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Delivery fee & Total amount
  const deliveryFee =
    fulfillmentType === 'pickup' || fulfillmentType === 'meetup'
      ? 0
      : distanceInfo
      ? distanceInfo.deliveryFee
      : subtotal >= settings.freeDeliveryThreshold
      ? 0
      : settings.baseDeliveryFee;

  const totalAmount = subtotal + deliveryFee;

  // Handle Final Order Submission with Atomic Firestore Stock Deduction
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If delivery distance > 12 km, block and prompt out-of-area decision
    if (fulfillmentType === 'delivery' && distanceInfo && distanceInfo.distanceKm > 12) {
      setIsOutOfAreaAlertOpen(true);
      return;
    }

    // Form validations
    if (!customerName.trim() || customerName.trim().length < 2) {
      setErrorMessage('กรุณาระบุชื่อ-นามสกุลของผู้รับสินค้าให้ถูกต้อง (อย่างน้อย 2 ตัวอักษร)');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 10) {
      setErrorMessage('กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (9-10 หลัก) เพื่อให้ทางร้านติดต่อได้');
      return;
    }

    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      setErrorMessage('กรุณาระบุที่อยู่จัดส่งโดยละเอียด เช่น เลขที่บ้าน ซอย ถนน จุดสังเกต');
      return;
    }

    if (cart.length === 0) {
      setErrorMessage('ไม่มีสินค้าในตะกร้า');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare order payload
      const orderNumber = `CP-${Date.now().toString().slice(-6)}`;
      const finalAddress =
        fulfillmentType === 'pickup'
          ? `มารับสินค้าเองที่ร้าน (${settings.storeName})`
          : fulfillmentType === 'meetup'
          ? `นัดรับสินค้า: ${deliveryAddress.trim() || 'จุดนัดรับตามที่โทรตกลง'}`
          : deliveryAddress.trim();

      const orderPayload: any = {
        orderNumber,
        customerId: customerId || 'guest',
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        fulfillmentType,
        deliveryAddress: finalAddress,
        customerLat: Number(fulfillmentType === 'pickup' ? settings.storeLat : (customerLat || settings.storeLat)),
        customerLng: Number(fulfillmentType === 'pickup' ? settings.storeLng : (customerLng || settings.storeLng)),
        distanceKm: Number(fulfillmentType === 'pickup' ? 0 : (distanceInfo?.distanceKm || 0)),
        deliveryFee: Number(fulfillmentType === 'meetup' ? 0 : (deliveryFee || 0)),
        subtotal: Number(subtotal),
        totalAmount: Number(totalAmount),
        status: 'pending', // Initial status
        notes: (notes || '').trim(),
        items: cart.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          price: Number(item.product.price),
          costPrice: Number(item.product.costPrice || 0),
          quantity: Number(item.quantity),
          unit: item.product.unit || 'ชิ้น',
          subtotal: Number(item.product.price * item.quantity),
          imageUrl: item.product.imageUrl || '',
        })),
        ...(fulfillmentType === 'meetup'
          ? { deliveryFeeNotice: 'ยังไม่รวมค่าจัดส่ง (นัดหมายจุดรับ โทร 099-225-6601)' }
          : {}),
      };

      // Atomic Transaction: Stock deduction and order record creation
      const orderId = await placeOrderWithAtomicStockDeduction(orderPayload);
      orderPayload.id = orderId;

      // Instant LINE Notify dispatch: notifies shop owner without waiting for admin screen
      triggerLineNotification(orderId, orderPayload).catch((notifyErr) => {
        console.warn('Line Notify trigger warning:', notifyErr);
      });

      // Success callback
      onOrderSuccess(orderPayload);
      onClearCart();
      setStep('cart');
      onClose();
    } catch (err: any) {
      console.error('Error placing order:', err);
      let message = 'เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง';
      if (err?.message) {
        message = err.message;
      }
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full z-10 overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 bg-gradient-to-r from-red-600 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">
              {step === 'cart' ? '🛒 ตะกร้าสินค้าของคุณ' : '📍 ข้อมูลการจัดส่งและชำระเงิน'}
            </h2>
            <span className="text-xs bg-yellow-400 text-red-900 font-extrabold px-2 py-0.5 rounded-full">
              {cart.length} รายการ
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-800 text-xs sm:text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">เกิดข้อผิดพลาด: </span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center text-3xl">
                🛒
              </div>
              <p className="text-base font-bold text-stone-800">ยังไม่มีสินค้าในตะกร้า</p>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                เลือกสินค้าของเล่น กิ๊บช๊อป ของใช้ไฟฟ้า เครื่องมือช่าง ราคาถูกจากร้านขายถูกที่นี่ชุมแพ เพื่อเริ่มสั่งซื้อ
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                เลือกซื้อสินค้าทันที
              </button>
            </div>
          ) : step === 'cart' ? (
            /* STEP 1: CART ITEMS REVIEW */
            <div className="space-y-4">
              <div className="divide-y divide-stone-100 bg-white border border-stone-200 rounded-2xl p-2 shadow-xs">
                {cart.map((item) => {
                  const maxStock = item.product.stock;
                  return (
                    <div
                      key={item.product.id}
                      className="py-3 px-2 flex items-center gap-3 hover:bg-stone-50/50 rounded-xl transition-colors"
                    >
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                          {item.product.name}
                        </h4>
                        <div className="text-[11px] text-stone-500">
                          {item.product.unit} • ฿{item.product.price} / หน่วย
                        </div>
                        <div className="text-xs font-black text-red-600 mt-0.5">
                          ฿{(item.product.price * item.quantity).toLocaleString()}
                        </div>
                      </div>

                      {/* Quantity Controller with Stock Guard */}
                      <div className="flex items-center gap-1.5 bg-stone-100 rounded-xl p-1 border border-stone-200">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-white text-stone-700 hover:bg-stone-200 flex items-center justify-center shadow-xs cursor-pointer"
                          title="ลดจำนวน"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-bold text-xs text-stone-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={item.quantity >= maxStock}
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-xs cursor-pointer ${
                            item.quantity >= maxStock
                              ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                              : 'bg-white text-stone-700 hover:bg-stone-200'
                          }`}
                          title={item.quantity >= maxStock ? `คงเหลือในสต็อก ${maxStock}` : 'เพิ่มจำนวน'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.product.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Free delivery promo tip */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-center justify-between">
                <span>🚚 สั่งครบ {settings.freeDeliveryThreshold} บาท <strong>ส่งฟรี!</strong></span>
                {subtotal < settings.freeDeliveryThreshold ? (
                  <span className="text-red-700 font-bold">
                    ขาดอีก {(settings.freeDeliveryThreshold - subtotal).toLocaleString()} บาท
                  </span>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> รับสิทธิ์ส่งฟรีแล้ว!
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* STEP 2: CHECKOUT & ADDRESS & ROAD CALCULATION */
            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-4">
              {/* Fulfillment Method Selection (3 Options: pickup, delivery, meetup) */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center justify-between">
                  <span>เลือกรูปแบบการรับสินค้า</span>
                  <span className="text-[10px] text-stone-400 font-normal">กรุณาเลือก 1 รูปแบบ</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Option 1: รับสินค้าที่ร้าน */}
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('pickup')}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      fulfillmentType === 'pickup'
                        ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Store className={`w-4 h-4 sm:w-5 sm:h-5 ${fulfillmentType === 'pickup' ? 'text-amber-600' : 'text-stone-400'}`} />
                    <span className="font-bold text-[11px] sm:text-xs">รับที่ร้าน</span>
                    <span className="text-[9px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded-full">
                      ฟรีค่าส่ง
                    </span>
                  </button>

                  {/* Option 2: ให้นำส่งถึงบ้าน */}
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('delivery')}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      fulfillmentType === 'delivery'
                        ? 'bg-blue-50 border-blue-500 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Truck className={`w-4 h-4 sm:w-5 sm:h-5 ${fulfillmentType === 'delivery' ? 'text-blue-600' : 'text-stone-400'}`} />
                    <span className="font-bold text-[11px] sm:text-xs">ให้นำส่งถึงบ้าน</span>
                    <span className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.2 rounded-full">
                      ไม่เกิน 12 กม.
                    </span>
                  </button>

                  {/* Option 3: นัดรับสินค้า */}
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('meetup')}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      fulfillmentType === 'meetup'
                        ? 'bg-purple-50 border-purple-500 text-purple-950 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <MapPin className={`w-4 h-4 sm:w-5 sm:h-5 ${fulfillmentType === 'meetup' ? 'text-purple-600' : 'text-stone-400'}`} />
                    <span className="font-bold text-[11px] sm:text-xs">นัดรับสินค้า</span>
                    <span className="text-[9px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.2 rounded-full">
                      โทรนัดจุดรับ
                    </span>
                  </button>
                </div>

                {/* Pickup details: Store Coordinates Notification */}
                {fulfillmentType === 'pickup' && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1.5 text-xs text-amber-950">
                    <div className="font-bold flex items-center gap-1.5 text-stone-900">
                      <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                      <span>พิกัดร้านค้า: {settings.storeName}</span>
                    </div>
                    <div className="text-[11px] text-stone-600 pl-5 space-y-0.5">
                      <div>พิกัด GPS: <span className="font-mono font-bold text-stone-800">{settings.storeLat}, {settings.storeLng}</span></div>
                      <div>โทรศัพท์ร้าน: <span className="font-bold text-stone-800">{settings.storePhone}</span></div>
                    </div>
                    <div className="pt-1 pl-5">
                      <a
                        href={`https://www.google.com/maps?q=${settings.storeLat},${settings.storeLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-red-600 font-bold rounded-xl border border-amber-300 text-xs shadow-2xs transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>เปิด Google Maps นำทางมาที่ร้าน</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Meetup details: Phone & Notice Notification */}
                {fulfillmentType === 'meetup' && (
                  <div className="p-3 bg-purple-50/90 border border-purple-200 rounded-2xl space-y-2 text-xs text-purple-950">
                    <div className="font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-purple-950">
                        <Phone className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>นัดรับสินค้า: เบอร์โทรติดต่อทางร้าน</span>
                      </span>
                      <a
                        href="tel:0992256601"
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1 shadow-2xs"
                      >
                        <Phone className="w-3 h-3" />
                        <span>099-225-6601</span>
                      </a>
                    </div>
                    <div className="text-[11px] text-stone-600 space-y-1">
                      <div>📞 กรุณาโทรนัดหมายจุดรับสินค้า: <strong className="text-red-600 font-mono text-xs">099-225-6601</strong></div>
                      <div className="text-amber-900 font-semibold bg-amber-50 p-2 rounded-xl border border-amber-200/80">
                        ℹ️ สรุปยอดชำระ: <strong>ส่วนค่าจัดส่ง ยังไม่รวมค่าจัดส่ง</strong> (คิดตามระยะทางจุดนัดรับที่ตกลงกัน)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Contact Details */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-red-600" /> ข้อมูลผู้รับสินค้า
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      ชื่อ-นามสกุล <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="เช่น สมชาย ใจดี"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="เช่น 0812345678"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono"
                    />
                  </div>
                </div>

                {/* Delivery Address & GPS Pinpoint (For Delivery or Meetup) */}
                {fulfillmentType !== 'pickup' && (
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-semibold text-stone-700">
                        {fulfillmentType === 'delivery'
                          ? 'ที่อยู่จัดส่งโดยละเอียด'
                          : 'จุดนัดรับที่สะดวก / สถานที่นัดพบ'}{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      {fulfillmentType === 'delivery' && (
                        <button
                          type="button"
                          onClick={handleGetCurrentLocation}
                          disabled={isLocating}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                        >
                          {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3 text-red-500" />}
                          <span>ปักหมุดพิกัด GPS ปัจจุบัน</span>
                        </button>
                      )}
                    </div>

                    <textarea
                      required
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder={
                        fulfillmentType === 'delivery'
                          ? 'เลขที่บ้าน ซอย ถนน หมู่บ้าน หรือจุดสังเกตในอำเภอชุมแพ'
                          : 'ระบุจุดนัดรับ เช่น หน้าโลตัสชุมแพ, ปั๊ม ปตท., ตลาดสด หรือจุดที่สะดวก'
                      }
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    />

                    {/* Coordinates notification for delivery */}
                    {fulfillmentType === 'delivery' && (
                      <div className="flex items-center justify-between text-[11px] text-stone-500 bg-stone-50 p-2 rounded-xl border border-stone-200">
                        <div className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>พิกัดส่ง: <span className="font-mono text-stone-700">{customerLat.toFixed(5)}, {customerLng.toFixed(5)}</span></span>
                        </div>
                        {isCalculatingDistance && (
                          <span className="text-blue-600 flex items-center gap-1 shrink-0">
                            <Loader2 className="w-3 h-3 animate-spin" /> คำนวณระยะ...
                          </span>
                        )}
                      </div>
                    )}

                    {fulfillmentType === 'delivery' && distanceInfo && (
                      <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        distanceInfo.distanceKm > 12
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : 'bg-blue-50 border-blue-200 text-blue-900'
                      }`}>
                        <span>
                          ระยะทางถนน: ~{distanceInfo.distanceKm} กม.{' '}
                          {distanceInfo.distanceKm > 12 && '(เกิน 12 กม. นอกเขตบริการ)'}
                        </span>
                        <span className="font-bold">
                          {distanceInfo.distanceKm > 12 ? (
                            <span className="text-rose-600 font-black">นอกเขตบริการ</span>
                          ) : distanceInfo.freeDeliveryEligible ? (
                            <span className="text-emerald-600">ส่งฟรี!</span>
                          ) : (
                            `ค่าจัดส่ง: ฿${distanceInfo.deliveryFee}`
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    หมายเหตุเพิ่มเติม (ถ้ามี)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="เช่น โทรแจ้งล่วงหน้า 5 นาที, ต้องการใบเสร็จ"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-hidden"
                  />
                </div>
              </div>

            </form>
          )}
        </div>

        {/* Footer Summary & Action Buttons */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 space-y-3">
            {/* Price Breakdown */}
            <div className="space-y-1 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>ยอดรวมสินค้า ({cart.reduce((c, i) => c + i.quantity, 0)} ชิ้น):</span>
                <span className="font-bold text-stone-900">฿{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>ค่าจัดส่ง:</span>
                <span className="font-bold text-stone-900">
                  {fulfillmentType === 'pickup' ? (
                    <span className="text-emerald-600">ฟรี (รับที่ร้าน)</span>
                  ) : fulfillmentType === 'meetup' ? (
                    <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                      ยังไม่รวมค่าจัดส่ง
                    </span>
                  ) : deliveryFee === 0 ? (
                    <span className="text-emerald-600">ฟรี</span>
                  ) : (
                    `฿${deliveryFee.toLocaleString()}`
                  )}
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-red-600 pt-1 border-t border-stone-200">
                <span>ยอดสุทธิที่ต้องชำระ:</span>
                <div className="text-right">
                  <span>฿{totalAmount.toLocaleString()}</span>
                  {fulfillmentType === 'meetup' && (
                    <div className="text-[10px] text-amber-700 font-normal">
                      (ยังไม่รวมค่าจัดส่ง)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stepper Buttons */}
            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                <span>ดำเนินการสั่งซื้อ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setStep('cart')}
                  className="px-4 py-3 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-extrabold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังตัดสต็อกและบันทึกออเดอร์...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ยืนยันคำสั่งซื้อ (฿{totalAmount.toLocaleString()})</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Out-of-Area Alert Dialog (> 12km) */}
        {isOutOfAreaAlertOpen && (
          <div className="fixed inset-0 z-60 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-200 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-black text-base text-stone-900">
                  แจ้งเตือน: นอกเขตบริการจัดส่งถึงบ้าน
                </h3>
                <p className="text-xs text-rose-700 font-bold bg-rose-50 p-2 rounded-xl border border-rose-200">
                  ระยะทาง ~{distanceInfo?.distanceKm || '> 12'} กม. (เกินกำหนด 12 กิโลเมตร)
                </p>
              </div>

              <div className="text-xs text-stone-600 space-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
                <div className="font-bold text-stone-800">
                  1. นอกเขตบริการ: ทางร้านให้บริการจัดส่งถึงบ้านเฉพาะในรัศมีไม่เกิน 12 กิโลเมตร
                </div>
                <div className="font-bold text-stone-800">
                  2. คุณยังต้องการรับสินค้าหรือไม่?
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {/* Choice A: ไม่ต้องการรับสินค้า -> จบการสั่งสินค้า */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOutOfAreaAlertOpen(false);
                    setStep('cart');
                    onClose();
                    alert('จบการสั่งสินค้า: เนื่องจากอยู่นอกเขตบริการจัดส่งถึงบ้าน ขอบคุณที่ให้ความสนใจร้านค้าครับ');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  ❌ ไม่ต้องการรับสินค้า (จบการสั่งสินค้า)
                </button>

                {/* Choice B: ต้องการรับสินค้า -> เลือกระหว่าง รับที่ร้าน หรือ นัดรับสินค้า */}
                <div className="pt-2 border-t border-stone-100 text-center">
                  <p className="text-[11px] text-stone-500 mb-2 font-semibold">
                    หากต้องการรับสินค้า กรุณาเลือกรูปแบบใหม่:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFulfillmentType('pickup');
                        setIsOutOfAreaAlertOpen(false);
                      }}
                      className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>มารับที่ร้าน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFulfillmentType('meetup');
                        setIsOutOfAreaAlertOpen(false);
                      }}
                      className="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>นัดรับสินค้า</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
