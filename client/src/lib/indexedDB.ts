import type { ConfidenceLevel } from "@shared/schema";

const DB_NAME = 'slipsafe-db';
const DB_VERSION = 1;
const RECEIPTS_STORE = 'receipts';
const PENDING_UPLOADS_STORE = 'pending-uploads';

export interface OfflineReceipt {
  id: string;
  merchant: string;
  date: string;
  total: string;
  invoiceNumber?: string | null;
  returnBy: string | null;
  warrantyEnds: string | null;
  imagePath?: string;
  confidence?: ConfidenceLevel;
  createdAt: string;
  synced: boolean;
  refundType?: 'not_specified' | 'full' | 'store_credit' | 'exchange_only' | 'partial' | 'none' | null;
  returnPolicyDays?: number | null;
  warrantyMonths?: number | null;
}

export interface PendingUpload {
  id?: number;
  merchant: string;           // User-edited values (not OCR output)
  date: string;
  total: string;
  invoiceNumber?: string | null;
  category: string;
  receiptId: string;
  fileBlob: Blob;            // Original file for preview re-upload
  fileName: string;           // Original filename for FormData
  retryCount?: number;
  lastError?: string;
  createdAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(RECEIPTS_STORE)) {
        const receiptsStore = db.createObjectStore(RECEIPTS_STORE, { keyPath: 'id' });
        receiptsStore.createIndex('synced', 'synced', { unique: false });
        receiptsStore.createIndex('merchant', 'merchant', { unique: false });
      }

      if (!db.objectStoreNames.contains(PENDING_UPLOADS_STORE)) {
        db.createObjectStore(PENDING_UPLOADS_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function saveReceiptOffline(receipt: OfflineReceipt): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RECEIPTS_STORE], 'readwrite');
    const store = transaction.objectStore(RECEIPTS_STORE);
    const request = store.put(receipt);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineReceipts(): Promise<OfflineReceipt[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RECEIPTS_STORE], 'readonly');
    const store = transaction.objectStore(RECEIPTS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getReceiptById(id: string): Promise<OfflineReceipt | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RECEIPTS_STORE], 'readonly');
    const store = transaction.objectStore(RECEIPTS_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteReceiptOffline(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RECEIPTS_STORE], 'readwrite');
    const store = transaction.objectStore(RECEIPTS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedReceipts(): Promise<OfflineReceipt[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RECEIPTS_STORE], 'readonly');
    const store = transaction.objectStore(RECEIPTS_STORE);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(false));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingUpload(upload: PendingUpload): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_UPLOADS_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_UPLOADS_STORE);
    const request = store.add(upload);

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_UPLOADS_STORE], 'readonly');
    const store = transaction.objectStore(PENDING_UPLOADS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePendingUpload(id: number): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_UPLOADS_STORE], 'readwrite');
    const store = transaction.objectStore(PENDING_UPLOADS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllData(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([RECEIPTS_STORE, PENDING_UPLOADS_STORE], 'readwrite');
    
    const receiptsStore = transaction.objectStore(RECEIPTS_STORE);
    const uploadsStore = transaction.objectStore(PENDING_UPLOADS_STORE);
    
    receiptsStore.clear();
    uploadsStore.clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
