import React, { useState } from 'react';
import { X, Lock, User, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: { username: string; role: 'admin'; token: string }) => void;
  onGoogleSignIn?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onGoogleSignIn,
}) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }

      // Store session token securely in sessionStorage
      sessionStorage.setItem('chumphae_admin_token', data.token);
      sessionStorage.setItem('chumphae_admin_user', JSON.stringify(data.user));

      onLoginSuccess({
        username: data.user.username,
        role: 'admin',
        token: data.token,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-amber-200">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-yellow-300" />
            <h2 className="text-base font-bold">เข้าสู่ระบบผู้ดูแลร้าน (Admin)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="text-xs text-stone-600">
            เข้าสู่ระบบจัดการร้านค้า <strong className="text-red-600">ขายถูกที่นี่ชุมแพ</strong> เพื่อจัดการสินค้า, ออเดอร์, และดูรายงานยอดขาย
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                ชื่อผู้ใช้ / บัญชีผู้ดูแล
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin หรือ 0992256601"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                รหัสผ่าน
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono tracking-widest"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังตรวจสอบสิทธิ์...</span>
                </>
              ) : (
                <span>เข้าสู่ระบบจัดการร้าน</span>
              )}
            </button>
          </form>

          {onGoogleSignIn && (
            <div className="pt-2 border-t border-stone-100 text-center">
              <span className="text-[11px] text-stone-400 block mb-2">หรือ</span>
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="w-full py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 font-medium text-xs rounded-xl border border-stone-200 transition-colors cursor-pointer"
              >
                เข้าสู่ระบบด้วย Google Account (เฉพาะเจ้าของร้าน)
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
