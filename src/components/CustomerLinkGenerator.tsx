import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Download,
  Smartphone,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Send,
  MessageCircle,
  HelpCircle,
  Layers,
  Store,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { Category, StoreSettings } from '../types';

interface CustomerLinkGeneratorProps {
  settings: StoreSettings;
  categories: Category[];
  totalActiveProducts: number;
}

export const CustomerLinkGenerator: React.FC<CustomerLinkGeneratorProps> = ({
  settings,
  categories,
  totalActiveProducts,
}) => {
  // Base origin detection
  const [origin, setOrigin] = useState<string>('');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [includeModeParam, setIncludeModeParam] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Compute customer link
  const customerLink = useMemo(() => {
    if (!origin) return '';
    const basePath = `${origin}/shop`;
    const params = new URLSearchParams();
    if (includeModeParam) {
      params.set('mode', 'user');
    }
    if (selectedCategorySlug && selectedCategorySlug !== 'all') {
      params.set('cat', selectedCategorySlug);
    }
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }, [origin, includeModeParam, selectedCategorySlug]);

  // Generate QR code whenever link changes
  useEffect(() => {
    if (!customerLink) return;
    setIsGeneratingQr(true);
    QRCode.toDataURL(customerLink, {
      width: 380,
      margin: 2,
      color: {
        dark: '#991b1b', // Deep crimson red to match Chum Phae theme
        light: '#ffffff',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
        setIsGeneratingQr(false);
      })
      .catch((err) => {
        console.error('QR code generation failed:', err);
        setIsGeneratingQr(false);
      });
  }, [customerLink]);

  // Copy to clipboard helper
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(customerLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = customerLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      alert(`คัดลอกลิงก์: ${customerLink}`);
    }
  };

  // Ready-to-use message template for LINE, Facebook, SMS
  const promotionalMessage = useMemo(() => {
    const categoryName =
      selectedCategorySlug !== 'all'
        ? categories.find((c) => c.slug === selectedCategorySlug)?.name
        : null;

    return `🛒 สั่งซื้อสินค้าออนไลน์กับร้าน "${settings.storeName}"
${categoryName ? `✨ หมวดหมู่: ${categoryName}\n` : ''}🔥 รวมสินค้าราคาถูก ของแท้ พร้อมส่ง อ.ชุมแพ และจัดส่งทั่วไทย
📱 กดเข้าชมและสั่งซื้อได้ที่ลิงก์นี้เลยครับ (ไม่ต้องลงแอป):
👉 ${customerLink}

📞 ติดต่อ/สอบถามทางร้าน: ${settings.storePhone}
📍 ${settings.storeAddress}`;
  }, [settings, customerLink, selectedCategorySlug, categories]);

  const handleCopyMessage = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(promotionalMessage);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = promotionalMessage;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch (e) {
      alert('คัดลอกข้อความไม่สำเร็จ กรุณากดเลือกและคัดลอกจากกล่องข้อความ');
    }
  };

  // Share to LINE
  const handleShareLine = () => {
    const text = encodeURIComponent(promotionalMessage);
    const lineUrl = `https://line.me/R/msg/text/?${text}`;
    window.open(lineUrl, '_blank', 'noopener,noreferrer');
  };

  // Native Web Share API (mobile devices)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: settings.storeName,
          text: promotionalMessage,
          url: customerLink,
        });
      } catch (err) {
        // User cancelled or share dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  // Print QR Code
  const handlePrintQr = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code สั่งซื้อสินค้า - ${settings.storeName}</title>
          <style>
            body {
              font-family: 'Prompt', -apple-system, BlinkMacSystemFont, sans-serif;
              text-align: center;
              padding: 40px 20px;
              color: #1c1917;
            }
            .card {
              max-width: 420px;
              margin: 0 auto;
              border: 3px solid #dc2626;
              border-radius: 24px;
              padding: 32px 24px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }
            h1 {
              color: #dc2626;
              font-size: 26px;
              margin: 0 0 8px 0;
            }
            p.sub {
              font-size: 14px;
              color: #78716c;
              margin: 0 0 24px 0;
            }
            img.qr {
              width: 280px;
              height: 280px;
              border-radius: 16px;
              border: 1px solid #e7e5e4;
              margin-bottom: 20px;
            }
            .cta {
              font-size: 18px;
              font-weight: bold;
              color: #15803d;
              margin-bottom: 8px;
            }
            .info {
              font-size: 13px;
              color: #57534e;
              margin-top: 16px;
              border-top: 1px dashed #d6d3d1;
              padding-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🛍️ ${settings.storeName}</h1>
            <p class="sub">สแกนเพื่อเปิดร้านค้าและสั่งซื้อสินค้าออนไลน์</p>
            <img class="qr" src="${qrDataUrl}" alt="QR Code" />
            <div class="cta">📱 สแกนสั่งซื้อง่าย ผ่านมือถือ</div>
            <div class="info">
              โทร: ${settings.storePhone}<br />
              ${settings.storeAddress}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Welcome & Concept Header */}
      <div className="bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-yellow-200 text-xs font-bold border border-white/25">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ฟีเจอร์สำหรับส่งลูกค้าโดยเฉพาะ</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            สร้างลิงก์สั่งซื้อสำหรับลูกค้า (Customer Storefront Link)
          </h1>
          <p className="text-xs sm:text-sm text-yellow-50 leading-relaxed">
            คัดลอกหรือแชร์ลิงก์นี้ให้กับลูกค้าของคุณทาง LINE, Facebook, หรือนำ QR Code ไปตั้งหน้าร้าน
            <br className="hidden sm:inline" />
            <strong>ลิงก์นี้ถูกออกแบบมาเพื่อลูกค้าโดยเฉพาะ</strong>: ไม่แสดงแถบเมนูหลังบ้าน ไม่มีปุ่มผู้ดูแลระบบ (Admin)
            และลูกค้าแต่ละท่านสามารถเลือกซื้อสินค้าแยกเครื่องกันได้อย่างอิสระ (เครื่องใครเครื่องมัน 100%)
          </p>
        </div>
      </div>

      {/* 4 Core Guarantees Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900">ซ่อนเมนู Admin 100%</h4>
            <p className="text-[11px] text-stone-500 mt-0.5">
              ไม่มีปุ่มผู้ดูแล ไม่มีปุ่มเข้าสู่ระบบหลังบ้าน ปลอดภัยสำหรับส่งลูกค้า
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900">เครื่องใครเครื่องมัน</h4>
            <p className="text-[11px] text-stone-500 mt-0.5">
              ตะกร้าสินค้าและติดตามออเดอร์ของเครื่อง A จะไม่กระทบเครื่อง B
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900">สต็อกสินค้าเรียลไทม์</h4>
            <p className="text-[11px] text-stone-500 mt-0.5">
              สินค้าหมดจะถูกซ่อนจากหน้าร้านอัตโนมัติ ไม่ต้องกังวลเรื่องสต็อกชนกัน
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900">แจ้งเตือนร้านทันที</h4>
            <p className="text-[11px] text-stone-500 mt-0.5">
              เมื่อลูกค้ากดยืนยันสั่งซื้อ มีเสียงเตือนในจอ Admin และส่งเข้า LINE
            </p>
          </div>
        </div>
      </div>

      {/* Main Link Generator Card */}
      <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-7 shadow-xs space-y-6">
        
        {/* Link Customizer Bar */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-red-600" />
                <span>ลิงก์หน้าร้านสำหรับลูกค้า (Customer Storefront URL)</span>
              </h3>
              <p className="text-xs text-stone-500">
                คุณสามารถเลือกส่งลิงก์หน้าร้านรวม หรือเจาะจงหมวดหมู่สินค้าที่ต้องการได้
              </p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              🟢 พร้อมส่งลูกค้า ({totalActiveProducts} สินค้าพร้อมขาย)
            </span>
          </div>

          {/* Category Filter Pills for Link */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
            <button
              type="button"
              onClick={() => setSelectedCategorySlug('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                selectedCategorySlug === 'all'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              ✨ สินค้าทั้งหมดในร้าน
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategorySlug(c.slug)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                  selectedCategorySlug === c.slug
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          {/* URL Box & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-stone-50 p-2 sm:p-2.5 rounded-2xl border border-stone-200">
            <div className="flex-1 min-w-0 px-3 py-2 bg-white rounded-xl border border-stone-200/80 text-stone-800 text-xs sm:text-sm font-mono truncate select-all">
              {customerLink || 'กำลังสร้างลิงก์...'}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-xs active:scale-95 ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white'
                }`}
                title="คัดลอกลิงก์ไปยังคลิปบอร์ด"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>คัดลอกลิงก์แล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>คัดลอกลิงก์</span>
                  </>
                )}
              </button>

              <a
                href={customerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                title="เปิดทดสอบดูมุมมองของลูกค้าในแท็บใหม่"
              >
                <ExternalLink className="w-4 h-4 text-stone-500" />
                <span className="hidden sm:inline">เปิดดูมุมมองลูกค้า</span>
              </a>
            </div>
          </div>
        </div>

        {/* 2-Columns: QR Code on Left, Social Sharing & Text on Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-stone-100">
          
          {/* Left: QR Code Preview */}
          <div className="md:col-span-5 flex flex-col items-center bg-stone-50/70 p-5 rounded-3xl border border-stone-200/80 text-center">
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-stone-700">
              <QrCode className="w-4 h-4 text-red-600" />
              <span>QR Code สำหรับสแกนสั่งซื้อ</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border-2 border-stone-200 shadow-sm mb-3">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code สำหรับสั่งซื้อสินค้า"
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-xs text-stone-400">
                  กำลังสร้าง QR Code...
                </div>
              )}
            </div>

            <p className="text-[11px] text-stone-500 max-w-xs mb-3">
              ลูกค้านำมือถือมาสแกนจะเปิดหน้าร้านทันทีโดยไม่ต้องพิมพ์ URL
            </p>

            <div className="flex items-center gap-2 w-full max-w-xs">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`ChumPhae_Store_QRCode_${selectedCategorySlug}.png`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                  title="ดาวน์โหลดรูป QR Code เป็นไฟล์ภาพ PNG"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" />
                  <span>บันทึกรูป QR</span>
                </a>
              )}

              <button
                type="button"
                onClick={handlePrintQr}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-stone-100 text-stone-800 border border-stone-200 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                title="พิมพ์ป้าย QR Code สำหรับวางหน้าร้านหรือแปะพัสดุ"
              >
                <Printer className="w-3.5 h-3.5 text-stone-600" />
                <span>พิมพ์ป้าย QR</span>
              </button>
            </div>
          </div>

          {/* Right: Quick Share to LINE, Facebook, and Copy Marketing Message */}
          <div className="md:col-span-7 space-y-4">
            
            {/* Quick Share Buttons */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-2">
                ส่งต่อลิงก์ไปยังแอปพลิเคชัน (Quick Share)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleShareLine}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
                  title="แชร์ข้อความและลิงก์ร้านไปยัง LINE ทันที"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>แชร์ไปยัง LINE</span>
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
                  title="แชร์ลิงก์ผ่านเมนูแชร์ของมือถือ (Facebook, Messenger, SMS)"
                >
                  <Share2 className="w-4 h-4" />
                  <span>แชร์ผ่านแอปอื่น (Share...)</span>
                </button>
              </div>
            </div>

            {/* Ready-to-use Marketing Message Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>ข้อความสำเร็จรูปพร้อมลิงก์ (สำหรับส่งลูกค้า)</span>
                </label>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className={`text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer px-2.5 py-1 rounded-lg ${
                    copiedMessage
                      ? 'text-emerald-700 bg-emerald-100'
                      : 'text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100'
                  }`}
                >
                  {copiedMessage ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>คัดลอกข้อความแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>คัดลอกข้อความทั้งหมด</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                readOnly
                value={promotionalMessage}
                rows={7}
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-mono text-stone-700 leading-relaxed resize-none focus:outline-hidden select-all"
              />
              <p className="text-[11px] text-stone-400">
                💡 ข้อความนี้จัดรูปแบบสวยงาม พร้อมชื่อร้าน เบอร์โทร และที่อยู่ร้านตามที่ตั้งค่าไว้ สามารถนำไปโพสต์ในหน้าเพจ Facebook หรือส่งใน LINE OA ได้ทันที
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* Frequently Asked Questions / How it works */}
      <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 sm:p-6 space-y-3">
        <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-600" />
          <span>คำแนะนำในการใช้งานลิงก์ลูกค้า (สำหรับเจ้าของร้าน)</span>
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-amber-900 leading-relaxed">
          <div className="bg-white/80 p-3 rounded-2xl border border-amber-200/60 space-y-1">
            <h5 className="font-bold text-stone-900">1. ส่งต่อทางแชท</h5>
            <p className="text-[11px] text-stone-600">
              เมื่อลูกค้าทักแชทสอบถามสินค้า ให้กดคัดลอกลิงก์หรือข้อความสำเร็จรูปส่งให้ลูกค้าได้ทันที ลูกค้าสามารถกดดูและสั่งซื้อได้เลย
            </p>
          </div>

          <div className="bg-white/80 p-3 rounded-2xl border border-amber-200/60 space-y-1">
            <h5 className="font-bold text-stone-900">2. ตั้งป้าย QR หน้าร้าน</h5>
            <p className="text-[11px] text-stone-600">
              กดปุ่ม "พิมพ์ป้าย QR" นำไปตั้งที่เคาน์เตอร์คิดเงินหรือหน้าร้าน เพื่อให้ลูกค้าสแกนดูแคตตาล็อกสินค้าและสต็อกแบบเรียลไทม์
            </p>
          </div>

          <div className="bg-white/80 p-3 rounded-2xl border border-amber-200/60 space-y-1">
            <h5 className="font-bold text-stone-900">3. เครื่องใครเครื่องมัน 100%</h5>
            <p className="text-[11px] text-stone-600">
              ระบบใช้ Session และพื้นที่จัดเก็บแยกเครื่องอย่างอิสระ เมื่อลูกค้าคนหนึ่งสั่งซื้อ จะไม่กระทบตะกร้าหรือรายการสั่งซื้อของลูกค้าท่านอื่น
            </p>
          </div>
        </div>
      </div>

      {/* Download Source Code Section for Store Owner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border-2 border-emerald-300 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[11px] font-bold">
            <Download className="w-3.5 h-3.5" />
            <span>ดาวน์โหลด Source Code ประจำร้าน</span>
          </div>
          <h4 className="text-base font-black text-emerald-950">
            ดาวน์โหลด Source Code ทั้งหมดเป็นไฟล์ ZIP
          </h4>
          <p className="text-xs text-emerald-800 max-w-xl">
            คลิกปุ่มนี้เพื่อดาวน์โหลดไฟล์โค้ดทั้งหมดของโปรเจกต์ (รวมโฟลเดอร์ src, api, public, vercel.json และ config ของ Firebase)
            พร้อมสำหรับนำไปแตกไฟล์และอัปโหลดขึ้น GitHub หรือ Deploy ขึ้น Vercel ได้ทันที
          </p>
        </div>

        <a
          href="/api/admin/download-source"
          download="chumphae-store-source.zip"
          className="shrink-0 flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer border border-emerald-400"
        >
          <Download className="w-4 h-4 text-emerald-200" />
          <span>📥 ดาวน์โหลด Source Code (ZIP)</span>
        </a>
      </div>

    </div>
  );
};
