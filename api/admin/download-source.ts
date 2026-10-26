import { streamSourceZip } from '../../src/server/sourceDownloader';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    streamSourceZip(res);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Download error' });
  }
}
