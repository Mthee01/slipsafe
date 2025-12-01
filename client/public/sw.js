const CACHE_NAME = 'slipsafe-v1';
const RUNTIME_CACHE = 'slipsafe-runtime-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-receipts') {
    event.waitUntil(syncReceipts());
  }
});

async function syncReceipts() {
  const MAX_RETRIES = 3;
  const db = await openDB();
  
  const txRead = db.transaction('pending-uploads', 'readonly');
  const pendingUploads = await new Promise((resolve, reject) => {
    const request = txRead.objectStore('pending-uploads').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  for (const upload of pendingUploads) {
    try {
      // Step 1: Re-upload file to preview endpoint (refreshes server cache)
      const formData = new FormData();
      formData.append('receipt', upload.fileBlob, upload.fileName);
      
      const previewResponse = await fetch('/api/receipts/preview', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!previewResponse.ok) {
        const errorText = await previewResponse.text();
        throw new Error(`Preview failed: ${errorText}`);
      }
      
      // Step 2: Send user-edited metadata to confirm endpoint
      const confirmResponse = await fetch('/api/receipts/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant: upload.merchant,
          date: upload.date,
          total: upload.total,
          category: upload.category,
        }),
        credentials: 'include'
      });
      
      if (confirmResponse.ok) {
        await updateAfterSuccess(db, upload.receiptId, upload.id);
        await notifyClientsOfSync();
      } else {
        const errorText = await confirmResponse.text();
        const retryCount = (upload.retryCount || 0) + 1;
        
        if (retryCount >= MAX_RETRIES || confirmResponse.status === 400) {
          console.error(`Receipt sync failed permanently (${confirmResponse.status}):`, errorText);
          await removeFailedUpload(db, upload.id);
        } else {
          console.warn(`Receipt sync failed (attempt ${retryCount}/${MAX_RETRIES}):`, errorText);
          await updateRetryCount(db, upload.id, retryCount, errorText);
        }
      }
    } catch (error) {
      console.error('Failed to sync receipt:', error);
      const retryCount = (upload.retryCount || 0) + 1;
      if (retryCount >= MAX_RETRIES) {
        console.error('Max retries reached, removing from queue');
        await removeFailedUpload(db, upload.id);
      } else {
        await updateRetryCount(db, upload.id, retryCount, error.message);
      }
    }
  }
}

async function updateAfterSuccess(db, receiptId, uploadId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['receipts', 'pending-uploads'], 'readwrite');
    const receiptsStore = tx.objectStore('receipts');
    const uploadsStore = tx.objectStore('pending-uploads');
    
    const getRequest = receiptsStore.get(receiptId);
    getRequest.onsuccess = () => {
      const receipt = getRequest.result;
      if (receipt) {
        receipt.synced = true;
        receiptsStore.put(receipt);
      }
      uploadsStore.delete(uploadId);
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updateRetryCount(db, uploadId, retryCount, errorMsg) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-uploads', 'readwrite');
    const store = tx.objectStore('pending-uploads');
    
    const getRequest = store.get(uploadId);
    getRequest.onsuccess = () => {
      const upload = getRequest.result;
      if (upload) {
        upload.retryCount = retryCount;
        upload.lastError = errorMsg;
        store.put(upload);
      }
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeFailedUpload(db, uploadId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-uploads', 'readwrite');
    tx.objectStore('pending-uploads').delete(uploadId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function notifyClientsOfSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      message: 'Receipt synced successfully'
    });
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('slipsafe-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-uploads')) {
        db.createObjectStore('pending-uploads', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('receipts')) {
        db.createObjectStore('receipts', { keyPath: 'id' });
      }
    };
  });
}
