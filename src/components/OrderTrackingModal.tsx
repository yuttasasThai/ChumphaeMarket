import React, { useState } from 'react';
import {
  X,
  Package,
  Clock,
  CheckCircle,
  Truck,
  Check,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  Loader2,
  Undo2,
  Camera,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { cancelOrderWithAtomicStockRestore } from '../firebase';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  currentOrderId?: string;
  onSelectOrder?: (orderId: string) => void;
}

const STATUS_STEPS: { key: OrderStatus; label: string; desc: string }[] = [
  { key: 'pending', label: 'รอรับออเดอร์', desc: 'ร้านค้าได้รับรายการแล้ว' },
  { key: 'confirmed', label: 'ยืนยันออเดอร์', desc: 'ร้านค้ารับคำสั่งซื้อ' },
  { key: 'preparing', label: 'กำลังจัดเตรียม', desc: 'แพ็คสินค้าตามคำสั่งซื้อ' },
  { key: 'delivering', label: 'กำลังจัดส่ง', desc: 'ไรเดอร์กำลังนำส่งถึงบ้าน' },
  { key: 'completed', label: 'จัดส่งสำเร็จ', desc: 'ส่งถึงมือลูกค้าเรียบร้อย' },
];

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  orders,
  currentOrderId,
}) => {
  const [selectedId, setSelectedId] = useState<string>(currentOrderId || (orders[0]?.id ?? ''));
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrder = orders.find((o) => o.id === selectedId) || orders[0];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 0;
      case 'confirmed': return 1;
      case 'preparing': return 2;
      case 'delivering': return 3;
      case 'completed': return 4;
      case 'cancelled': return -1;
      default: return 0;
    }
  };

  const handleCancelOrder = async () => {
    if (!currentOrder) return;
    if (!window.confirm('คุณต้องการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่? ระบบจะคืนสินค้าเข้าสต็อกของร้านค้าโดยอัตโนมัติ')) {
      return;
    }

    setIsCancelling(true);
    setCancelError(null);
    try {
      await cancelOrderWithAtomicStockRestore(currentOrder.id, 'ลูกค้ายกเลิกผ่านหน้าร้าน');
    } catch (err: any) {
      console.error('Cancel order error:', err);
      setCancelError(err?.message || 'ไม่สามารถยกเลิกคำสั่งซื้อได้');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-yellow-300" />
            <h2 className="text-base sm:text-lg font-bold">ติดตามสถานะคำสั่งซื้อ (เรียลไทม์)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {orders.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Package className="w-12 h-12 text-stone-300 mx-auto" />
              <p className="font-bold text-stone-700">ยังไม่มีประวัติคำสั่งซื้อ</p>
              <p className="text-xs text-stone-500">
                เมื่อคุณสั่งซื้อสินค้า ข้อมูลสถานะการจัดส่งจะแสดงที่นี่แบบเรียลไทม์
              </p>
            </div>
          ) : currentOrder ? (
            <div className="space-y-5">
              
              {/* Order selector tabs if multiple orders */}
              {orders.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-stone-100">
                  {orders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedId === o.id
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      #{o.orderNumber || o.id.slice(-6)} • ฿{o.totalAmount}
                    </button>
                  ))}
                </div>
              )}

              {/* Order Meta Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <div>
                  <div className="text-xs font-bold text-stone-900">
                    คำสั่งซื้อเลขที่: <span className="font-mono text-red-600">{currentOrder.orderNumber || currentOrder.id}</span>
                  </div>
                  <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(currentOrder.createdAt).toLocaleString('th-TH')}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      currentOrder.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : currentOrder.status === 'cancelled'
                        ? 'bg-stone-200 text-stone-700'
                        : currentOrder.status === 'delivering'
                        ? 'bg-blue-100 text-blue-800 animate-pulse'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {currentOrder.status === 'pending' && '🕒 รอร้านค้ารับออเดอร์'}
                    {currentOrder.status === 'confirmed' && '✅ ร้านค้ารับออเดอร์แล้ว'}
                    {currentOrder.status === 'preparing' && '📦 กำลังจัดเตรียมสินค้า'}
                    {currentOrder.status === 'delivering' && '🛵 ไรเดอร์กำลังนำส่ง'}
                    {currentOrder.status === 'completed' && '🎉 จัดส่งสำเร็จแล้ว'}
                    {currentOrder.status === 'cancelled' && '❌ ยกเลิกคำสั่งซื้อ'}
                  </span>
                </div>
              </div>

              {/* Live Status Stepper */}
              {currentOrder.status === 'cancelled' ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs sm:text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <span className="font-bold">คำสั่งซื้อนี้ถูกยกเลิกแล้ว</span>
                    <p className="text-xs text-red-600 mt-0.5">
                      {currentOrder.cancelReason || 'ระบบได้คืนจำนวนสินค้าเข้าสต็อกร้านค้าเรียบร้อย'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  <div className="relative flex justify-between items-start">
                    {/* Progress Track */}
                    <div className="absolute top-4 left-6 right-6 h-1 bg-stone-200 -z-0">
                      <div
                        className="h-full bg-red-600 transition-all duration-500"
                        style={{
                          width: `${(getStepIndex(currentOrder.status) / (STATUS_STEPS.length - 1)) * 100}%`,
                        }}
                      />
                    </div>

                    {STATUS_STEPS.map((step, idx) => {
                      const curIdx = getStepIndex(currentOrder.status);
                      const isPast = idx < curIdx;
                      const isCurrent = idx === curIdx;

                      return (
                        <div key={step.key} className="flex flex-col items-center text-center z-10 w-16 sm:w-20">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                              isPast
                                ? 'bg-red-600 text-white'
                                : isCurrent
                                ? 'bg-yellow-400 text-red-900 ring-4 ring-red-200 animate-pulse'
                                : 'bg-stone-200 text-stone-500'
                            }`}
                          >
                            {isPast ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                          </div>
                          <span
                            className={`text-[11px] sm:text-xs font-bold mt-2 ${
                              isCurrent ? 'text-red-600' : 'text-stone-700'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delivery Details */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2 text-xs">
                <div className="font-bold text-stone-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-600" />
                    <span>ข้อมูลการรับ/จัดส่งสินค้า</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                    currentOrder.fulfillmentType === 'pickup'
                      ? 'bg-amber-100 text-amber-900'
                      : currentOrder.fulfillmentType === 'meetup'
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-blue-100 text-blue-900'
                  }`}>
                    {currentOrder.fulfillmentType === 'pickup'
                      ? '🏪 รับสินค้าที่ร้าน'
                      : currentOrder.fulfillmentType === 'meetup'
                      ? '🤝 นัดรับสินค้า'
                      : '🛵 นำส่งถึงบ้าน'}
                  </span>
                </div>
                <div className="text-stone-700">
                  <span className="font-semibold">ผู้รับ:</span> {currentOrder.customerName} (โทร {currentOrder.customerPhone})
                </div>
                <div className="text-stone-700">
                  <span className="font-semibold">
                    {currentOrder.fulfillmentType === 'meetup' ? 'จุดนัดรับ:' : 'ที่อยู่:'}
                  </span>{' '}
                  {currentOrder.deliveryAddress}
                </div>
                {currentOrder.fulfillmentType === 'meetup' && (
                  <div className="text-[11px] text-purple-900 bg-purple-50 p-2 rounded-xl border border-purple-200 flex items-center justify-between">
                    <span>📞 โทรติดต่อเพื่อนัดรับ: <strong>099-225-6601</strong></span>
                    <a
                      href="tel:0992256601"
                      className="px-2 py-0.5 bg-red-600 text-white rounded-lg text-[10px] font-bold"
                    >
                      โทรออก
                    </a>
                  </div>
                )}
                {currentOrder.distanceKm && currentOrder.fulfillmentType === 'delivery' && (
                  <div className="text-stone-600 text-[11px]">
                    ระยะทางถนน: ~{currentOrder.distanceKm} กม. • ค่าส่ง: ฿{currentOrder.deliveryFee}
                  </div>
                )}
              </div>

              {/* Proof of delivery photo shown to customer once attached */}
              {currentOrder.deliveryProofImageUrl && (
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2 text-xs">
                  <div className="font-bold text-emerald-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>📸 รูปถ่ายหลักฐานการรับสินค้า (ส่งมอบสำเร็จ)</span>
                    </span>
                    {currentOrder.deliveryProofTimestamp && (
                      <span className="text-[11px] text-stone-500 font-normal">
                        {new Date(currentOrder.deliveryProofTimestamp).toLocaleString('th-TH')}
                      </span>
                    )}
                  </div>
                  <a
                    href={currentOrder.deliveryProofImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden border border-emerald-300 max-h-56 bg-white shadow-2xs group"
                    title="คลิกดูรูปใหญ่"
                  >
                    <img
                      src={currentOrder.deliveryProofImageUrl}
                      alt="หลักฐานรับสินค้า"
                      className="w-full h-full max-h-56 object-contain mx-auto group-hover:scale-102 transition-transform"
                    />
                  </a>
                </div>
              )}

              {/* Items List */}
              <div className="border border-stone-200 rounded-2xl p-4 divide-y divide-stone-100">
                <div className="font-bold text-xs text-stone-800 pb-2">รายการสินค้าที่สั่งซื้อ</div>
                {currentOrder.items.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-stone-800">{item.name}</span>
                      <span className="text-stone-500 ml-2">x {item.quantity} {item.unit}</span>
                    </div>
                    <div className="font-bold text-stone-900">฿{item.subtotal.toLocaleString()}</div>
                  </div>
                ))}
                <div className="pt-2 flex justify-between font-black text-sm text-red-600">
                  <span>
                    {currentOrder.fulfillmentType === 'meetup'
                      ? 'ยอดรวมค่าสินค้า (ยังไม่รวมค่าส่ง):'
                      : 'ยอดสุทธิรวมค่าส่ง:'}
                  </span>
                  <span>฿{currentOrder.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Cancel Button (Only if pending) */}
              {currentOrder.status === 'pending' && (
                <div className="pt-2">
                  {cancelError && (
                    <div className="text-xs text-red-600 mb-2">{cancelError}</div>
                  )}
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={handleCancelOrder}
                    className="w-full py-2.5 bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 font-bold text-xs rounded-xl border border-stone-300 hover:border-red-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังยกเลิกและคืนสต็อก...</span>
                      </>
                    ) : (
                      <>
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>ยกเลิกคำสั่งซื้อนี้ (คืนสต็อกร้านค้า)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
};
