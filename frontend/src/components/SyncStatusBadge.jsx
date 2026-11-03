import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribeSyncStatus, syncNow } from '../db/syncService';

export default function SyncStatusBadge() {
  const { t } = useTranslation();
  const [status, setStatus] = useState({ online: navigator.onLine, syncing: false, pendingCount: 0 });

  useEffect(() => subscribeSyncStatus(setStatus), []);

  const color = !status.online ? 'bg-slate-400' : status.pendingCount > 0 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-slate-600 dark:text-slate-300">
          {status.online ? t('sync.online') : t('sync.offline')}
        </span>
      </div>
      {status.pendingCount > 0 && (
        <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
          {t('sync.pending', { count: status.pendingCount })}
        </span>
      )}
      <button
        onClick={() => syncNow({ silent: true })}
        disabled={status.syncing || !status.online}
        className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        {status.syncing ? t('sync.syncing') : t('sync.sync_now')}
      </button>
    </div>
  );
}
