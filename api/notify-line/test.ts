import { sendToLineNotify, getStoreSettingsFromFirestore } from '../../src/server/lineNotifyHandler';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    let token = data.token;

    if (!token || !token.trim()) {
      const settings = await getStoreSettingsFromFirestore();
      token = settings?.lineNotifyToken || process.env.LINE_NOTIFY_TOKEN || process.env.VITE_LINE_NOTIFY_TOKEN;
    }

    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก LINE Notify Token ก่อนทดสอบ' });
    }

    const testMsg = `\n🔔 [ร้านขายถูกที่นี่ชุมแพ] ทดสอบการเชื่อมต่อ LINE Notify สำเร็จ!\nระบบแจ้งเตือนออเดอร์ใหม่พร้อมใช้งานแล้ว เมื่อมีลูกค้าสั่งซื้อสินค้า ข้อความจะส่งเข้าแชทนี้ทันทีโดยไม่ต้องเปิดหน้าจอแอดมินทิ้งไว้ 🎉\n⏰ เวลาทดสอบ: ${new Date().toLocaleString('th-TH')}`;
    const result = await sendToLineNotify(token, testMsg);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Server error' });
  }
}
