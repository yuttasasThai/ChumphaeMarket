import { validateSessionToken } from '../../src/server/adminAuth';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false });
  }

  try {
    const { token } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const isValid = validateSessionToken(token);
    return res.status(200).json({ valid: isValid });
  } catch {
    return res.status(400).json({ valid: false });
  }
}
