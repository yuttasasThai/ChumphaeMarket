import { changeAdminPassword } from '../../src/server/adminAuth';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { oldPassword, newPassword } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const result = changeAdminPassword(oldPassword, newPassword);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
