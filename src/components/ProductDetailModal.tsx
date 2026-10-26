import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Truck,
  ShieldCheck,
  Package,
} from 'lucide-react';
import { ProductItem, ProductCondition } from '../types';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null;
  onAddToCart: (product: ProductItem, quantity?: number) => void;
  onBuyNow: (product: ProductItem, quantity?: number) => void;
}

const CONDITION_META: Record<ProductCondition, { label: string; bg: string; text: string }> = {
  new: { label: 'สินค้าใหม่', bg: 'bg-emerald-500', text: 'text-white' },
  used: { label: 'สินค้ามือ 2', bg: 'bg-sky-600', text: 'text-white' },
  new_defective: { label: 'ใหม่มีตำหนิ', bg: 'bg-amber-600', text: 'text-white' },
  repair_parts: { label: 'งานช่างชำรุด', bg: 'bg-purple-700', text: 'text-white' },
};

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  onAddToCart,
  onBuyNow,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAddedToast, setIsAddedToast] = useState(false);

  if (!isOpen || !product) return null;

  // Compile all images: prefer `images` array (3-4 images), fallback to `imageUrl`
  const allImages: string[] =
    product.images && product.images.length > 0
      ? product.images
      : product.imageUrl
      ? [product.imageUrl]
      : ['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80'];

  const currentImage = allImages[selectedImageIndex] || allImages[0];
  const isOutOfStock = product.stock <= 0;
  const cond = product.condition ? CONDITION_META[product.condition] : null;

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  };

  const handleAddToCartClick = () => {
    if (isOutOfStock) return;
    onAddToCart(product, quantity);
    setIsAddedToast(true);
    setTimeout(() => setIsAddedToast(false), 2000);
  };

  const handleBuyNowClick = () => {
    if (isOutOfStock) return;
    onBuyNow(product, quantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4">
      <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full my-auto overflow-hidden border border-amber-200 animate-fadeIn">
        
        {/* Header Bar */}
        <div className="px-4 py-3 bg-gradient-to-r from-red-600 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-yellow-200" />
            <span className="font-bold text-xs sm:text-sm">รายละเอียดสินค้า & สั่งซื้อ</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          
          {/* ======================================================== */}
          {/* 1. PHOTO GALLERY (Shows all 3-4 uploaded photos)          */}
          {/* ======================================================== */}
          <div className="space-y-2.5">
            {/* Main Featured Image Preview */}
            <div className="relative rounded-2xl overflow-hidden bg-stone-950 aspect-4/3 sm:aspect-16/10 flex items-center justify-center border border-stone-200 group">
              <img
                src={currentImage}
                alt={`${product.name} - รูปที่ ${selectedImageIndex + 1}`}
                className="w-full h-full object-contain transition-all duration-300"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';
                }}
              />

              {/* Prev / Next Navigation Arrows (if > 1 image) */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer shadow-md"
                    title="รูปก่อนหน้า"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-xs transition-all cursor-pointer shadow-md"
                    title="รูปถัดไป"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Counter Badge */}
              {allImages.length > 1 && (
                <div className="absolute bottom-2.5 right-2.5 bg-black/75 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs shadow-md">
                  รูปที่ {selectedImageIndex + 1} จาก {allImages.length}
                </div>
              )}

              {/* Condition Badge */}
              {cond && (
                <div className="absolute top-2.5 left-2.5">
                  <span className={`${cond.bg} ${cond.text} text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-md`}>
                    {cond.label}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail Strip (Interactive thumbnails to click and browse) */}
            {allImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
                {allImages.map((imgUrl, idx) => {
                  const isSelected = idx === selectedImageIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer bg-stone-900 ${
                        isSelected
                          ? 'border-red-600 ring-2 ring-red-300 shadow-md scale-102'
                          : 'border-stone-200 opacity-70 hover:opacity-100 hover:border-amber-400'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`ภาพย่อย ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] font-bold px-1 rounded">
                        #{idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* 2. PRODUCT INFO & DETAILS                                 */}
          {/* ======================================================== */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  หน่วย: {product.unit}
                </span>
                {isOutOfStock ? (
                  <span className="text-red-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> สินค้าหมดชั่วคราว
                  </span>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    พร้อมส่ง ({product.stock} {product.unit})
                  </span>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-black text-stone-900 leading-snug">
                {product.name}
              </h2>

              {product.sellerName && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold">
                  <span>🏪</span>
                  <span>ลงขายโดย: <strong>{product.sellerName}</strong></span>
                </div>
              )}
            </div>

            {/* Price Box */}
            <div className="p-3 bg-red-50/70 border border-red-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-stone-500 font-medium">ราคาพิเศษ ขายถูกที่นี่ชุมแพ</span>
                <div className="text-xl sm:text-2xl font-black text-red-600">
                  ฿{product.price.toLocaleString()}
                  <span className="text-xs font-normal text-stone-600 ml-1">/ {product.unit}</span>
                </div>
              </div>
              <div className="text-right text-[11px] text-stone-500">
                <span>ราคารวม {quantity} {product.unit}: </span>
                <strong className="text-red-700 font-black block text-sm">
                  ฿{(product.price * quantity).toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1">
                <div className="text-xs font-bold text-stone-700">รายละเอียดสินค้า:</div>
                <p className="text-xs text-stone-600 whitespace-pre-line leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Store Guarantee Strip */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-600 pt-1">
              <div className="flex items-center gap-1.5 p-2 bg-amber-50/60 rounded-xl border border-amber-200/70">
                <Truck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>ส่งถึงบ้านในเขตชุมแพ หรือรับที่ร้าน</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 bg-emerald-50/60 rounded-xl border border-emerald-200/70">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>ของแท้ คุณภาพดี มีหน้าร้านจริง</span>
              </div>
            </div>
          </div>

          {/* Added Toast Notification */}
          {isAddedToast && (
            <div className="p-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>เพิ่มลงในตะกร้าเรียบร้อยแล้ว ({quantity} {product.unit})</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. QUANTITY SELECTOR & ORDER BUTTONS                     */}
          {/* ======================================================== */}
          <div className="pt-2 border-t border-stone-100 space-y-3">
            {!isOutOfStock && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700">เลือกจำนวน:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-sm disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center font-black text-stone-900 text-sm">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={quantity >= product.stock}
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 flex items-center justify-center font-bold text-sm disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAddToCartClick}
                className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>เพิ่มลงตะกร้า</span>
              </button>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleBuyNowClick}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 active:scale-95 text-white font-black rounded-xl text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>สั่งซื้อทันที</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
