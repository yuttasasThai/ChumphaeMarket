import { calculateRoadDistance } from '../src/server/distanceHandler';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { origin, destination, orderSubtotal } = data;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination coordinates are required' });
    }

    const result = await calculateRoadDistance(origin, destination, Number(orderSubtotal || 0));
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Distance calculation error' });
  }
}
