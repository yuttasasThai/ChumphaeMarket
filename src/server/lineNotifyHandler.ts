import firebaseConfig from '../../firebase-applet-config.json';

export interface LineNotifyResult {
  success: boolean;
  status?: number;
  message: string;
  responseBody?: any;
}

// Convert Firestore REST document fields to standard JavaScript object
export function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    const fields = val.mapValue.fields || {};
    for (const k of Object.keys(fields)) {
      res[k] = decodeFirestoreValue(fields[k]);
    }
    return res;
  }
  return val;
}

export function decodeFirestoreDoc(docData: any): any {
  if (!docData || !docData.fields) return null;
  const res: Record<string, any> = {};
  for (const k of Object.keys(docData.fields)) {
    res[k] = decodeFirestoreValue(docData.fields[k]);
  }
  if (docData.name) {
    const parts = docData.name.split('/');
    res.id = parts[parts.length - 1];
  }
  return res;
}

// Base Firestore REST URL
function getFirestoreBaseUrl(): string {
  const projectId = firebaseConfig.projectId;
  const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;
}

// Fetch store settings from Firestore
export async function getStoreSettingsFromFirestore(): Promise<any | null> {
  try {
    const url = `${getFirestoreBaseUrl()}/store_settings/main_config?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const docData = await res.json();
    return decodeFirestoreDoc(docData);
  } catch (err) {
    console.warn('[LineNotify] Could not fetch store settings from Firestore:', err);
    return null;
  }
}

// Fetch a specific order from Firestore
export async function getOrderFromFirestore(orderId: string): Promise<any | null> {
  try {
    const url = `${getFirestoreBaseUrl()}/orders/${orderId}?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const docData = await res.json();
    return decodeFirestoreDoc(docData);
  } catch (err) {
    console.warn(`[LineNotify] Could not fetch order ${orderId} from Firestore:`, err);
    return null;
  }
}

// Query recent unnotified orders from Firestore
export async function getUnnotifiedOrdersFromFirestore(): Promise<any[]> {
  try {
    const url = `${getFirestoreBaseUrl()}/orders?pageSize=20&key=${firebaseConfig.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    const documents = data.documents || [];
    const orders = documents.map(decodeFirestoreDoc).filter(Boolean);

    // Filter orders created in the last 2 hours that haven't been successfully notified
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    return orders.filter((o: any) => {
      const orderTime = new Date(o.createdAt || 0).getTime();
      return orderTime >= twoHoursAgo && o.lineNotifyStatus !== 'sent' && o.status !== 'cancelled';
    });
  } catch (err) {
    console.warn('[LineNotify] Could not query unnotified orders:', err);
    return [];
  }
}

// Mark order as notified in Firestore
export async function markOrderAsNotifiedInFirestore(orderId: string, status: 'sent' | 'failed', errorMsg?: string): Promise<void> {
  try {
    const patchUrl = `${getFirestoreBaseUrl()}/orders/${orderId}?updateMask.fieldPaths=lineNotifyStatus&updateMask.fieldPaths=lineNotifiedAt${errorMsg ? '&updateMask.fieldPaths=lineNotifyError' : ''}&key=${firebaseConfig.apiKey}`;
    const fields: Record<string, any> = {
      lineNotifyStatus: { stringValue: status },
      lineNotifiedAt: { stringValue: new Date().toISOString() },
    };
    if (errorMsg) {
      fields.lineNotifyError = { stringValue: errorMsg.slice(0, 200) };
    }

    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  } catch (err) {
    console.warn(`[LineNotify] Failed to mark order ${orderId} as notified:`, err);
  }
}

// Send raw message to Line Notify API
export async function sendToLineNotify(token: string, message: string): Promise<LineNotifyResult> {
  if (!token || !token.trim()) {
    return {
      success: false,
      message: 'ไม่ได้ระบุ LINE Notify Token',
    };
  }

  try {
    const params = new URLSearchParams();
    params.append('message', message);

    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const status = response.status;
    let responseBody: any = null;
    try {
      responseBody = await response.json();
    } catch {
      // ignore json parse error
    }

    if (response.ok) {
      return {
        success: true,
        status,
        message: 'ส่งข้อความเข้า LINE สำเร็จ',
        responseBody,
      };
    } else {
      let errText = `LINE Notify ตอบกลับด้วยรหัส ${status}`;
      if (status === 401) {
        errText = 'Token ไม่ถูกต้อง หรือถูกยกเลิกแล้ว (401 Unauthorized)';
      } else if (responseBody?.message) {
        errText = responseBody.message;
      }
      return {
        success: false,
        status,
        message: errText,
        responseBody,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `เกิดข้อผิดพลาดในการเชื่อมต่อ LINE Notify: ${err?.message || err}`,
    };
  }
}

// Format detailed Thai notification message for an order
export function formatOrderLineMessage(order: any, storeSettings?: any): string {
  const storeName = storeSettings?.storeName || 'ขายถูกที่นี่ชุมแพ';
  const orderNumber = order.orderNumber || order.id || 'N/A';
  const customerName = order.customerName || 'ลูกค้า';
  const customerPhone = order.customerPhone || 'ไม่ระบุ';
  
  let fulfillmentLabel = 'จัดส่งถึงที่';
  if (order.fulfillmentType === 'pickup') {
    fulfillmentLabel = 'มารับสินค้าเองที่ร้าน';
  } else if (order.fulfillmentType === 'meetup') {
    fulfillmentLabel = 'นัดรับสินค้า';
  }

  const distanceText = order.distanceKm ? ` (ระยะทางประมาณ ${Number(order.distanceKm).toFixed(1)} กม.)` : '';
  const addressText = order.deliveryAddress ? order.deliveryAddress.trim() : 'ตามที่แจ้ง';

  // Items list
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const itemsText = items.map((it: any, index: number) => {
    const qty = it.quantity || 1;
    const unit = it.unit || 'ชิ้น';
    const subtotal = Number(it.subtotal || (it.price * qty) || 0).toLocaleString();
    return `${index + 1}. ${it.name} x ${qty} ${unit} = ${subtotal} บ.`;
  }).join('\n');

  // Format date in Thai
  let formattedDate = '';
  try {
    const dateObj = order.createdAt ? new Date(order.createdAt) : new Date();
    formattedDate = dateObj.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    formattedDate = new Date().toLocaleString();
  }

  const subtotal = Number(order.subtotal || 0).toLocaleString();
  const deliveryFee = Number(order.deliveryFee || 0);
  const deliveryFeeText = order.fulfillmentType === 'pickup'
    ? '0 บาท (รับเองที่ร้าน)'
    : order.fulfillmentType === 'meetup'
    ? 'นัดหมายค่าส่ง'
    : `${deliveryFee.toLocaleString()} บาท`;
  const totalAmount = Number(order.totalAmount || 0).toLocaleString();

  // Payment method
  const paymentMethod = order.paymentMethod === 'cod' ? 'เก็บเงินปลายทาง' : 'โอนเงิน PromptPay';

  let msg = `\n🔔 [${storeName}] มีออเดอร์ใหม่!`;
  msg += `\n━━━━━━━━━━━━━━━━`;
  msg += `\n🔖 รหัสสั่งซื้อ: #${orderNumber}`;
  msg += `\n👤 ลูกค้า: คุณ ${customerName}`;
  msg += `\n📞 เบอร์โทร: ${customerPhone}`;
  msg += `\n🛵 รูปแบบ: ${fulfillmentLabel}${distanceText}`;
  msg += `\n📍 ที่อยู่: ${addressText}`;
  
  if (itemsText) {
    msg += `\n━━━━━━━━━━━━━━━━`;
    msg += `\n📦 รายการสินค้า (${items.length} รายการ):`;
    msg += `\n${itemsText}`;
  }

  msg += `\n━━━━━━━━━━━━━━━━`;
  msg += `\n💵 ค่าสินค้า: ${subtotal} บาท`;
  msg += `\n🛵 ค่าจัดส่ง: ${deliveryFeeText}`;
  msg += `\n💰 ยอดรวมทั้งสิ้น: ${totalAmount} บาท`;
  msg += `\n💳 ชำระเงิน: ${paymentMethod}`;
  
  if (order.notes && order.notes.trim()) {
    msg += `\n📝 หมายเหตุลูกค้า: ${order.notes.trim()}`;
  }
  
  msg += `\n⏰ เวลา: ${formattedDate} น.`;
  msg += `\n━━━━━━━━━━━━━━━━`;
  msg += `\n👉 ลิงก์ดูออเดอร์ในระบบแอดมิน:`;
  msg += `\nhttps://ais-pre-sgegekyar4pyqrjy6gtlkg-975508169959.asia-southeast1.run.app/admin`;

  return msg;
}

// Main processor: Notify an order using data retrieved from Firestore
export async function processOrderLineNotification(orderId: string, fallbackOrderData?: any, customToken?: string): Promise<LineNotifyResult> {
  // 1. Fetch store settings to get token and enabled status
  const settings = await getStoreSettingsFromFirestore();
  const token = customToken || settings?.lineNotifyToken || process.env.LINE_NOTIFY_TOKEN || process.env.VITE_LINE_NOTIFY_TOKEN;
  
  if (!token || !token.trim()) {
    console.log('[LineNotify] No token configured in settings or environment. Skipping notification.');
    return {
      success: false,
      message: 'ยังไม่ได้ตั้งค่า LINE Notify Token ในการตั้งค่าร้านค้า',
    };
  }

  // Check if enabled (defaults to true if token exists)
  if (settings && settings.lineNotifyEnabled === false && !customToken) {
    console.log('[LineNotify] LINE Notify is disabled in store settings.');
    return {
      success: false,
      message: 'ปิดการแจ้งเตือน LINE Notify ไว้ในการตั้งค่าร้านค้า',
    };
  }

  // 2. Retrieve authoritative order details from Firestore
  let order = await getOrderFromFirestore(orderId);
  if (!order && fallbackOrderData) {
    order = fallbackOrderData;
  }

  if (!order) {
    return {
      success: false,
      message: `ไม่พบข้อมูลออเดอร์ #${orderId} ใน Firestore`,
    };
  }

  // 3. Format message and send to LINE
  const message = formatOrderLineMessage(order, settings);
  const result = await sendToLineNotify(token, message);

  // 4. Update Firestore with notification outcome
  if (result.success) {
    await markOrderAsNotifiedInFirestore(orderId, 'sent');
    console.log(`[LineNotify] Successfully notified order #${order.orderNumber || orderId} to LINE`);
  } else {
    await markOrderAsNotifiedInFirestore(orderId, 'failed', result.message);
    console.warn(`[LineNotify] Failed to notify order #${orderId} to LINE:`, result.message);
  }

  return result;
}

// Background poller that periodically checks Firestore for new unnotified orders
let isPollingActive = false;
let pollingInterval: any = null;

export function startLineNotifyBackgroundWorker(intervalMs: number = 30000) {
  if (isPollingActive) return;
  isPollingActive = true;

  console.log(`[LineNotify] Background worker started (polling Firestore every ${intervalMs / 1000}s)`);

  const pollCycle = async () => {
    try {
      const settings = await getStoreSettingsFromFirestore();
      const token = settings?.lineNotifyToken || process.env.LINE_NOTIFY_TOKEN || process.env.VITE_LINE_NOTIFY_TOKEN;

      if (!token || settings?.lineNotifyEnabled === false) {
        return;
      }

      const unnotified = await getUnnotifiedOrdersFromFirestore();
      if (unnotified.length > 0) {
        console.log(`[LineNotify] Found ${unnotified.length} unnotified order(s) in Firestore. Sending notifications...`);
        for (const order of unnotified) {
          try {
            await processOrderLineNotification(order.id, order, token);
          } catch (itemErr) {
            console.warn(`[LineNotify] Error processing order ${order.id}:`, itemErr);
          }
        }
      }
    } catch (cycleErr) {
      console.warn('[LineNotify] Polling cycle error:', cycleErr);
    }
  };

  // Run initial poll after 5 seconds, then recurring
  setTimeout(pollCycle, 5000);
  pollingInterval = setInterval(pollCycle, intervalMs);
}

export function stopLineNotifyBackgroundWorker() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isPollingActive = false;
}
