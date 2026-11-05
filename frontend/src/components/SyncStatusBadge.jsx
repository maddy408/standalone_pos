import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribeSyncStatus, syncNow } from '../db/syncService';
import { RefreshCw } from 'lucide-react';

export default function SyncStatusBadge() {
  const { t } = useTranslation();
  const [status, setStatus] = useState({ online: navigator.onLine, syncing: false, pendingCount: 0 });

  useEffect(() => subscribeSyncStatus(setStatus), []);

  const color = !status.online
    ? 'bg-[#5A6B82]'
    : status.pendingCount > 0
    ? 'bg-[#0A4174] dark:bg-[#4A8CD2]'
    : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4F7FB] dark:bg-[#0B131E] border border-[#DCE5EF] dark:border-[#22354B]">
        <span className={`h-2 w-2 rounded-full ${color} ${status.online && !status.syncing ? 'animate-pulse' : ''}`} />
        <span className="text-[11px] font-semibold text-[#5A6B82] dark:text-[#94A3B8] leading-none">
          {status.online ? t('sync.online') : t('sync.offline')}
        </span>
      </div>

      {status.pendingCount > 0 && (
        <span className="rounded-full bg-[#E2EDF8] dark:bg-[#1A2A3D] border border-[#DCE5EF] dark:border-[#22354B] text-[#0A4174] dark:text-[#4A8CD2] px-2 py-0.5 text-[11px] font-semibold leading-none">
          {t('sync.pending', { count: status.pendingCount })}
        </span>
      )}

      <button
        type="button"
        onClick={() => syncNow({ silent: true })}
        disabled={status.syncing || !status.online}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-xs font-semibold text-[#1C2736] dark:text-[#F1F5F9] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:border-[#C5D8ED] dark:hover:border-[#052441] transition-all disabled:opacity-50 shadow-2xs"
      >
        <RefreshCw className={`w-3 h-3 text-[#0A4174] dark:text-[#4A8CD2] ${status.syncing ? 'animate-spin' : ''}`} />
        <span>{status.syncing ? t('sync.syncing') : t('sync.sync_now')}</span>
      </button>
    </div>
  );
}
