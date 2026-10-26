import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, CheckCircle2, Trash2, Star, Plus } from 'lucide-react';
import { ProductItem, Category, ProductCondition } from '../types';
import { uploadImageFile } from '../firebase';
import { compressImage } from '../utils/imageCompressor';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: ProductItem | null;
  categories: Category[];
  onSave: (productData: Partial<ProductItem>, isNew: boolean) => Promise<void>;
  sellerId?: string;
  sellerName?: string;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  product,
  categories,
  onSave,
  sellerId,
  sellerName,
}) => {
  const formBodyRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(product?.name || '');
  const [category, setCategory] = useState(product?.category || (categories[0]?.slug || 'toys'));
  const [condition, setCondition] = useState<ProductCondition>(product?.condition || 'new');
  const [price, setPrice] = useState<number>(product?.price || 0);
  const [costPrice, setCostPrice] = useState<number>(product?.costPrice || 0);
  const [stock, setStock] = useState<number>(product?.stock ?? 1);
  const [unit, setUnit] = useState(product?.unit || 'ชิ้น');

  // Multi-image management (supports 3-4 images)
  const initialImages: string[] =
    product?.images && product.images.length > 0
      ? product.images
      : product?.imageUrl
      ? [product.imageUrl]
      : [];
  const [images, setImages] = useState<string[]>(initialImages);
  const [urlInput, setUrlInput] = useState('');
  const [description, setDescription] = useState(product?.description || '');
  const [isActive, setIsActive] = useState<boolean>(product?.isActive ?? true);

  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever modal opens or product changes, and ensure viewport is scrolled to top
  useEffect(() => {
    if (isOpen) {
      setName(product?.name || '');
      setCategory(product?.category || (categories[0]?.slug || 'toys'));
      setCondition(product?.condition || 'new');
      setPrice(product?.price || 0);
      setCostPrice(product?.costPrice || 0);
      setStock(product?.stock ?? 1);
      setUnit(product?.unit || 'ชิ้น');
      const prodImages: string[] =
        product?.images && product.images.length > 0
          ? product.images
          : product?.imageUrl
          ? [product.imageUrl]
          : [];
      setImages(prodImages);
      setUrlInput('');
      setDescription(product?.description || '');
      setIsActive(product?.isActive ?? true);
      setError(null);

      // Scroll to the top so product name field is immediately 100% visible
      setTimeout(() => {
        formBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      }, 50);
    }
  }, [isOpen, product, categories]);

  if (!isOpen) return null;

  const handleMultipleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const availableSlots = 4 - images.length;
    if (availableSlots <= 0) {
      setError('สามารถลงรูปภาพสินค้าได้สูงสุด 4 รูปครับ');
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);
    setIsCompressing(true);
    setError(null);

    try {
      const newUrls: string[] = [];
      for (const f of filesToProcess) {
        try {
          const { dataUrl } = await compressImage(f, 800, 800, 0.8);
          newUrls.push(dataUrl);
        } catch {
          newUrls.push(URL.createObjectURL(f));
        }
      }
      setImages((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      console.warn('Error processing images:', err);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    if (images.length >= 4) {
      setError('สามารถลงรูปภาพสินค้าได้สูงสุด 4 รูปครับ');
      return;
    }
    setImages((prev) => [...prev, urlInput.trim()]);
    setUrlInput('');
    setError(null);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimaryImage = (indexToPrimary: number) => {
    setImages((prev) => {
      const target = prev[indexToPrimary];
      const others = prev.filter((_, idx) => idx !== indexToPrimary);
      return [target, ...others];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('กรุณากรอกชื่อสินค้า');
      return;
    }

    if (price <= 0) {
      setError('กรุณากรอกราคาขายที่มากกว่า 0 บาท');
      return;
    }

    if (stock < 0) {
      setError('จำนวนสต็อกต้องไม่ติดลบ');
      return;
    }

    setIsSaving(true);
    try {
      const finalImages = images.length > 0
        ? images
        : ['https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80'];

      const resolvedSellerId = product?.sellerId ?? sellerId;
      const resolvedSellerName = product?.sellerName ?? sellerName;

      await onSave(
        {
          name: name.trim(),
          category,
          condition,
          price: Number(price),
          costPrice: Number(costPrice || 0),
          stock: Number(stock),
          unit: unit.trim(),
          imageUrl: finalImages[0],
          images: finalImages,
          description: description.trim(),
          isActive,
          ...(resolvedSellerId ? { sellerId: resolvedSellerId, sellerName: resolvedSellerName } : {}),
        },
        !product
      );
      onClose();
    } catch (err: any) {
      console.error('Error saving product:', err);
      setError(err?.message || 'ไม่สามารถบันทึกสินค้าได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4">
      <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden border border-stone-200">
        
        {/* Header - Stays sticky at top */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-red-600 to-amber-600 text-white flex items-center justify-between shrink-0 shadow-xs z-10">
          <h2 className="text-sm sm:text-base font-bold flex items-center gap-1.5">
            {product ? '✏️ แก้ไขข้อมูลสินค้า' : '➕ เพิ่มสินค้าใหม่ (ร้านขายถูกที่นี่ชุมแพ)'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body with Internal Scrolling and Sticky Action Bar */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          
          <div ref={formBodyRef} className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4 text-xs overscroll-contain">
            {/* Error Alert */}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {error}
              </div>
            )}

            {/* 1. Product Name Input (Always clearly visible at the top) */}
            <div className="space-y-1">
              <label className="block font-bold text-stone-800 text-xs sm:text-sm">
                ชื่อสินค้า <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ของเล่นเสริมทักษะ, กิ๊บติดผมเกาหลี, ปลั๊กไฟ 3 ตา, สว่านไฟฟ้า"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-hidden focus:border-red-500 focus:ring-2 focus:ring-red-100 text-stone-900 font-medium bg-white shadow-2xs text-xs sm:text-sm"
              />
            </div>

          {/* Condition Selector: สินค้าใหม่, สินค้ามือ2, สินค้าใหม่มีตำหนิ, งานช่างชำรุด */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1.5">
              สภาพสินค้า / ประเภทสินค้า <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'new', label: 'สินค้าใหม่', color: 'emerald' },
                { key: 'used', label: 'สินค้ามือ 2', color: 'sky' },
                { key: 'new_defective', label: 'สินค้าใหม่มีตำหนิ', color: 'amber' },
                { key: 'repair_parts', label: 'งานช่างชำรุด', color: 'purple' },
              ].map((c) => {
                const isSelected = condition === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCondition(c.key as ProductCondition)}
                    className={`py-2 px-2 text-center rounded-xl font-bold border transition-all cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                หมวดหมู่สินค้า <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-red-500 text-stone-900"
              >
                {categories
                  .filter((c) => c.slug !== 'all')
                  .map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.icon} {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                หน่วยนับ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="เช่น ถุง, แผง, ขวด, ชิ้น, แพ็ค"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden text-stone-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                ราคาขาย (บาท) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={price === 0 ? '' : price}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden font-bold text-red-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                ต้นทุน (บาท)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={costPrice === 0 ? '' : costPrice}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onChange={(e) => setCostPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden text-stone-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                สต็อกคงเหลือ <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={stock === 0 ? '' : stock}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onChange={(e) => setStock(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden font-bold text-stone-900"
              />
            </div>
          </div>

          {/* Image Upload Area: Supports 3-4 images */}
          <div className="space-y-2.5 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/90">
            <div className="flex items-center justify-between">
              <div>
                <label className="block font-bold text-stone-800 text-xs">
                  รูปภาพสินค้า ({images.length}/4 รูป)
                </label>
                <p className="text-[10px] text-stone-500">
                  รูปที่ 1 จะแสดงเป็นรูปหน้าปกหน้าแรก ส่วนรูปที่ 2-4 จะแสดงเมื่อลูกค้ากดดูรายละเอียดสินค้า
                </p>
              </div>
              {images.length > 0 && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                  ✓ {images.length} รูป
                </span>
              )}
            </div>

            {/* Images Grid (Up to 4 images) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {images.map((imgUrl, idx) => (
                <div
                  key={idx}
                  className={`relative rounded-xl overflow-hidden border-2 aspect-square bg-stone-900 group shadow-xs ${
                    idx === 0 ? 'border-red-500 ring-2 ring-red-200' : 'border-stone-200'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`ภาพที่ ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Badge */}
                  <div className="absolute top-1 left-1">
                    {idx === 0 ? (
                      <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        <span>รูปหลัก</span>
                      </span>
                    ) : (
                      <span className="bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
                    {idx !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryImage(idx)}
                        className="px-2 py-0.5 bg-yellow-400 hover:bg-yellow-500 text-stone-900 text-[10px] font-bold rounded-lg cursor-pointer transition-colors w-full"
                        title="ตั้งเป็นรูปหลักหน้าแรก"
                      >
                        ตั้งรูปหลัก
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 w-full"
                      title="ลบรูปนี้"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>ลบ</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Upload Slot if less than 4 */}
              {images.length < 4 && (
                <label className="border-2 border-dashed border-stone-300 hover:border-red-500 bg-white hover:bg-red-50/50 rounded-xl aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-stone-400 hover:text-red-600 p-2 text-center">
                  {isCompressing ? (
                    <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold leading-tight">เพิ่มรูป ({images.length + 1}/4)</span>
                    </>
                  )}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleMultipleFilesChange}
                    disabled={isCompressing}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Quick URL Input for adding image */}
            {images.length < 4 && (
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="หรือวางลิงก์ URL รูปภาพแล้วกดเพิ่ม..."
                  className="flex-1 px-2.5 py-1.5 text-[11px] rounded-xl border border-stone-200 bg-white focus:outline-hidden text-stone-900"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  disabled={!urlInput.trim()}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-50 font-bold rounded-xl text-[11px] cursor-pointer transition-colors shrink-0"
                >
                  + เพิ่ม URL
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              รายละเอียดสินค้า (สรรพคุณ/ขนาดบรรจุ)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="รายละเอียดสินค้าเพิ่มเติม..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden text-stone-900"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded-sm text-red-600 focus:ring-red-500 cursor-pointer"
            />
            <label htmlFor="isActiveCheck" className="font-semibold text-stone-700 cursor-pointer">
              เปิดขายสินค้านี้ในหน้าร้าน (Active)
            </label>
          </div>

          </div>

          {/* Action buttons (Sticky at the bottom for easy reach on mobile) */}
          <div className="p-3 sm:p-4 bg-white/95 backdrop-blur-xs border-t border-stone-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl cursor-pointer transition-colors text-xs"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all text-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังบันทึกสินค้า...</span>
                </>
              ) : (
                <span>{product ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
