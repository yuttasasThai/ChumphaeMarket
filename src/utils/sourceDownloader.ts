import { ARCHIVE_FILENAME, APP_REVISION } from '../version';

export interface DownloadResult {
  success: boolean;
  method: 'share' | 'blob' | 'fallback';
  sizeBytes: number;
  filename: string;
  message: string;
}

/**
 * Downloads or shares the full source code archive directly inside browser memory.
 * This completely avoids the Android Download Manager issue where external HTTP requests
 * are intercepted and saved as .html files.
 */
export async function downloadSourceCodeArchive(
  onProgress?: (step: string) => void
): Promise<DownloadResult> {
  const filename = ARCHIVE_FILENAME || 'chumphae-store-source-rev8.zip';
  
  onProgress?.('กำลังดึงไฟล์ซอร์สโค้ดจากเซิร์ฟเวอร์...');
  
  // 1. Authenticated in-browser fetch (inherits active session cookies)
  const response = await fetch(`/${filename}?t=${Date.now()}`, {
    credentials: 'include',
    cache: 'no-cache',
    headers: {
      'Accept': 'application/zip, application/octet-stream, */*'
    }
  });

  if (!response.ok) {
    throw new Error(`ไม่สามารถดาวน์โหลดได้ (รหัสตอบกลับ: ${response.status})`);
  }

  onProgress?.('กำลังแปลงข้อมูลไฟล์ ZIP (ตรวจสอบความถูกต้อง)...');
  const blob = await response.blob();

  // Safety check: Ensure the blob is not an HTML redirect (like the 10.33 KB cookie_check.html)
  if (blob.size < 500000) {
    // If under 500 KB, it's not the real 3.25 MB zip file
    const sampleText = await blob.slice(0, 100).text();
    if (sampleText.toLowerCase().includes('<!doctype') || sampleText.toLowerCase().includes('<html')) {
      throw new Error('ตรวจพบไฟล์ที่ได้รับเป็นการเปลี่ยนเส้นทาง HTML ไม่ใช่ไฟล์ ZIP กรุณาลองใช้วิธีแก้ไขผ่าน GitHub โดยตรง');
    }
    throw new Error(`ขนาดไฟล์ผิดปกติ (${(blob.size / 1024).toFixed(1)} KB) กรุณาลองใหม่อีกครั้ง`);
  }

  // Ensure blob is treated strictly as application/zip
  const zipBlob = new Blob([blob], { type: 'application/zip' });
  const sizeMB = (zipBlob.size / (1024 * 1024)).toFixed(2);

  // 2. Mobile Native Share API (Android / Xiaomi / Samsung / iOS)
  // This is the cleanest and most reliable way on mobile phones.
  // The phone opens its system sheet ("Save to Downloads", "Google Drive", "File Manager")
  // passing the in-memory binary File directly without any HTTP request.
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile && typeof navigator !== 'undefined' && 'canShare' in navigator && typeof navigator.share === 'function') {
    try {
      const file = new File([zipBlob], filename, { type: 'application/zip' });
      if (navigator.canShare({ files: [file] })) {
        onProgress?.('กำลังเปิดเมนูบันทึกไฟล์ลงเครื่องมือถือ...');
        await navigator.share({
          title: `ซอร์สโค้ดร้านขายถูกที่นี่ชุมแพ (${APP_REVISION})`,
          text: `ไฟล์ซอร์สโค้ดฉบับสมบูรณ์ (${sizeMB} MB) พร้อมดีพลอยบน Vercel/GitHub`,
          files: [file],
        });

        return {
          success: true,
          method: 'share',
          sizeBytes: zipBlob.size,
          filename,
          message: `เปิดเมนูส่งไฟล์เรียบร้อย (${sizeMB} MB)`
        };
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        // User closed the share menu
        return {
          success: true,
          method: 'share',
          sizeBytes: zipBlob.size,
          filename,
          message: 'ยกเลิกการแชร์'
        };
      }
      console.warn('Web Share failed, falling back to Blob download:', shareErr);
    }
  }

  // 3. In-memory Blob Object URL download (Desktop or fallback)
  // When an <a> clicks a blob: URL, the browser retrieves it directly from memory
  // without asking Android Download Manager to fetch it over network.
  onProgress?.('กำลังบันทึกไฟล์ .zip ลงเครื่อง...');
  const objectUrl = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  }, 30000);

  return {
    success: true,
    method: 'blob',
    sizeBytes: zipBlob.size,
    filename,
    message: `บันทึกไฟล์ ${filename} (${sizeMB} MB) ลงเครื่องสำเร็จ`
  };
}
