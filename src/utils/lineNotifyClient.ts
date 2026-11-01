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
 * Notifies both Admin and relevant Co-Sellers simultaneously
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

/**
 * Send an activation link to Seller's LINE Notify token
 */
export async function sendSellerActivationLine(
  token: string,
  shopName: string,
  activationUrl: string
): Promise<LineNotifyClientResponse> {
  try {
    const res = await fetch('/api/seller/activate-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, shopName, activationUrl }),
    });

    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok && data.success,
      message: data.message || (res.ok ? 'ส่งลิงก์ยืนยันเข้า LINE สำเร็จ' : 'ส่งลิงก์ไม่สำเร็จ'),
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `เกิดข้อผิดพลาด: ${err?.message || err}`,
    };
  }
}

/**
 * Send a test message to a Seller's specific LINE Notify token
 */
export async function sendSellerLineTest(token: string, shopName: string): Promise<LineNotifyClientResponse> {
  try {
    const res = await fetch('/api/seller/test-line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, shopName }),
    });

    const data = await res.json().catch(() => ({}));
    return {
      success: res.ok && data.success,
      message: data.message || (res.ok ? 'ทดสอบส่งข้อความเข้า LINE ผู้ขายสำเร็จ' : 'ทดสอบไม่สำเร็จ'),
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `เกิดข้อผิดพลาด: ${err?.message || err}`,
    };
  }
}
