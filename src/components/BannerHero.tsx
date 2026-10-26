import React, { useState, useEffect } from 'react';
import { Phone, MapPin, Truck, Store, Sparkles } from 'lucide-react';
import { StoreSettings } from '../types';
import {
  getActiveCoverImage,
  DEFAULT_COVER_IMAGE,
  STATIC_COVER_IMAGE,
} from '../utils/coverImage';

interface BannerHeroProps {
  settings: StoreSettings;
  onOpenLocation: () => void;
  onOpenChangeCover?: () => void;
  isAdmin?: boolean;
}

export const BannerHero: React.FC<BannerHeroProps> = ({
  settings,
  onOpenLocation,
}) => {
  const activeCover = getActiveCoverImage(settings);
  const [currentSrc, setCurrentSrc] = useState<string>(activeCover);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setCurrentSrc(activeCover);
    setHasError(false);
  }, [activeCover, settings.coverImageUrl]);

  const handleImageError = () => {
    if (currentSrc !== DEFAULT_COVER_IMAGE) {
      setCurrentSrc(DEFAULT_COVER_IMAGE);
    } else if (currentSrc !== STATIC_COVER_IMAGE) {
      setCurrentSrc(STATIC_COVER_IMAGE);
    } else {
      setHasError(true);
    }
  };

  return (
    <div className="mx-3 sm:mx-4 mt-2 sm:mt-3 mb-1.5 space-y-1.5">
      {/* 1. Main Cover Banner Image (Guaranteed stable aspect ratio & height so it never collapses) */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-md border-2 sm:border-3 border-amber-300 bg-gradient-to-r from-red-700 via-amber-600 to-amber-700 aspect-[16/7] sm:aspect-[21/9] min-h-[140px] sm:min-h-[190px] md:min-h-[230px] max-h-[185px] sm:max-h-[260px] md:max-h-[310px] w-full flex items-center justify-center">
        
        {/* Underlying branded store banner (renders immediately, guaranteeing zero layout shift) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 text-white z-0 select-none bg-gradient-to-br from-red-600 via-amber-600 to-amber-800">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-1.5 sm:mb-2 shadow-inner border border-white/30">
            <Store className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-200" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white drop-shadow-md tracking-tight">
            ขายถูก<span className="text-yellow-300">ที่นี่ชุมแพ</span>
          </h1>
          <p className="text-[11px] sm:text-xs md:text-sm text-yellow-100 max-w-md line-clamp-1 drop-shadow-xs font-medium">
            ของเล่น กิ๊บช๊อป ของใช้ไฟฟ้าทั่วไป เครื่องมือช่าง
          </p>
        </div>

        {/* Foreground Cover Image */}
        {!hasError && (
          <img
            key={currentSrc}
            src={currentSrc}
            alt="ขายถูกที่นี่ชุมแพ - หน้าปกร้านค้า"
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-500 hover:scale-[1.008]"
          />
        )}
      </div>

      {/* 2. Full-width Store Status Bar (เขียว = วันนี้เปิดร้าน / แดง = วันนี้ร้านปิด) */}
      <div
        className={`w-full py-2 px-3 rounded-xl border text-center font-bold text-xs sm:text-sm tracking-wide shadow-2xs transition-colors flex items-center justify-center gap-2 ${
          settings.isOpen
            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:bg-emerald-950/20'
            : 'bg-red-500/10 border-red-500 text-red-700 dark:bg-red-950/20'
        }`}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              settings.isOpen ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              settings.isOpen ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          />
        </span>
        <span>{settings.isOpen ? 'วันนี้เปิดร้าน' : 'วันนี้ร้านปิด'}</span>
      </div>

      {/* 3. Lower Action Strip: เบอร์โทร -> มาเองที่ร้าน -> ส่งถึงบ้าน (พื้นที่กะทัดรัด) */}
      <div className="bg-white/95 backdrop-blur-xs rounded-xl border border-amber-200/90 px-2.5 py-1.5 flex flex-wrap items-center justify-between sm:justify-start gap-1.5 sm:gap-2 text-xs shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* เบอร์โทร */}
          <a
            href={`tel:${settings.storePhone.replace(/-/g, '')}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 text-[11px] sm:text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>โทร {settings.storePhone}</span>
          </a>

          {/* มาเองที่ร้าน (ต่อจากเบอร์โทร) */}
          <a
            href="https://www.google.com/maps?q=16.525223,102.101480"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 rounded-lg border border-red-200/90 text-[11px] sm:text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
            title="เปิด Google Maps นำทางมาเองที่ร้าน (พิกัด 16.525223, 102.101480)"
          >
            <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>มาเองที่ร้าน</span>
          </a>
        </div>

        {/* ส่งถึงบ้าน */}
        <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-amber-900 bg-amber-100/90 px-2 py-1 rounded-lg border border-amber-200">
          <Truck className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>ส่งถึงบ้าน</span>
        </span>
      </div>
    </div>
  );
};
