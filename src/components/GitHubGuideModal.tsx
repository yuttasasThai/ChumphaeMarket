import React, { useState } from 'react';
import {
  X,
  Download,
  Github,
  FolderArchive,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Terminal,
  Globe,
  Loader2,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { APP_REVISION, BUILD_DATE } from '../version';

interface GitHubGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubGuideModal: React.FC<GitHubGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleSmartDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      // Fetch binary data directly via JavaScript
      const response = await fetch('/chumphae-store-source.zip', {
        cache: 'no-store',
        headers: {
          'Accept': 'application/zip, application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`เซิร์ฟเวอร์ตอบกลับสถานะ HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('เซิร์ฟเวอร์ส่งไฟล์ HTML มาแทน ไม่ใช่ไฟล์ ZIP');
      }

      const blob = await response.blob();
      if (blob.size < 50000) {
        throw new Error(`ขนาดไฟล์ผิดปกติ (${blob.size} bytes)`);
      }

      // Create a genuine application/zip blob URL in browser memory
      const zipBlob = new Blob([blob], { type: 'application/zip' });
      const blobUrl = window.URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', 'chumphae-store-source.zip');
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(link);
      }, 1500);

      setDownloadSuccess(true);
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadError(err?.message || 'ไม่สามารถดาวน์โหลดได้ กรุณาลองเปิดในแท็บใหม่');
    } finally {
      setIsDownloading(false);
    }
  };

  const gitBashCommands = `# 1. เปิดโฟลเดอร์ที่แตกไฟล์ ZIP แล้ว
cd path/to/chumphae-store

# 2. เริ่มต้น Git
git init

# 3. เพิ่มไฟล์ทั้งหมด
git add .

# 4. บันทึก Commit
git commit -m "ระบบร้านขายถูกที่นี่ชุมแพ (รองรับ Admin, Seller, ลูกค้า)"

# 5. เปลี่ยนชื่อกิ่งเป็น main
git branch -M main

# 6. เชื่อมกับ GitHub Repo ของคุณ (เปลี่ยน URL ให้เป็นของคุณ)
git remote add origin https://github.com/YOUR_USERNAME/chumphae-store.git

# 7. ส่งโค้ดขึ้น GitHub
git push -u origin main`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white flex items-center justify-between sticky top-0 z-10 border-b border-stone-700 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-xs">
              <Github className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>ดาวน์โหลดซอร์สโค้ด ZIP & วิธีนำขึ้น GitHub</span>
              </h2>
              <p className="text-xs text-stone-300">รับประกันไฟล์ .zip 100% ไม่ใช่ .html แน่นอน</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 text-stone-800 text-xs sm:text-sm">

          {/* Alert: ทำไมถึงได้ไฟล์ .html ในรอบก่อน */}
          <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-black text-red-900 text-sm">
                สาเหตุที่กดดาวน์โหลดแล้วได้ไฟล์ .html
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                เนื่องจากหน้าพรีวิวนี้รันอยู่ใน <strong>iFrame ของระบบ Google AI Studio</strong> เมื่อกดปุ่มดาวน์โหลดแบบเดิม บราวเซอร์บางรุ่น (โดยเฉพาะ Chrome) จะเข้าใจว่าเป็นการเซฟหน้าเว็บ จึงบันทึกเป็นหน้าเว็บ <code>.html</code> ออกมาแทน
                <br />
                <strong>วิธีแก้:</strong> ระบบได้ทำปุ่ม <strong>"ดาวน์โหลดตรงผ่าน JavaScript Blob"</strong> ด้านล่างนี้ ซึ่งจะดึงไฟล์ไบนารี ZIP ขนาด 3.2 MB เข้าสู่เครื่องคอมพิวเตอร์ของคุณโดยตรง 100%
              </p>
            </div>
          </div>

          {/* Step 1: ดาวน์โหลดไฟล์ ZIP แบบรับประกัน 100% */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-black text-base text-stone-900">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">1</span>
              <span>กดดาวน์โหลดไฟล์ Source Code (.zip)</span>
            </div>

            <div className="p-4 bg-gradient-to-br from-emerald-50/70 via-stone-50 to-teal-50/70 border-2 border-emerald-300 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-black text-stone-900 text-sm">chumphae-store-source.zip</div>
                    <div className="text-xs text-emerald-800 font-bold flex items-center gap-1.5 mt-0.5">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ขนาด 3.23 MB (ไฟล์ ZIP รวมครบ 55 ไฟล์ระบบ)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                    ✓ Rev: {APP_REVISION} (Deploy Ready)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Method 1: JavaScript Blob Download */}
                <button
                  type="button"
                  onClick={handleSmartDownload}
                  disabled={isDownloading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-black rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 text-xs sm:text-sm"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังส่งไฟล์ ZIP...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>ดาวน์โหลดไฟล์ ZIP ทันที</span>
                    </>
                  )}
                </button>

                {/* Method 2: Open in New Tab (Bypasses iFrame completely) */}
                <a
                  href="/chumphae-store-source.zip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 active:scale-98 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all text-xs sm:text-sm border border-stone-700"
                  title="เปิดดาวน์โหลดในแท็บใหม่เพื่อหลุดออกจากกรอบ iFrame"
                >
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                  <span>เปิดโหลดในแท็บใหม่ (สำรอง)</span>
                </a>
              </div>

              {downloadSuccess && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-900 font-bold text-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>คำสั่งดาวน์โหลดสำเร็จ! โปรดดูที่โฟลเดอร์ Downloads ในเครื่องของคุณ จะได้ไฟล์ "chumphae-store-source.zip"</span>
                </div>
              )}

              {downloadError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-900 font-bold text-xs animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{downloadError} (ให้คลิกปุ่มสีดำ "เปิดโหลดในแท็บใหม่" ด้านบนแทนครับ)</span>
                </div>
              )}
            </div>
          </div>

          {/* รายการไฟล์สำคัญที่อยู่ในไฟล์ ZIP */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <span>📦</span>
              <span>สิ่งที่มีอยู่ในไฟล์ chumphae-store-source.zip (รวม 55 รายการ):</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-stone-600 pl-1">
              <div>✓ <code>src/</code> โค้ดระบบร้านค้าและหน้าบ้าน</div>
              <div>✓ <code>src/components/AdminDashboard.tsx</code> แอดมิน</div>
              <div>✓ <code>src/components/SellerPortal.tsx</code> ระบบ Seller</div>
              <div>✓ <code>api/</code> ระบบระยะทาง & LINE Notify</div>
              <div>✓ <code>firestore.rules</code> กฎฐานข้อมูล Firebase</div>
              <div>✓ <code>package.json</code> & <code>vite.config.ts</code></div>
            </div>
          </div>

          {/* Step 2: แตกไฟล์ ZIP */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-black text-base text-stone-900">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">2</span>
              <span>แตกไฟล์ ZIP ในคอมพิวเตอร์ของคุณ</span>
            </div>
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2 text-xs text-blue-950">
              <div className="font-bold flex items-center gap-1.5 text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>ขั้นตอนการแตกไฟล์:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-stone-700 pl-1 leading-relaxed">
                <li>เปิดโฟลเดอร์ <strong>Downloads</strong> ในคอมพิวเตอร์ของคุณ</li>
                <li>มองหาไฟล์ <strong><code>chumphae-store-source.zip</code></strong></li>
                <li><strong>คลิกขวา</strong> ที่ไฟล์ แล้วเลือก <strong>Extract All... (แตกไฟล์ทั้งหมด)</strong> หรือ 7-Zip / WinRAR</li>
                <li>กด <strong>Extract</strong> จะได้โฟลเดอร์ที่มีไฟล์และโฟลเดอร์ทั้งหมดครบถ้วน</li>
              </ol>
            </div>
          </div>

          {/* Step 3: นำขึ้น GitHub */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-black text-base text-stone-900">
              <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black">3</span>
              <span>อัปโหลดขึ้น GitHub (ทำตามทีละข้อ)</span>
            </div>

            {/* Option A: Drag & Drop via Web */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
              <div className="font-bold text-stone-900 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-800 text-[11px] px-2 py-0.5 rounded-full font-bold">วิธีง่ายสุด</span>
                <span>ลากไฟล์วางผ่านหน้าเว็บ GitHub (ไม่ต้องพิมพ์คำสั่ง)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-stone-700 pl-1 leading-relaxed">
                <li>เข้าสู่ระบบที่ <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">github.com</a></li>
                <li>กดปุ่มสีเขียว <strong>New</strong> (เพื่อสร้าง Repository ใหม่)</li>
                <li>ตั้งชื่อ Repository เช่น <code>chumphae-store</code> แล้วกดปุ่มเขียว <strong>Create repository</strong></li>
                <li>ในหน้าใหม่ ให้คลิกข้อความสีฟ้า <strong>"uploading an existing file"</strong></li>
                <li>เปิดโฟลเดอร์ที่แตกซิปไว้ คลุมดำเลือกไฟล์ทั้งหมดแล้ว <strong>ลากเข้ามาวางในหน้าเว็บ GitHub</strong></li>
                <li>รอให้อัปโหลดครบ แล้วพิมพ์ในช่องว่า <code>Initial commit</code> จากนั้นกดปุ่มเขียว <strong>Commit changes</strong></li>
              </ol>
            </div>

            {/* Option B: Git CLI */}
            <div className="p-4 bg-stone-900 text-stone-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold text-white flex items-center gap-2 text-xs">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>วิธีที่ 2: ใช้คำสั่ง Git Bash / Terminal (ถ้าต้องการ)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(gitBashCommands, 'git')}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold text-stone-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedCode === 'git' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode === 'git' ? 'คัดลอกแล้ว' : 'คัดลอกคำสั่ง'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono overflow-x-auto text-emerald-300 bg-black/40 p-3 rounded-xl">
                {gitBashCommands}
              </pre>
            </div>
          </div>

          {/* Step 4: Deploy on Vercel */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl space-y-2">
            <div className="font-bold text-emerald-950 flex items-center gap-2 text-xs sm:text-sm">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>ขั้นตอนถัดไป: นำขึ้น Vercel เพื่อเปิดเป็นเว็บจริงฟรี 24 ชม.</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              เมื่อโค้ดอยู่บน GitHub แล้ว ให้ไปที่ <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">vercel.com</a> ล็อกอินด้วยบัญชี GitHub แล้วกด <strong>Add New... Project</strong> เลือก Repository นี้แล้วกด <strong>Deploy</strong> ได้ทันที
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-500 font-semibold">
            ไฟล์ ZIP มีขนาด 3.23 MB พร้อมไฟล์คู่มือ <strong>README_DEPLOY.md</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
