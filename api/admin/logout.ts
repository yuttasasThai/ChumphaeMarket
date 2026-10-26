import { revokeSessionToken } from '../../src/server/adminAuth';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false });
  }

  try {
    const { token } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (token) {
      revokeSessionToken(token);
    }
    return res.status(200).json({ success: true });
  } catch {
    return res.status(200).json({ success: true });
  }
}
