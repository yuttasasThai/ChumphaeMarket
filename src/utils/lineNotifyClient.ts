/**
 * Client-side utility to interact with the Line Notify backend endpoints
 */

export interface LineNotifyClientResponse {
  success: boolean;
  message: string;
  status?: number;
}

/**
 * Trigger an instant Line notification for an order
 * Sends order ID and order payload so that the backend can retrieve from Firestore and dispatch to LINE
 */
export async function triggerLineNotification(orderId: string, orderData?: any): Promise<LineNotifyClientResponse> {
  try {
    const res = await fetch('/api/notify-line/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, order: orderData }),
    });

    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok && data.success,
      message: data.message || (res.ok ? 'ส่งแจ้งเตือนเข้า LINE เรียบร้อย' : 'ไม่สามารถส่งแจ้งเตือนได้'),
      status: res.status,
    };
  } catch (err: any) {
    console.warn('[LineNotifyClient] Failed to trigger notification:', err);
    return {
      success: false,
      message: `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ${err?.message || err}`,
    };
  }
}

/**
 * Send a test message to LINE Notify using a provided token or store settings
 */
export async function sendLineNotifyTest(token?: string): Promise<LineNotifyClientResponse> {
  try {
    const res = await fetch('/api/notify-line/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok && data.success,
      message: data.message || (res.ok ? 'ส่งข้อความทดสอบสำเร็จ' : 'ทดสอบไม่สำเร็จ'),
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `เกิดข้อผิดพลาด: ${err?.message || err}`,
    };
  }
}
