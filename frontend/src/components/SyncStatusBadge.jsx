import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribeSyncStatus, syncNow } from '../db/syncService';
import { RefreshCw } from 'lucide-react';

export default function SyncStatusBadge() {
  const { t } = useTranslation();
  const [status, setStatus] = useState({ online: navigator.onLine, syncing: false, pendingCount: 0 });

  useEffect(() => subscribeSyncStatus(setStatus), []);

  const color = !status.online
    ? 'bg-[#716B7C]'
    : status.pendingCount > 0
    ? 'bg-[#7652B5] dark:bg-[#A98ADB]'
    : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F7F5FC] dark:bg-[#17151D] border border-[#E8E3EF] dark:border-[#393244]">
        <span className={`h-2 w-2 rounded-full ${color} ${status.online && !status.syncing ? 'animate-pulse' : ''}`} />
        <span className="text-[11px] font-semibold text-[#716B7C] dark:text-[#B8B0C4] leading-none">
          {status.online ? t('sync.online') : t('sync.offline')}
        </span>
      </div>

      {status.pendingCount > 0 && (
        <span className="rounded-full bg-[#EDE7F7] dark:bg-[#2B2536] border border-[#E8E3EF] dark:border-[#393244] text-[#7652B5] dark:text-[#A98ADB] px-2 py-0.5 text-[11px] font-semibold leading-none">
          {t('sync.pending', { count: status.pendingCount })}
        </span>
      )}

      <button
        type="button"
        onClick={() => syncNow({ silent: true })}
        disabled={status.syncing || !status.online}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] text-xs font-semibold text-[#282431] dark:text-[#F5F2F9] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] hover:text-[#7652B5] dark:hover:text-[#A98ADB] hover:border-[#DDD2F0] dark:hover:border-[#482D75] transition-all disabled:opacity-50 shadow-2xs"
      >
        <RefreshCw className={`w-3 h-3 text-[#7652B5] dark:text-[#A98ADB] ${status.syncing ? 'animate-spin' : ''}`} />
        <span>{status.syncing ? t('sync.syncing') : t('sync.sync_now')}</span>
      </button>
    </div>
  );
}
