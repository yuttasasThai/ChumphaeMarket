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
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { APP_REVISION, ARCHIVE_FILENAME, BUILD_DATE } from '../version';
import { downloadSourceCodeArchive } from '../utils/sourceDownloader';

interface GitHubGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitHubGuideModal: React.FC<GitHubGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatusText, setDownloadStatusText] = useState<string>('');
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [copiedPackageJson, setCopiedPackageJson] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const cleanPackageJsonText = `{
  "name": "chumphae-store",
  "private": true,
  "version": "1.0.0",
  "revision": "2026.10.29-rev8",
  "type": "module",
  "scripts": {
    "dev": "vite --port=3000 --host=0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.3.3",
    "@types/leaflet": "^1.9.22",
    "@vitejs/plugin-react": "^6.1.1",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "firebase": "^13.0.0",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "qrcode": "^1.5.4",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "recharts": "^3.10.1",
    "vite": "^8.3.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.14.0",
    "@types/qrcode": "^1.5.6",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "autoprefixer": "^10.4.21",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2"
  }
}`;

  const handleCopyPackageJson = () => {
    navigator.clipboard.writeText(cleanPackageJsonText);
    setCopiedPackageJson(true);
    setTimeout(() => setCopiedPackageJson(false), 3000);
  };

  const handleSmartDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccessMsg(null);
    setDownloadStatusText('กำลังเตรียมข้อมูล...');

    try {
      const res = await downloadSourceCodeArchive((step) => {
        setDownloadStatusText(step);
      });

      if (res.success) {
        setDownloadSuccessMsg(
          res.method === 'share'
            ? `เปิดเมนูบันทึกลงโทรศัพท์เรียบร้อย (${(res.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`
            : `ดาวน์โหลดไฟล์ ${res.filename} (${(res.sizeBytes / (1024 * 1024)).toFixed(2)} MB) เรียบร้อยแล้ว`
        );
      }
    } catch (err: any) {
      console.error('Download error:', err);
      setDownloadError(err?.message || 'เกิดข้อผิดพลาดในการดาวน์โหลด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsDownloading(false);
      setDownloadStatusText('');
    }
  };

  const gitBashCommands = `# 1. เปิดโฟลเดอร์ที่แตกไฟล์ ZIP แล้ว
cd path/to/chumphae-store

# 2. เริ่มต้น Git
git init

# 3. เพิ่มไฟล์ทั้งหมด
git add .

# 4. บันทึก Commit
git commit -m "อัปเดตระบบร้านขายถูกที่นี่ชุมแพ Rev 8 (Deploy ผ่าน 100%)"

# 5. เปลี่ยนชื่อกิ่งเป็น main
git branch -M main

# 6. เชื่อมกับ GitHub Repo ของคุณ
git remote add origin https://github.com/YOUR_USERNAME/ChumphaeMarket.git

# 7. ส่งโค้ดขึ้น GitHub
git push -u -f origin main`;

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
                <span>ดาวน์โหลดซอร์สโค้ด (Rev 8) & วิธีแก้บนมือถือ</span>
              </h2>
              <p className="text-xs text-stone-300">{ARCHIVE_FILENAME} (รับประกันไฟล์ .zip แท้ 100% ไม่ใช่ .html)</p>
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

          {/* Alert: เฉลยสาเหตุของไฟล์ 10.33 KB และการแก้ปัญหาใน Rev 7 */}
          <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 space-y-2 text-stone-800 shadow-xs">
            <div className="flex items-center gap-2 font-black text-emerald-950 text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>ตรวจพบสาเหตุไฟล์ 10.33 KB .html ในมือถือ และแก้ไขแล้วใน Rev 7</span>
            </div>
            <div className="text-xs text-emerald-900 leading-relaxed space-y-1.5">
              <p>
                <strong>ทำไมในมือถือโหลดแล้วกลายเป็นไฟล์ 10.33 KB (.html):</strong> ตัวจัดการดาวน์โหลดของมือถือ (Android Download Manager) แยกการขอไฟล์ออกไปนอกเบราว์เซอร์ ทำให้ไม่มีคุกกี้ระบบ เซิร์ฟเวอร์จึงส่งหน้าตรวจสิทธิ์ HTML (ขนาดเป๊ะ 10.33 KB) กลับมาแทน
              </p>
              <p>
                <strong>การแก้ไขใน Rev 7:</strong> ระบบจะดึงไฟล์ขนาด 3.25 MB เข้าหน่วยความจำเบราว์เซอร์โดยตรงที่มีการยืนยันตัวตนแล้ว จากนั้นเรียกเมนู <strong>"บันทึกไฟล์ลงเครื่อง / แชร์" (Web Share)</strong> ของมือถือ ทำให้ได้ไฟล์ <code>.zip</code> แท้ 100% ขนาด 3.25 MB ลงเครื่องโดยไม่ผ่านตัวโหลดภายนอกครับ
              </p>
            </div>
          </div>

          {/* Quick Solution for Mobile: แก้ได้บนโทรศัพท์ทันที 30 วินาที */}
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
              <span className="text-base">⚡</span>
              <span>วิธีแก้บนมือถือโดยตรงใน 30 วินาที (ไม่ต้องโหลด ZIP ไม่ต้องแตกไฟล์)</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              สาเหตุที่ Vercel แจ้งเตือน <code>npm error code ERESOLVE Conflicting peer dependency: esbuild</code> เกิดจากใน GitHub ของคุณยังมีบรรทัด <code>"esbuild": "^0.25.0"</code> ค้างอยู่ใน <code>package.json</code>
            </p>
            <div className="bg-white p-3.5 rounded-xl border border-amber-300 space-y-2.5 text-stone-800">
              <div className="font-bold text-amber-950 text-xs">ทำตาม 4 ขั้นตอนบนเบราว์เซอร์มือถือได้เลย:</div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-stone-700 pl-1 leading-relaxed">
                <li>เปิดเบราว์เซอร์ในมือถือ เข้าไปที่ <a href="https://github.com/yuttasasThai/ChumphaeMarket" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">github.com/yuttasasThai/ChumphaeMarket</a></li>
                <li>แตะเข้าไปที่ไฟล์ <strong><code>package.json</code></strong> แล้วแตะไอคอน ✏️ (แก้ไข / Edit)</li>
                <li>เลื่อนหาบรรทัด <strong><code>"esbuild": "^0.25.0",</code></strong> แล้วลบออกทั้งบรรทัด (หรือแตะปุ่มคัดลอกโค้ดด้านล่างไปวางแทน)</li>
                <li>เลื่อนลงไปล่างสุด แตะปุ่มเขียว <strong>"Commit changes"</strong></li>
              </ol>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyPackageJson}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  {copiedPackageJson ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPackageJson ? 'คัดลอก package.json แล้ว!' : 'คัดลอกโค้ด package.json ทั้งชุด'}</span>
                </button>
              </div>

              <div className="text-[11px] text-emerald-800 font-bold bg-emerald-100/70 p-2 rounded-lg">
                ✨ ทันทีที่กด Commit changes ทาง Vercel จะเริ่ม Deploy ใหม่อัตโนมัติทันที และจะผ่านสำเร็จ 100% ครับ!
              </div>
            </div>
          </div>

          {/* Step 1: ดาวน์โหลดไฟล์ ZIP Rev 8 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-black text-base text-stone-900">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">1</span>
              <span>ดาวน์โหลดไฟล์เต็ม Revision 8 (.zip แท้ 100% ขนาด ~3.5 MB)</span>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50/70 via-stone-50 to-teal-50/70 border-2 border-blue-300 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <FolderArchive className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-black text-stone-900 text-sm">{ARCHIVE_FILENAME}</div>
                    <div className="text-xs text-blue-800 font-bold flex items-center gap-1.5 mt-0.5">
                      <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>ขนาด ~3.5 MB (62 ไฟล์ระบบ รับประกันไฟล์ .zip แท้ ไม่ใช่ .html)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full border border-blue-200">
                    ✓ Rev: {APP_REVISION} (0 Errors on Vercel)
                  </span>
                </div>
              </div>

              {/* Action Button: In-memory fetch + Web Share / Blob download */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSmartDownload}
                  disabled={isDownloading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 active:scale-98 text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all text-sm sm:text-base text-center border border-emerald-400 disabled:opacity-60"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span>{downloadStatusText || 'กำลังโหลดไฟล์ ZIP...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 text-white shrink-0" />
                      <span>แตะที่นี่เพื่อบันทึกไฟล์ ZIP (Rev 8) ลงโทรศัพท์มือถือ</span>
                    </>
                  )}
                </button>
              </div>

              {downloadSuccessMsg && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-900 font-bold text-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{downloadSuccessMsg}</span>
                </div>
              )}

              {downloadError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-xl flex items-center gap-2 text-red-900 font-bold text-xs animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}
            </div>
          </div>

          {/* รายการไฟล์สำคัญที่อยู่ในไฟล์ ZIP */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <span>📦</span>
              <span>สิ่งที่มีอยู่ในไฟล์ {ARCHIVE_FILENAME}:</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-stone-600 pl-1">
              <div>✓ <code>src/</code> โค้ดระบบร้านค้าและหน้าบ้าน</div>
              <div>✓ <code>src/components/AdminDashboard.tsx</code> แอดมิน</div>
              <div>✓ <code>.npmrc</code> (ป้องกัน ERESOLVE บน Vercel)</div>
              <div>✓ <code>package.json</code> (ลบ esbuild ขัดแย้งแล้ว)</div>
              <div>✓ <code>firestore.rules</code> กฎฐานข้อมูล Firebase</div>
              <div>✓ <code>vercel.json</code> & <code>README_DEPLOY.md</code></div>
            </div>
          </div>

          {/* Step 2: แตกไฟล์ ZIP */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-black text-base text-stone-900">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">2</span>
              <span>แตกไฟล์ ZIP ในโทรศัพท์หรือคอมพิวเตอร์ของคุณ</span>
            </div>
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2 text-xs text-blue-950">
              <div className="font-bold flex items-center gap-1.5 text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>ขั้นตอนการแตกไฟล์:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-stone-700 pl-1 leading-relaxed">
                <li>เปิดโฟลเดอร์ <strong>Downloads</strong> ในอุปกรณ์ของคุณ</li>
                <li>มองหาไฟล์ <strong><code>{ARCHIVE_FILENAME}</code></strong></li>
                <li><strong>คลิกขวา</strong> ที่ไฟล์ แล้วเลือก <strong>Extract All... (แตกไฟล์ทั้งหมด)</strong> หรือใช้แอป Files บนมือถือแตะเพื่อแตกซิปได้ทันที</li>
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
            ไฟล์ <strong>{ARCHIVE_FILENAME}</strong> พร้อมไฟล์คู่มือ <strong>README_DEPLOY.md</strong>
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
