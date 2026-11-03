import api from '../config/api';
import {
  getPendingOutboxItems,
  markOutboxApplied,
  markOutboxFailed,
  cacheProducts,
  cacheCustomers,
  cacheSettings,
  getLastSyncTime,
  setLastSyncTime,
  countPendingOutbox,
} from './db';

const listeners = new Set();
let state = {
  online: navigator.onLine,
  syncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  lastError: null,
};

function notify() {
  listeners.forEach((fn) => fn({ ...state }));
}

export function subscribeSyncStatus(fn) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

async function refreshPendingCount() {
  state.pendingCount = await countPendingOutbox();
  notify();
}

/** Pushes every queued offline write to the server in one batch call. */
async function pushOutbox() {
  const items = await getPendingOutboxItems();
  if (items.length === 0) return;

  const operations = items.map((i) => ({ client_id: i.client_id, type: i.type, payload: i.payload }));

  try {
    const { data } = await api.post('/sync/push', { operations });
    for (const result of data.results) {
      if (result.status === 'applied') {
        await markOutboxApplied(result.client_id);
      } else {
        await markOutboxFailed(result.client_id, result.error || 'Sync failed');
      }
    }
  } catch (err) {
    // Network/server failure — leave items queued, they retry next cycle.
    for (const item of items) {
      await markOutboxFailed(item.client_id, err.message || 'Network error');
    }
    throw err;
  }
}

/** Pulls product/customer/settings deltas created since the last successful sync. */
async function pullDeltas() {
  const since = (await getLastSyncTime()) || '1970-01-01T00:00:00Z';
  const { data } = await api.get('/sync/pull', { params: { since } });
  if (data.products?.length) await cacheProducts(data.products);
  if (data.customers?.length) await cacheCustomers(data.customers);
  if (data.settings) await cacheSettings(data.settings);
  await setLastSyncTime(data.server_time);
  state.lastSyncAt = data.server_time;
}

export async function syncNow({ silent = false } = {}) {
  if (!navigator.onLine) {
    state.lastError = 'Offline — cannot sync right now';
    notify();
    return { ok: false, reason: 'offline' };
  }
  if (state.syncing) return { ok: false, reason: 'already-syncing' };

  state.syncing = true;
  state.lastError = null;
  notify();

  try {
    await pushOutbox();
    await pullDeltas();
    await refreshPendingCount();
    state.syncing = false;
    notify();
    return { ok: true };
  } catch (err) {
    state.syncing = false;
    state.lastError = err.message || 'Sync failed';
    await refreshPendingCount();
    notify();
    if (!silent) throw err;
    return { ok: false, reason: state.lastError };
  }
}

let autoSyncTimer = null;

export function initSyncEngine() {
  window.addEventListener('online', () => {
    state.online = true;
    notify();
    syncNow({ silent: true });
  });
  window.addEventListener('offline', () => {
    state.online = false;
    notify();
  });

  refreshPendingCount();
  getLastSyncTime().then((t) => {
    state.lastSyncAt = t;
    notify();
  });

  if (navigator.onLine) {
    syncNow({ silent: true });
  }

  // Fallback periodic sync every 60s in case the online event is missed.
  if (!autoSyncTimer) {
    autoSyncTimer = setInterval(() => {
      if (navigator.onLine) syncNow({ silent: true });
    }, 60000);
  }
}

export { refreshPendingCount };
