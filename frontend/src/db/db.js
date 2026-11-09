import { openDB } from 'idb';

const DB_NAME = 'universal_pos_offline';
const DB_VERSION = 2;

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const products = db.createObjectStore('products', { keyPath: 'id' });
          products.createIndex('barcode', 'barcode');
          products.createIndex('business_type', 'business_type');

          db.createObjectStore('customers', { keyPath: 'id' });

          const outbox = db.createObjectStore('outbox', { keyPath: 'client_id' });
          outbox.createIndex('status', 'status');
          outbox.createIndex('created_at', 'created_at');

          db.createObjectStore('held_bills_local', { keyPath: 'uuid' });
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('categories')) {
            db.createObjectStore('categories', { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
}

// --- Categories cache -------------------------------------------------

export async function cacheCategories(categories) {
  const db = await getDb();
  const tx = db.transaction('categories', 'readwrite');
  for (const c of categories) {
    await tx.store.put(c);
  }
  await tx.done;
}

export async function getCachedCategories() {
  const db = await getDb();
  return db.getAll('categories');
}

// --- Products cache ---------------------------------------------------

export async function cacheProducts(products) {
  const db = await getDb();
  const tx = db.transaction('products', 'readwrite');
  for (const p of products) {
    await tx.store.put(p);
  }
  await tx.done;
}

export async function getCachedProducts() {
  const db = await getDb();
  return db.getAll('products');
}

export async function searchCachedProducts(term) {
  const all = await getCachedProducts();
  const t = term.trim().toLowerCase();
  if (!t) return all;
  return all.filter(
    (p) =>
      p.name?.toLowerCase().includes(t) ||
      p.barcode?.toLowerCase() === t ||
      p.sku?.toLowerCase() === t
  );
}

export async function applyLocalStockDelta(productId, qtyDelta) {
  const db = await getDb();
  const product = await db.get('products', productId);
  if (!product) return;
  product.stock_qty = Number(product.stock_qty || 0) + qtyDelta;
  await db.put('products', product);
}

// --- Customers cache ---------------------------------------------------

export async function cacheCustomers(customers) {
  const db = await getDb();
  const tx = db.transaction('customers', 'readwrite');
  for (const c of customers) {
    await tx.store.put(c);
  }
  await tx.done;
}

export async function getCachedCustomers() {
  const db = await getDb();
  return db.getAll('customers');
}

export async function addLocalCustomer(customer) {
  const db = await getDb();
  await db.put('customers', customer);
}

// --- Settings / meta cache ---------------------------------------------

export async function cacheSettings(settings) {
  const db = await getDb();
  await db.put('meta', { key: 'settings', value: settings });
}

export async function getCachedSettings() {
  const db = await getDb();
  const row = await db.get('meta', 'settings');
  return row?.value ?? null;
}

export async function getLastSyncTime() {
  const db = await getDb();
  const row = await db.get('meta', 'last_sync_time');
  return row?.value ?? null;
}

export async function setLastSyncTime(iso) {
  const db = await getDb();
  await db.put('meta', { key: 'last_sync_time', value: iso });
}

// --- Outbox (offline write queue) --------------------------------------

export async function enqueueOutboxItem(item) {
  const db = await getDb();
  const record = {
    client_id: item.client_id,
    type: item.type,
    payload: item.payload,
    status: 'pending',
    retries: 0,
    error: null,
    created_at: new Date().toISOString(),
  };
  await db.put('outbox', record);
  return record;
}

export async function getPendingOutboxItems() {
  const db = await getDb();
  const all = await db.getAll('outbox');
  return all
    .filter((i) => i.status === 'pending' || i.status === 'failed')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function getAllOutboxItems() {
  const db = await getDb();
  return db.getAll('outbox');
}

export async function markOutboxApplied(clientId) {
  const db = await getDb();
  await db.delete('outbox', clientId);
}

export async function markOutboxFailed(clientId, error) {
  const db = await getDb();
  const item = await db.get('outbox', clientId);
  if (!item) return;
  item.status = 'failed';
  item.retries = (item.retries || 0) + 1;
  item.error = error;
  item.last_attempt_at = new Date().toISOString();
  await db.put('outbox', item);
}

export async function countPendingOutbox() {
  const items = await getPendingOutboxItems();
  return items.length;
}

/** Resets a failed item back to pending so the next sync cycle retries it. */
export async function retryOutboxItem(clientId) {
  const db = await getDb();
  const item = await db.get('outbox', clientId);
  if (!item) return;
  item.status = 'pending';
  await db.put('outbox', item);
}

/** Permanently discards a queued write — used when staff decide a failed item should not be retried. */
export async function discardOutboxItem(clientId) {
  const db = await getDb();
  await db.delete('outbox', clientId);
}

// --- Held bills kept locally while offline ------------------------------

export async function saveLocalHeldBill(bill) {
  const db = await getDb();
  await db.put('held_bills_local', bill);
}

export async function getLocalHeldBills() {
  const db = await getDb();
  return db.getAll('held_bills_local');
}

export async function removeLocalHeldBill(uuid) {
  const db = await getDb();
  await db.delete('held_bills_local', uuid);
}

export function newUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
