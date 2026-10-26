import React from 'react';
import { ShoppingCart, Package, ShieldCheck, LogIn, LogOut, Store, Camera, Download } from 'lucide-react';
import { AppUser, StoreSettings } from '../types';

interface HeaderProps {
  settings: StoreSettings;
  cartCount: number;
  activeOrdersCount: number;
  currentUser: AppUser | null;
  isAdmin: boolean;
  isAdminMode: boolean;
  isCustomerOnly?: boolean;
  onToggleAdminMode: () => void;
  onOpenCart: () => void;
  onOpenMyOrders: () => void;
  onOpenAdmin: () => void;
  onSignOut: () => void;
  onOpenChangeCover?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  cartCount,
  activeOrdersCount,
  currentUser,
  isAdmin,
  isAdminMode,
  isCustomerOnly = false,
  onToggleAdminMode,
  onOpenCart,
  onOpenMyOrders,
  onOpenAdmin,
  onSignOut,
  onOpenChangeCover,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-amber-200/90 shadow-2xs transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          
          {/* Logo & Store Title (Compact & Prominent) */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white shadow-sm border border-yellow-300">
                <Store className="w-5 h-5 text-yellow-100" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${settings.isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${settings.isOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-red-600">
                  ขายถูก<span className="text-stone-900">ที่นี่ชุมแพ</span>
                </span>
                {isAdminMode && (
                  <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-500 hidden sm:block leading-none mt-0.5">
                อ.ชุมแพ จ.ขอนแก่น • โทร {settings.storePhone}
              </p>
            </div>
          </div>

          {/* Action buttons (Track orders, Cart, Admin) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* My Orders / Track orders button (Customer View) */}
            {!isAdminMode && (
              <button
                type="button"
                onClick={onOpenMyOrders}
                className="relative flex items-center gap-1 px-2.5 py-1.5 text-stone-700 hover:text-red-600 hover:bg-amber-50 rounded-xl transition-all cursor-pointer text-xs font-semibold border border-transparent hover:border-amber-200"
                title="ติดตามสถานะคำสั่งซื้อ"
              >
                <Package className="w-3.5 h-3.5 text-stone-600" />
                <span className="hidden sm:inline">ติดตามออเดอร์</span>
                {activeOrdersCount > 0 && (
                  <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                    {activeOrdersCount}
                  </span>
                )}
              </button>
            )}

            {/* Shopping Cart button (Customer View) */}
            {!isAdminMode && (
              <button
                type="button"
                onClick={onOpenCart}
                className="relative flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer font-bold text-xs sm:text-sm"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">ตะกร้า</span>
                {cartCount > 0 && (
                  <span className="bg-yellow-300 text-red-900 text-[11px] font-black px-1.5 py-0.2 rounded-full min-w-4 text-center shadow-inner">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {/* Admin Controls & Switch (Hidden on customer links so customer never sees admin button) */}
            {!isCustomerOnly && (
              <div className="pl-1 sm:pl-2 border-l border-stone-200 flex items-center gap-1 sm:gap-1.5">
                {isAdminMode ? (
                  /* Admin View Controls */
                  isAdmin ? (
                    <div className="flex items-center gap-1.5">
                      {onOpenChangeCover && (
                        <button
                          type="button"
                          onClick={onOpenChangeCover}
                          className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-2xs"
                          title="เปลี่ยนรูปภาพหน้าปกร้านค้า"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">เปลี่ยนรูปหน้าปก</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={onToggleAdminMode}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
                        title="สลับไปดูมุมมองหน้าร้านลูกค้า"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>ดูหน้าร้าน</span>
                      </button>

                      {/* Download Source Code ZIP button (Only visible in admin link) */}
                      <a
                        href="/api/admin/download-source"
                        download="chumphae-store-source.zip"
                        className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-2xs active:scale-95"
                        title="ดาวน์โหลด Source Code ทั้งหมดของระบบ (ZIP) สำหรับนำขึ้น GitHub และ Vercel"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">โหลด Source Code</span>
                        <span className="sm:hidden">ZIP</span>
                      </a>

                      <button
                        type="button"
                        onClick={onSignOut}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="ออกจากระบบ Admin"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all text-xs font-bold cursor-pointer shadow-xs"
                      title="เข้าสู่ระบบ Admin"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>เข้าสู่ระบบ Admin</span>
                    </button>
                  )
                ) : (
                  /* Customer View - Quick Admin access button available only on default root URL for shop owner */
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 rounded-xl transition-all text-xs font-bold cursor-pointer border border-stone-200 shadow-2xs"
                      title="เข้าสู่ระบบจัดการร้านค้า (Admin)"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
                      <span className="hidden xs:inline">ผู้ดูแล</span>
                      <span>Admin</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
