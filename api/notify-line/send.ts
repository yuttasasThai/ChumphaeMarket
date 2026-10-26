import { processOrderLineNotification } from '../../src/server/lineNotifyHandler';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { orderId, order, token } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const targetOrderId = orderId || order?.id;

    if (!targetOrderId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ orderId' });
    }

    const result = await processOrderLineNotification(targetOrderId, order, token);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Error processing Line notification' });
  }
}
