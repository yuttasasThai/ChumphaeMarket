import { verifyAdminPassword } from '../../src/server/adminAuth';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { username, password } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const result = verifyAdminPassword(username, password);

    if (result.success) {
      return res.status(200).json(result);
    }
    return res.status(401).json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: 'ข้อมูลคำขอไม่ถูกต้อง' });
  }
}
