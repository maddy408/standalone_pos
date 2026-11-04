import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribeSyncStatus, syncNow } from '../db/syncService';

export default function SyncStatusBadge() {
  const { t } = useTranslation();
  const [status, setStatus] = useState({ online: navigator.onLine, syncing: false, pendingCount: 0 });

  useEffect(() => subscribeSyncStatus(setStatus), []);

  const color = !status.online ? 'bg-[#716B7C]' : status.pendingCount > 0 ? 'bg-[#7652B5] dark:bg-[#A98ADB]' : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-[#716B7C] dark:text-[#B8B0C4] text-xs font-medium">
          {status.online ? t('sync.online') : t('sync.offline')}
        </span>
      </div>
      {status.pendingCount > 0 && (
        <span className="rounded-full bg-[#EDE7F7] dark:bg-[#2B2536] border border-[#E8E3EF] dark:border-[#393244] text-[#7652B5] dark:text-[#A98ADB] px-2 py-0.5 text-xs font-medium">
          {t('sync.pending', { count: status.pendingCount })}
        </span>
      )}
      <button
        onClick={() => syncNow({ silent: true })}
        disabled={status.syncing || !status.online}
        className="rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] px-2.5 py-1 text-xs font-medium text-[#282431] dark:text-[#F5F2F9] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] hover:text-[#7652B5] dark:hover:text-[#A98ADB] transition-colors disabled:opacity-50"
      >
        {status.syncing ? t('sync.syncing') : t('sync.sync_now')}
      </button>
    </div>
  );
}
