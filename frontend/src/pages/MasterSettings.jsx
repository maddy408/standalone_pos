import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../theme/ThemeProvider';
import { changeLanguage } from '../i18n';
import { getAllOutboxItems, retryOutboxItem, discardOutboxItem } from '../db/db';
import { syncNow, subscribeSyncStatus, refreshPendingCount } from '../db/syncService';
import { Settings, Building, Receipt, Globe, Printer, RefreshCw, CheckCircle2, Users as UsersIcon } from 'lucide-react';

const BUSINESS_TYPES = ['mobile', 'furniture', 'food'];

export default function MasterSettings() {
  const { t, i18n } = useTranslation();
  const { settings, update } = useSettings();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(null);
  const [outbox, setOutbox] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);

  const loadOutbox = () => getAllOutboxItems().then(setOutbox);

  useEffect(() => {
    loadOutbox();
    const unsub = subscribeSyncStatus((s) => {
      setSyncStatus(s);
      loadOutbox();
    });
    return unsub;
  }, []);

  const retryItem = async (clientId) => {
    await retryOutboxItem(clientId);
    await refreshPendingCount();
    loadOutbox();
    syncNow({ silent: true });
  };

  const discardItem = async (clientId) => {
    if (!confirm(t('settings.discard_confirm'))) return;
    await discardOutboxItem(clientId);
    await refreshPendingCount();
    loadOutbox();
  };

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  if (!form) return <div className="p-8 text-sm font-medium text-[#716B7C] dark:text-[#B8B0C4]">{t('common.loading')}</div>;

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const save = async (patch) => {
    await update(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBusinessTypeChange = (newType) => {
    if (newType === form.business_type) return;
    setConfirmSwitch(newType);
  };

  const confirmBusinessTypeSwitch = async () => {
    set('business_type', confirmSwitch);
    await save({ business_type: confirmSwitch });
    setConfirmSwitch(null);
  };

  return (
    <div className="w-full space-y-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#282431] dark:text-[#F5F2F9] tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#7652B5] dark:text-[#A98ADB]" />
            {t('settings.title')}
          </h1>
          <p className="text-xs text-[#716B7C] dark:text-[#B8B0C4] mt-0.5">
            Configure enterprise parameters, printer connectors & appearance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/users"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#211D2A] border border-[#E8E3EF] dark:border-[#393244] text-[#282431] dark:text-[#F5F2F9] text-xs font-bold hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] hover:border-[#7652B5] dark:hover:border-[#A98ADB] transition-all shadow-xs"
          >
            <UsersIcon className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
            <span>Manage Users & Roles</span>
          </Link>

          {saved && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('settings.saved')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8E3EF] dark:border-[#393244] pb-2">
        <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#7652B5] text-white dark:bg-[#A98ADB] dark:text-[#17151D] shadow-xs">
          General Settings
        </span>
        <Link
          to="/users"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#7652B5] dark:hover:text-[#A98ADB] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] transition-colors"
        >
          <UsersIcon className="w-3.5 h-3.5" />
          <span>Users & Roles</span>
        </Link>
      </div>

      {/* Business Type Mode */}
      <section className="rounded-2xl bg-white dark:bg-[#211D2A] p-6 shadow-sm border border-[#E8E3EF] dark:border-[#393244] space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">
            {t('settings.business_type')}
          </h2>
          <p className="text-xs text-[#716B7C] dark:text-[#B8B0C4] mt-0.5">
            Select standard business vertical profile
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {BUSINESS_TYPES.map((bt) => (
            <button
              key={bt}
              onClick={() => handleBusinessTypeChange(bt)}
              className={`rounded-xl border px-4 py-3 text-xs font-bold transition-all ${
                form.business_type === bt
                  ? 'border-[#7652B5] bg-[#EDE7F7] text-[#7652B5] dark:border-[#A98ADB] dark:bg-[#2B2536] dark:text-[#A98ADB] shadow-sm'
                  : 'border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#17151D] text-[#716B7C] dark:text-[#B8B0C4] hover:bg-[#F7F5FC] dark:hover:bg-[#2B2536]'
              }`}
            >
              {t(`settings.${bt}`)}
            </button>
          ))}
        </div>
        {confirmSwitch && (
          <div className="mt-3 rounded-xl bg-[#EDE7F7] dark:bg-[#2B2536] p-4 text-xs space-y-2 border border-[#E8E3EF] dark:border-[#393244]">
            <p className="font-medium text-[#282431] dark:text-[#F5F2F9]">
              {t('settings.business_switch_confirm', { type: t(`settings.${confirmSwitch}`) })}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={confirmBusinessTypeSwitch}
                className="rounded-xl bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] text-white dark:text-[#17151D] font-bold px-4 py-2 text-xs shadow-sm"
              >
                {t('common.confirm')}
              </button>
              <button
                onClick={() => setConfirmSwitch(null)}
                className="rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-4 py-2 text-xs font-semibold hover:bg-[#F7F5FC] dark:hover:bg-[#2B2536]"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Company Profile */}
      <section className="rounded-2xl bg-white dark:bg-[#211D2A] p-6 shadow-sm border border-[#E8E3EF] dark:border-[#393244] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
          <Building className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
          <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">{t('settings.company_profile')}</h2>
        </div>
        <div className="space-y-3 text-xs">
          {['company_name', 'company_address', 'company_phone', 'company_gstin'].map((field) => (
            <div key={field}>
              <label className="mb-1 block font-semibold text-[#282431] dark:text-[#F5F2F9]">{t(`settings.${field}`)}</label>
              <input
                value={form[field] || ''}
                onChange={(e) => set(field, e.target.value)}
                className="w-full rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2 focus:ring-2 focus:ring-[#7652B5]/30 focus:border-[#7652B5] focus:outline-none"
              />
            </div>
          ))}
          <button
            onClick={() => save(form)}
            className="rounded-xl bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] text-white dark:text-[#17151D] font-bold px-5 py-2.5 text-xs shadow-sm transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </section>

      {/* Invoice Settings */}
      <section className="rounded-2xl bg-white dark:bg-[#211D2A] p-6 shadow-sm border border-[#E8E3EF] dark:border-[#393244] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
          <Receipt className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
          <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">{t('settings.invoice_settings')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#F5F2F9]">{t('settings.invoice_prefix')}</label>
            <input
              value={form.invoice_prefix || ''}
              onChange={(e) => set('invoice_prefix', e.target.value)}
              className="w-full rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2 focus:ring-1 focus:ring-[#7652B5] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#F5F2F9]">{t('settings.currency_symbol')}</label>
            <input
              value={form.currency_symbol || ''}
              onChange={(e) => set('currency_symbol', e.target.value)}
              className="w-full rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2 focus:ring-1 focus:ring-[#7652B5] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#F5F2F9]">{t('settings.low_stock_threshold')}</label>
            <input
              type="number"
              value={form.low_stock_threshold || 0}
              onChange={(e) => set('low_stock_threshold', e.target.value)}
              className="w-full rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2 focus:ring-1 focus:ring-[#7652B5] focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={() => save(form)}
          className="rounded-xl bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] text-white dark:text-[#17151D] font-bold px-5 py-2.5 text-xs shadow-sm transition-colors"
        >
          {t('common.save')}
        </button>
      </section>

      {/* Language & Theme Configuration */}
      <section className="rounded-2xl bg-white dark:bg-[#211D2A] p-6 shadow-sm border border-[#E8E3EF] dark:border-[#393244] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
          <Globe className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
          <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">
            {t('settings.language')} &amp; {t('settings.theme')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#F5F2F9]">Language</label>
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="w-full rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2.5 focus:ring-1 focus:ring-[#7652B5]"
            >
              <option value="en">English (EN)</option>
              <option value="ta">தமிழ் (TA)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#F5F2F9]">Color Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2.5 focus:ring-1 focus:ring-[#7652B5]"
            >
              <option value="light">Light Mode (White + Soft Royal Purple)</option>
              <option value="dark">Dark Mode (Deep Dark + Soft Purple)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Printer & Scanner Setup */}
      <section className="rounded-2xl bg-white dark:bg-[#211D2A] p-6 shadow-sm border border-[#E8E3EF] dark:border-[#393244] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
          <Printer className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
          <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">{t('settings.printer_scanner')}</h2>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#F5F2F9]">{t('settings.receipt_paper_width')}</label>
            <select
              value={form.receipt_paper_width || '80mm'}
              onChange={(e) => set('receipt_paper_width', e.target.value)}
              className="w-44 rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2 focus:ring-1 focus:ring-[#7652B5]"
            >
              <option value="58mm">{t('settings.paper_58mm')}</option>
              <option value="80mm">{t('settings.paper_80mm')}</option>
              <option value="a5">{t('settings.paper_a5')}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={!!Number(form.auto_print_on_sale)}
              onChange={(e) => set('auto_print_on_sale', e.target.checked ? 1 : 0)}
              className="rounded accent-[#7652B5]"
            />
            <span>{t('settings.auto_print')}</span>
          </label>
          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#F5F2F9]">{t('settings.barcode_scanner_mode')}</label>
            <select
              value={form.barcode_scanner_mode || 'keyboard_wedge'}
              onChange={(e) => set('barcode_scanner_mode', e.target.value)}
              className="w-64 rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-3.5 py-2 focus:ring-1 focus:ring-[#7652B5]"
            >
              <option value="keyboard_wedge">{t('settings.scanner_keyboard')}</option>
              <option value="camera">{t('settings.scanner_camera')}</option>
            </select>
            <p className="mt-1 text-[11px] text-[#716B7C] dark:text-[#B8B0C4]">
              {t('settings.scanner_hint')}
            </p>
          </div>
          <button
            onClick={() => save(form)}
            className="rounded-xl bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] text-white dark:text-[#17151D] font-bold px-5 py-2.5 text-xs shadow-sm transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </section>

      {/* Offline Sync & Outbox */}
      <section className="rounded-2xl bg-white dark:bg-[#211D2A] p-6 shadow-sm border border-[#E8E3EF] dark:border-[#393244] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
            <h2 className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9]">{t('settings.offline_sync')}</h2>
          </div>
          <button
            onClick={() => syncNow({ silent: true })}
            disabled={syncStatus?.syncing || !syncStatus?.online}
            className="rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#17151D] px-3.5 py-1.5 text-xs font-bold text-[#7652B5] dark:text-[#A98ADB] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] disabled:opacity-50 transition-colors shadow-sm"
          >
            {syncStatus?.syncing ? t('sync.syncing') : t('sync.sync_now')}
          </button>
        </div>
        <div className="text-xs text-[#716B7C] dark:text-[#B8B0C4]">
          {t('sync.last_synced')}: {syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : t('sync.never')}
        </div>

        {outbox.length === 0 ? (
          <div className="text-xs text-[#716B7C] dark:text-[#B8B0C4] italic">{t('settings.no_queued_changes')}</div>
        ) : (
          <div className="space-y-2">
            {outbox.map((item) => (
              <div
                key={item.client_id}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs ${
                  item.status === 'failed'
                    ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
                    : 'border-[#E8E3EF] dark:border-[#393244] bg-[#EDE7F7]/60 dark:bg-[#2B2536]'
                }`}
              >
                <div>
                  <div className="font-bold text-[#282431] dark:text-[#F5F2F9] capitalize">{item.type} &middot; {item.status}</div>
                  <div className="text-[10px] text-[#716B7C] dark:text-[#B8B0C4]">{new Date(item.created_at).toLocaleString()}</div>
                  {item.error && <div className="mt-0.5 text-red-500 font-semibold">{item.error}</div>}
                </div>
                <div className="flex gap-2">
                  {item.status === 'failed' && (
                    <button onClick={() => retryItem(item.client_id)} className="text-[#7652B5] dark:text-[#A98ADB] font-bold hover:underline">{t('common.retry')}</button>
                  )}
                  <button onClick={() => discardItem(item.client_id)} className="text-red-500 font-bold hover:underline">{t('common.discard')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
