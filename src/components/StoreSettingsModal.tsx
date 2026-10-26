import React, { useState } from 'react';
import { X, Save, Store, MapPin, Phone, Truck, CreditCard, Loader2, Bell, Send, Eye, EyeOff, CheckCircle2, HelpCircle } from 'lucide-react';
import { StoreSettings } from '../types';
import { sendLineNotifyTest } from '../utils/lineNotifyClient';

interface StoreSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSave: (newSettings: StoreSettings) => Promise<void>;
}

export const StoreSettingsModal: React.FC<StoreSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [testLineResult, setTestLineResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error('Error updating store settings:', err);
      setError(err?.message || 'ไม่สามารถบันทึกการตั้งค่าร้านค้าได้');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-yellow-300" />
            <h2 className="text-base font-bold">⚙️ ตั้งค่าร้านค้า "ขายถูกที่นี่ชุมแพ"</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          
          {/* Shop Open / Close Toggle */}
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-stone-900">สถานะเปิด-ปิดร้านค้า</span>
              <p className="text-[11px] text-stone-500">
                {formData.isOpen ? 'ขณะนี้ร้านเปิดรับออเดอร์ตามปกติ' : 'ขณะนี้ปิดรับออเดอร์ชั่วคราว'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isOpen}
                onChange={(e) => setFormData({ ...formData, isOpen: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          {/* Store Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                ชื่อร้าน
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" /> เบอร์โทรศัพท์ร้านค้า
              </label>
              <input
                type="text"
                required
                value={formData.storePhone}
                onChange={(e) => setFormData({ ...formData, storePhone: e.target.value })}
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
                  value={formData.storeLat}
                  onChange={(e) => setFormData({ ...formData, storeLat: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-600 mb-0.5">Longitude (ลองจิจูด)</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.storeLng}
                  onChange={(e) => setFormData({ ...formData, storeLng: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden font-mono"
                />
              </div>
            </div>
            <div className="text-[10px] text-stone-500">
              ค่าเริ่มต้นตามป้ายร้าน: 16.525223, 102.101480 (อำเภอชุมแพ จังหวัดขอนแก่น)
            </div>
          </div>

          {/* Delivery rates */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
            <span className="font-bold text-stone-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-600" /> การคิดค่าส่งเดลิเวอรี่ตามระยะทางถนน
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-stone-600 mb-0.5">ค่าส่งเริ่มต้น (บาท)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.baseDeliveryFee}
                  onChange={(e) => setFormData({ ...formData, baseDeliveryFee: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-600 mb-0.5">คิดต่อ กม. ถัดไป (บาท)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.perKmFee}
                  onChange={(e) => setFormData({ ...formData, perKmFee: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-600 mb-0.5">ส่งฟรีเมื่อครบ (บาท)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.freeDeliveryThreshold}
                  onChange={(e) => setFormData({ ...formData, freeDeliveryThreshold: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden font-bold text-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* PromptPay */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
            <span className="font-bold text-stone-900 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-600" /> ข้อมูลบัญชีรับเงิน PromptPay
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-stone-600 mb-0.5">เบอร์พร้อมเพย์ / เลขบัตร</label>
                <input
                  type="text"
                  required
                  value={formData.promptpayNumber}
                  onChange={(e) => setFormData({ ...formData, promptpayNumber: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-stone-600 mb-0.5">ชื่อบัญชีรับเงิน</label>
                <input
                  type="text"
                  required
                  value={formData.promptpayName}
                  onChange={(e) => setFormData({ ...formData, promptpayName: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* LINE Notify Integration */}
          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-stone-900 text-xs">
                  การแจ้งเตือนออเดอร์ใหม่เข้า LINE Notify
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.lineNotifyEnabled ?? true}
                  onChange={(e) => setFormData({ ...formData, lineNotifyEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>

            <p className="text-[11px] text-stone-600 leading-relaxed">
              เมื่อมีลูกค้าสั่งซื้อสินค้า ระบบจะส่งข้อมูลออเดอร์จาก Firestore เข้า LINE ทันที โดยที่เจ้าของร้านไม่จำเป็นต้องเปิดหน้าจอแอดมินทิ้งไว้
            </p>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-stone-700">
                  LINE Notify Access Token
                </label>
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(!showHelpGuide)}
                  className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>{showHelpGuide ? 'ซ่อนวิธีขอ Token' : 'วิธีขอ LINE Token'}</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="วาง LINE Notify Access Token ที่นี่..."
                  value={formData.lineNotifyToken || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, lineNotifyToken: e.target.value });
                    setTestLineResult(null);
                  }}
                  className="w-full pl-3 pr-20 py-2 rounded-xl border border-stone-200 focus:outline-hidden font-mono text-xs bg-white"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                    title={showToken ? 'ซ่อน' : 'แสดง'}
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step-by-step help guide */}
            {showHelpGuide && (
              <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-[11px] text-stone-600 space-y-1.5">
                <div className="font-bold text-emerald-900">ขั้นตอนการขอ LINE Notify Token (ฟรี ไม่เสียค่าใช้จ่าย):</div>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>เปิดเว็บไซต์ <a href="https://notify-bot.line.me" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-semibold">notify-bot.line.me</a></li>
                  <li>เข้าสู่ระบบด้วย LINE แล้วกดที่ชื่อของคุณมุมขวาบน เลือก <strong>"หน้าของฉัน (My Page)"</strong></li>
                  <li>เลื่อนลงมากดปุ่ม <strong>"ออก Access Token (Generate token)"</strong></li>
                  <li>ตั้งชื่อบอท เช่น <strong>"ร้านขายถูกชุมแพ"</strong> และเลือกแชทที่ต้องการรับ (แนะนำให้ส่งเข้ากลุ่มร้านค้า หรือแชท 1-on-1)</li>
                  <li>คัดลอกรหัส Token นำมาวางในช่องด้านบนนี้ แล้วกดบันทึก</li>
                </ol>
              </div>
            )}

            {/* Test button & status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-100">
              <button
                type="button"
                disabled={isTestingLine || !formData.lineNotifyToken?.trim()}
                onClick={async () => {
                  if (!formData.lineNotifyToken?.trim()) return;
                  setIsTestingLine(true);
                  setTestLineResult(null);
                  try {
                    const res = await sendLineNotifyTest(formData.lineNotifyToken);
                    setTestLineResult({ success: res.success, message: res.message });
                  } catch (err: any) {
                    setTestLineResult({ success: false, message: err?.message || 'ทดสอบล้มเหลว' });
                  } finally {
                    setIsTestingLine(false);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs ${
                  formData.lineNotifyToken?.trim()
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                {isTestingLine ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังทดสอบ...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>🧪 ทดสอบส่งข้อความเข้า LINE</span>
                  </>
                )}
              </button>

              {testLineResult && (
                <div
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                    testLineResult.success
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {testLineResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>{testLineResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึกการตั้งค่า</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
