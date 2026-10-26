/**
 * Firebase Client Initialization & Utilities
 * Connected to Firebase Firestore, Authentication, and Storage
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { compressImage } from './utils/imageCompressor';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Initialize Firestore with explicit database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection validated successfully.');
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Please check your network and Firebase configuration.');
      return false;
    }
    // "not-found" or normal permission response still means connected to Firestore endpoint
    return true;
  }
}

// Upload file to Firebase Storage with ultra-fast compressed base64 fallback for resilient image handling
export async function uploadImageFile(file: File, folder: 'products' | 'slips' | 'delivery_proofs' | 'covers' = 'slips'): Promise<string> {
  // 1. Immediately compress client-side to ensure lightweight size (< 80KB) and instant processing
  let compressedDataUrl = '';
  try {
    const result = await compressImage(file, 800, 800, 0.8);
    compressedDataUrl = result.dataUrl;
  } catch (compErr) {
    console.warn('Compression fallback used:', compErr);
  }

  const filename = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  // 2. Try Firebase Storage with a strict 2-second timeout
  try {
    const storageRef = ref(storage, filename);
    const uploadPromise = uploadBytes(storageRef, file).then((snapshot) =>
      getDownloadURL(snapshot.ref)
    );

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Storage timeout - switching to optimized local image')), 2000)
    );

    const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
    return downloadUrl;
  } catch {
    // If Storage is not provisioned or takes too long, return the compressed image directly
    if (compressedDataUrl) {
      return compressedDataUrl;
    }

    // Ultimate fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
      reader.readAsDataURL(file);
    });
  }
}

// Dedicated high-resolution banner compressor and uploader for Cover Images
export async function uploadCoverImage(file: File): Promise<string> {
  let compressedDataUrl = '';
  try {
    const { compressImage } = await import('./utils/imageCompressor');
    // Wide aspect ratio for store cover banner (1200 x 600 at 0.85 quality)
    const result = await compressImage(file, 1200, 600, 0.85);
    compressedDataUrl = result.dataUrl;
  } catch (compErr) {
    console.warn('Cover compression fallback used:', compErr);
  }

  const filename = `covers/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  try {
    const storageRef = ref(storage, filename);
    const uploadPromise = uploadBytes(storageRef, file).then((snapshot) =>
      getDownloadURL(snapshot.ref)
    );

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Storage timeout - using optimized banner')), 2000)
    );

    const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
    return downloadUrl;
  } catch {
    if (compressedDataUrl) {
      return compressedDataUrl;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
      reader.readAsDataURL(file);
    });
  }
}

// Deep recursive sanitizer to guarantee no undefined values ever reach Firestore
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = cleanFirestoreData(value);
      }
    }
    return clean as any;
  }
  return obj;
}

// Upload multiple image files concurrently
export async function uploadMultipleImageFiles(files: File[], folder: 'products' = 'products'): Promise<string[]> {
  const uploadPromises = files.map((file) => uploadImageFile(file, folder));
  return Promise.all(uploadPromises);
}

// Real-time stock transaction deduction
export async function placeOrderWithAtomicStockDeduction(orderData: any): Promise<string> {
  const orderId = doc(collection(db, 'orders')).id;
  orderData.id = orderId;
  orderData.createdAt = new Date().toISOString();
  orderData.updatedAt = new Date().toISOString();

  // Thoroughly sanitize payload so Firestore transaction never encounters 'undefined'
  const cleanOrder = cleanFirestoreData(orderData);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Fetch current product documents within transaction
      const productSnaps = await Promise.all(
        cleanOrder.items.map((item: any) => transaction.get(doc(db, 'products', item.productId)))
      );

      // 2. Validate stock availability for each item
      for (let i = 0; i < cleanOrder.items.length; i++) {
        const item = cleanOrder.items[i];
        const snap = productSnaps[i];
        if (!snap.exists()) {
          throw new Error(`ไม่พบสินค้า "${item.name}" ในระบบร้านค้า`);
        }
        const data = snap.data();
        const availableStock = Number(data.stock ?? 0);
        if (availableStock < item.quantity) {
          throw new Error(
            `สินค้า "${item.name}" สต็อกไม่เพียงพอ (เหลือ ${availableStock} ${item.unit || 'ชิ้น'}, สั่งซื้อ ${item.quantity} ${item.unit || 'ชิ้น'})`
          );
        }
      }

      // 3. Atomically deduct stock
      for (let i = 0; i < cleanOrder.items.length; i++) {
        const item = cleanOrder.items[i];
        const snap = productSnaps[i];
        const currentStock = Number(snap.data()?.stock ?? 0);
        const newStock = currentStock - item.quantity;
        transaction.update(doc(db, 'products', item.productId), {
          stock: newStock,
          updatedAt: new Date().toISOString(),
        });
      }

      // 4. Record new order with sanitized data
      transaction.set(doc(db, 'orders', orderId), cleanOrder);
    });

    return orderId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
  }
}

// Cancel order and atomically restore product stock
export async function cancelOrderWithAtomicStockRestore(orderId: string, reason: string = 'ลูกค้ายกเลิก'): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists()) {
        throw new Error('ไม่พบคำสั่งซื้อนี้');
      }

      const orderData = orderSnap.data();
      if (orderData.status === 'cancelled') {
        throw new Error('คำสั่งซื้อนี้ถูกยกเลิกแล้ว');
      }

      // Restore stock for all items
      if (Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          if (item.productId) {
            const prodRef = doc(db, 'products', item.productId);
            const prodSnap = await transaction.get(prodRef);
            if (prodSnap.exists()) {
              const currentStock = Number(prodSnap.data()?.stock ?? 0);
              transaction.update(prodRef, {
                stock: currentStock + Number(item.quantity || 1),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      }

      transaction.update(orderRef, {
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
  }
}

// Update order status with timestamp
export async function updateOrderStatus(orderId: string, status: string, additionalData: Record<string, any> = {}): Promise<void> {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status,
      ...additionalData,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
  }
}
