import React from 'react';
import { Plus, Check, AlertCircle } from 'lucide-react';
import { ProductItem, ProductCondition } from '../types';

interface ProductCardProps {
  product: ProductItem;
  cartQuantity: number;
  onAddToCart: (product: ProductItem) => void;
  onSelectProduct?: (product: ProductItem) => void;
}

const CONDITION_META: Record<ProductCondition, { label: string; bg: string; text: string }> = {
  new: { label: 'สินค้าใหม่', bg: 'bg-emerald-500/90', text: 'text-white' },
  used: { label: 'สินค้ามือ 2', bg: 'bg-sky-600/90', text: 'text-white' },
  new_defective: { label: 'ใหม่มีตำหนิ', bg: 'bg-amber-600/90', text: 'text-white' },
  repair_parts: { label: 'งานช่างชำรุด', bg: 'bg-purple-700/90', text: 'text-white' },
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cartQuantity,
  onAddToCart,
  onSelectProduct,
}) => {
  const isOutOfStock = product.stock <= 0;
  const isMaxInCart = cartQuantity >= product.stock;

  const cond = product.condition ? CONDITION_META[product.condition] : null;
  const photoCount = product.images?.length || 1;
  const displayImage = product.imageUrl || product.images?.[0];

  return (
    <div
      onClick={() => onSelectProduct?.(product)}
      className="group bg-white rounded-2xl sm:rounded-3xl border border-amber-200/80 shadow-2xs hover:shadow-lg hover:border-amber-400 transition-all duration-300 flex flex-col overflow-hidden relative cursor-pointer"
    >
      
      {/* Product Image Area - Always shows ONLY 1 main image as requested */}
      <div className="relative h-28 xs:h-32 sm:h-36 w-full bg-stone-100 overflow-hidden shrink-0">
        <img
          src={displayImage}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80';
          }}
        />

        {/* Multi-image indicator badge if 2-4 images uploaded */}
        {photoCount > 1 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 shadow-xs border border-white/20">
            <span>📷</span>
            <span>{photoCount} รูป</span>
          </div>
        )}

        {/* Condition & Stock Badges */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
          {cond && (
            <span
              className={`${cond.bg} ${cond.text} text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs`}
            >
              {cond.label}
            </span>
          )}

          {isOutOfStock ? (
            <span className="bg-red-600/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 backdrop-blur-xs">
              <AlertCircle className="w-3 h-3" />
              <span>หมด</span>
            </span>
          ) : (
            <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 backdrop-blur-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>พร้อมส่ง ({product.stock} {product.unit})</span>
            </span>
          )}
        </div>

        {/* Cart count badge */}
        {cartQuantity > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-yellow-400 text-red-950 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-yellow-200">
            <Check className="w-3 h-3 stroke-[3]" />
            <span>{cartQuantity}</span>
          </div>
        )}
      </div>

      {/* Info Area - Compact padding to fit 6 per screen */}
      <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-1.5">
        <div>
          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-0.5 gap-1">
            <span className="text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.2 rounded shrink-0">
              {product.unit}
            </span>
            {product.sellerName ? (
              <span className="text-teal-800 bg-teal-50 border border-teal-200/80 px-1.5 py-0.2 rounded font-semibold truncate max-w-[110px]" title={`ลงขายโดย: ${product.sellerName}`}>
                🏪 {product.sellerName}
              </span>
            ) : product.category ? (
              <span className="text-stone-400 truncate max-w-[80px]">
                {product.category}
              </span>
            ) : null}
          </div>

          <h3 className="font-bold text-stone-900 text-xs sm:text-sm leading-tight line-clamp-2 group-hover:text-red-600 transition-colors">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">
              {product.description}
            </p>
          )}
        </div>

        {/* Price & Action Button */}
        <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-1.5">
          <div>
            <div className="text-[9px] text-stone-400 leading-none">ราคาถูกชุมแพ</div>
            <div className="text-sm sm:text-base font-black text-red-600 leading-tight">
              ฿{product.price.toLocaleString()}
            </div>
          </div>

          <button
            type="button"
            disabled={isOutOfStock || isMaxInCart}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer ${
              isOutOfStock
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : isMaxInCart
                ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-200 hover:shadow-xs'
            }`}
            title={
              isOutOfStock
                ? 'สินค้าหมด'
                : isMaxInCart
                ? 'ใส่ครบจำนวนสต็อกแล้ว'
                : 'ใส่ตะกร้า'
            }
          >
            {isOutOfStock ? (
              <span>หมด</span>
            ) : isMaxInCart ? (
              <span>ครบแล้ว</span>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xs:inline">ใส่ตะกร้า</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};
