import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { uploadCoverImage } from '../firebase';
import {
  DEFAULT_COVER_IMAGE,
  STATIC_COVER_IMAGE,
  getActiveCoverImage,
  saveActiveCoverImageLocally,
  clearActiveCoverImageLocally,
  isCustomCoverImage,
} from '../utils/coverImage';

interface CoverImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCoverUrl?: string;
  onSaveCover: (newCoverUrl: string) => Promise<void>;
}

// Preset store banner images for convenient one-click testing or selection
const PRESET_COVERS = [
  {
    name: 'ร้านค้าขายถูก ชุมแพ (สดใส)',
    url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'แผนกของเล่น & กิ๊บช็อป',
    url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&q=80',
  },
  {
    name: 'เครื่องมือช่าง & เครื่องใช้ไฟฟ้า',
    url: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1200&q=80',
  },
];

export const CoverImageModal: React.FC<CoverImageModalProps> = ({
  isOpen,
  onClose,
  currentCoverUrl,
  onSaveCover,
}) => {
  const activeCurrentUrl = getActiveCoverImage({ coverImageUrl: currentCoverUrl });
  const [selectedMethod, setSelectedMethod] = useState<'upload' | 'url' | 'presets'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>(activeCurrentUrl);
  const [urlInput, setUrlInput] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; sizeKb: number } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const active = getActiveCoverImage({ coverImageUrl: currentCoverUrl });
      setPreviewUrl(active);
      setSelectedFile(null);
      setFileDetails(null);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, currentCoverUrl]);

  if (!isOpen) return null;

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('กรุณาเลือกไฟล์ที่เป็นรูปภาพ เช่น JPG, PNG หรือ WebP');
      return;
    }

    setSelectedFile(file);
    setFileDetails({
      name: file.name,
      sizeKb: Math.round(file.size / 1024),
    });

    // Create temporary local preview
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPreviewUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle URL apply
  const handleApplyUrl = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!urlInput.trim()) {
      setErrorMessage('กรุณาระบุ URL ของรูปภาพ');
      return;
    }
    setSelectedFile(null);
    setFileDetails(null);
    setPreviewUrl(urlInput.trim());
  };

  // Handle preset selection
  const handleSelectPreset = (url: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSelectedFile(null);
    setFileDetails(null);
    setUrlInput(url);
    setPreviewUrl(url);
  };

  // Save new cover image
  const handleSave = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      let finalCoverUrl = previewUrl;

      // If a file was selected, compress and upload
      if (selectedFile) {
        finalCoverUrl = await uploadCoverImage(selectedFile);
      }

      if (!finalCoverUrl || !finalCoverUrl.trim()) {
        throw new Error('ไม่พบรูปภาพที่จะบันทึก');
      }

      // Save locally first to ensure instant persistence
      saveActiveCoverImageLocally(finalCoverUrl);

      // Call parent update to save in Firestore store_settings
      await onSaveCover(finalCoverUrl);

      setSuccessMessage('เปลี่ยนรูปภาพหน้าปกสำเร็จแล้ว! ระบบบันทึกและแสดงรูปใหม่ทันที');
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      console.error('Save cover error:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกรูปภาพหน้าปก');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to default
  const handleResetToDefault = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    setShowResetConfirm(false);
    try {
      clearActiveCoverImageLocally();
      await onSaveCover(DEFAULT_COVER_IMAGE);
      setPreviewUrl(DEFAULT_COVER_IMAGE);
      setSelectedFile(null);
      setFileDetails(null);
      setSuccessMessage('รีเซ็ตรูปภาพหน้าปกเป็นค่าเริ่มต้นสำเร็จ');
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการรีเซ็ตรูปภาพ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4">
      <div className="relative bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-2xl max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-stone-900">
                เปลี่ยนรูปภาพหน้าปกร้านค้า (Cover Image)
              </h3>
              <p className="text-xs text-stone-500">
                รูปหน้าปกจะแสดงที่ด้านบนสุดของหน้าร้านค้าลูกค้าทุกลิงก์
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success or Error Banners */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Preview Area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
              <span>ตัวอย่างรูปหน้าปกที่จะแสดง</span>
              {previewUrl !== activeCurrentUrl && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  ยังไม่ได้บันทึก
                </span>
              )}
            </span>
            <span className="text-[11px] text-stone-400">
              อัตราส่วนแนะนำ ~ 2:1 หรือ 16:9
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-md border-2 border-amber-300 bg-stone-900 group">
            <img
              src={previewUrl}
              alt="ตัวอย่างรูปหน้าปกร้าน"
              className="w-full h-auto object-cover max-h-[180px] sm:max-h-[220px]"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== DEFAULT_COVER_IMAGE) {
                  target.src = DEFAULT_COVER_IMAGE;
                } else if (target.src !== STATIC_COVER_IMAGE) {
                  target.src = STATIC_COVER_IMAGE;
                }
              }}
            />
            {fileDetails && (
              <div className="absolute bottom-2 left-2 bg-stone-900/80 text-white text-[10px] px-2.5 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1.5">
                <span>📁 {fileDetails.name}</span>
                <span className="text-amber-300 font-mono">({fileDetails.sizeKb} KB)</span>
              </div>
            )}
          </div>
        </div>

        {/* Method Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
          <button
            type="button"
            onClick={() => setSelectedMethod('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              selectedMethod === 'upload'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>1. อัปโหลดรูปภาพ / ถ่ายรูป</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMethod('url')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              selectedMethod === 'url'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>2. ใส่ลิงก์ URL</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMethod('presets')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
              selectedMethod === 'presets'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. รูปตัวอย่างสำเร็จรูป</span>
          </button>
        </div>

        {/* Method 1: File Upload / Camera */}
        {selectedMethod === 'upload' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Choose File Button */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-amber-300 hover:border-red-500 bg-amber-50/50 hover:bg-amber-50 rounded-2xl p-4 text-center cursor-pointer transition-colors group flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-xl bg-white shadow-2xs group-hover:scale-110 transition-transform flex items-center justify-center text-red-600">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-800">
                    เลือกไฟล์รูปจากอุปกรณ์
                  </div>
                  <div className="text-[10px] text-stone-500">
                    รองรับ JPG, PNG, WebP (คลิกเพื่อเลือกไฟล์)
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Take Photo Button */}
              <div
                onClick={() => cameraInputRef.current?.click()}
                className="border-2 border-dashed border-stone-200 hover:border-emerald-500 bg-stone-50 hover:bg-emerald-50/40 rounded-2xl p-4 text-center cursor-pointer transition-colors group flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-xl bg-white shadow-2xs group-hover:scale-110 transition-transform flex items-center justify-center text-emerald-600">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-800">
                    ถ่ายรูปด้วยกล้องมือถือ
                  </div>
                  <div className="text-[10px] text-stone-500">
                    เปิดกล้องถ่ายรูปหน้าร้านจริงทันที
                  </div>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <p className="text-[11px] text-stone-500 leading-relaxed bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              💡 <strong>คำแนะนำ:</strong> เมื่อเลือกรูปภาพ ระบบจะทำการบีบอัดให้คมชัดและโหลดเร็วอัตโนมัติ โดยรูปที่เปลี่ยนใหม่จะถูกบันทึกเป็นรูปหลักทันทีและ <u>ไม่มีการเปลี่ยนกลับไปใช้รูปเดิมของระบบโดยอัตโนมัติ</u>
            </p>
          </div>
        )}

        {/* Method 2: URL Input */}
        {selectedMethod === 'url' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                ลิงก์ URL รูปภาพหน้าปก
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/cover-image.jpg"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-hidden focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  ดูตัวอย่าง
                </button>
              </div>
            </div>
            <p className="text-[11px] text-stone-400">
              รองรับลิงก์รูปภาพสาธารณะจาก Google Drive, Unsplash, หรือเว็บไซต์โฮสติ้งรูปภาพ
            </p>
          </div>
        )}

        {/* Method 3: Presets */}
        {selectedMethod === 'presets' && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-stone-700 block">
              เลือกจากรูปตัวอย่างของร้านค้า:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PRESET_COVERS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectPreset(preset.url)}
                  className={`border rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] shadow-2xs ${
                    previewUrl === preset.url
                      ? 'border-red-600 ring-2 ring-red-500'
                      : 'border-stone-200 hover:border-amber-300'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.name}
                    className="w-full h-24 object-cover"
                  />
                  <div className="p-2 bg-white text-[11px] font-bold text-stone-800 truncate">
                    {preset.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            {isCustomCoverImage({ coverImageUrl: currentCoverUrl }) && (
              showResetConfirm ? (
                <div className="flex items-center gap-1.5 text-xs bg-red-50 p-1.5 rounded-xl border border-red-200">
                  <span className="text-[11px] text-red-800 font-semibold">ยืนยันใช้รูปเริ่มต้นเดิม?</span>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    disabled={isLoading}
                    className="px-2 py-0.5 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 cursor-pointer"
                  >
                    ใช่ รีเซ็ต
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="px-2 py-0.5 bg-stone-200 text-stone-700 rounded-lg text-[10px] font-bold hover:bg-stone-300 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isLoading}
                  className="text-[11px] text-stone-500 hover:text-red-600 underline cursor-pointer flex items-center gap-1 transition-colors"
                  title="ย้อนกลับไปใช้รูปภาพเริ่มต้นเดิมของระบบ"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>ย้อนกลับไปใช้รูปเริ่มต้นของระบบ</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกรูปหน้าปก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกและใช้งานรูปนี้ทันที</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
