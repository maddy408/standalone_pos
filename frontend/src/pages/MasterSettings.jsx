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

  if (!form) return <div className="p-8 text-sm font-medium text-[#5A6B82] dark:text-[#94A3B8]">{t('common.loading')}</div>;

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
      {/* Settings Navigation & Top Actions in One Line */}
      <div className="flex items-center justify-between gap-4 border-b border-[#DCE5EF] dark:border-[#22354B] pb-3">
        {/* Left: Navigation Tabs */}
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs">
            General Settings
          </span>
          <Link
            to="/users"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
          >
            <UsersIcon className="w-3.5 h-3.5" />
            <span>Users & Roles</span>
          </Link>
        </div>

        {/* Right: Manage Users & Roles Button */}
        <div className="flex items-center gap-3">
          <Link
            to="/users"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#121E2C] border border-[#DCE5EF] dark:border-[#22354B] text-[#1C2736] dark:text-[#F1F5F9] text-xs font-bold hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] hover:border-[#0A4174] dark:hover:border-[#4A8CD2] transition-all shadow-xs"
          >
            <UsersIcon className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
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

      {/* Business Type Mode */}
      <section className="rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">
            {t('settings.business_type')}
          </h2>
          <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">
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
                  ? 'border-[#0A4174] bg-[#E2EDF8] text-[#0A4174] dark:border-[#4A8CD2] dark:bg-[#1A2A3D] dark:text-[#4A8CD2] shadow-sm'
                  : 'border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#0B131E] text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#F4F7FB] dark:hover:bg-[#1A2A3D]'
              }`}
            >
              {t(`settings.${bt}`)}
            </button>
          ))}
        </div>
        {confirmSwitch && (
          <div className="mt-3 rounded-xl bg-[#E2EDF8] dark:bg-[#1A2A3D] p-4 text-xs space-y-2 border border-[#DCE5EF] dark:border-[#22354B]">
            <p className="font-medium text-[#1C2736] dark:text-[#F1F5F9]">
              {t('settings.business_switch_confirm', { type: t(`settings.${confirmSwitch}`) })}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={confirmBusinessTypeSwitch}
                className="rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold px-4 py-2 text-xs shadow-sm"
              >
                {t('common.confirm')}
              </button>
              <button
                onClick={() => setConfirmSwitch(null)}
                className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-4 py-2 text-xs font-semibold hover:bg-[#F4F7FB] dark:hover:bg-[#1A2A3D]"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Company Profile */}
      <section className="rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <Building className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
          <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.company_profile')}</h2>
        </div>
        <div className="space-y-3 text-xs">
          {['company_name', 'company_address', 'company_phone', 'company_gstin'].map((field) => (
            <div key={field}>
              <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{t(`settings.${field}`)}</label>
              <input
                value={form[field] || ''}
                onChange={(e) => set(field, e.target.value)}
                className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2 focus:ring-2 focus:ring-[#0A4174]/30 focus:border-[#0A4174] focus:outline-none"
              />
            </div>
          ))}
          <button
            onClick={() => save(form)}
            className="rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold px-5 py-2.5 text-xs shadow-sm transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </section>

      {/* Invoice Settings */}
      <section className="rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <Receipt className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
          <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.invoice_settings')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.invoice_prefix')}</label>
            <input
              value={form.invoice_prefix || ''}
              onChange={(e) => set('invoice_prefix', e.target.value)}
              className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.currency_symbol')}</label>
            <input
              value={form.currency_symbol || ''}
              onChange={(e) => set('currency_symbol', e.target.value)}
              className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.low_stock_threshold')}</label>
            <input
              type="number"
              value={form.low_stock_threshold || 0}
              onChange={(e) => set('low_stock_threshold', e.target.value)}
              className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={() => save(form)}
          className="rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold px-5 py-2.5 text-xs shadow-sm transition-colors"
        >
          {t('common.save')}
        </button>
      </section>

      {/* Language & Theme Configuration */}
      <section className="rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <Globe className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
          <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">
            {t('settings.language')} &amp; {t('settings.theme')}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">Language</label>
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174]"
            >
              <option value="en">English (EN)</option>
              <option value="ta">தமிழ் (TA)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">Color Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174]"
            >
              <option value="light">Light Mode (White + Royal Blue)</option>
              <option value="dark">Dark Mode (Deep Dark + Royal Blue)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Printer & Scanner Setup */}
      <section className="rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <Printer className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
          <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.printer_scanner')}</h2>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.receipt_paper_width')}</label>
            <select
              value={form.receipt_paper_width || '80mm'}
              onChange={(e) => set('receipt_paper_width', e.target.value)}
              className="w-44 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2 focus:ring-1 focus:ring-[#0A4174]"
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
              className="rounded accent-[#0A4174]"
            />
            <span>{t('settings.auto_print')}</span>
          </label>
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.barcode_scanner_mode')}</label>
            <select
              value={form.barcode_scanner_mode || 'keyboard_wedge'}
              onChange={(e) => set('barcode_scanner_mode', e.target.value)}
              className="w-64 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2 focus:ring-1 focus:ring-[#0A4174]"
            >
              <option value="keyboard_wedge">{t('settings.scanner_keyboard')}</option>
              <option value="camera">{t('settings.scanner_camera')}</option>
            </select>
            <p className="mt-1 text-[11px] text-[#5A6B82] dark:text-[#94A3B8]">
              {t('settings.scanner_hint')}
            </p>
          </div>
          <button
            onClick={() => save(form)}
            className="rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold px-5 py-2.5 text-xs shadow-sm transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </section>

      {/* Offline Sync & Outbox */}
      <section className="rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
            <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">{t('settings.offline_sync')}</h2>
          </div>
          <button
            onClick={() => syncNow({ silent: true })}
            disabled={syncStatus?.syncing || !syncStatus?.online}
            className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#0B131E] px-3.5 py-1.5 text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] disabled:opacity-50 transition-colors shadow-sm"
          >
            {syncStatus?.syncing ? t('sync.syncing') : t('sync.sync_now')}
          </button>
        </div>
        <div className="text-xs text-[#5A6B82] dark:text-[#94A3B8]">
          {t('sync.last_synced')}: {syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : t('sync.never')}
        </div>

        {outbox.length === 0 ? (
          <div className="text-xs text-[#5A6B82] dark:text-[#94A3B8] italic">{t('settings.no_queued_changes')}</div>
        ) : (
          <div className="space-y-2">
            {outbox.map((item) => (
              <div
                key={item.client_id}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs ${
                  item.status === 'failed'
                    ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
                    : 'border-[#DCE5EF] dark:border-[#22354B] bg-[#E2EDF8]/60 dark:bg-[#1A2A3D]'
                }`}
              >
                <div>
                  <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9] capitalize">{item.type} &middot; {item.status}</div>
                  <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">{new Date(item.created_at).toLocaleString()}</div>
                  {item.error && <div className="mt-0.5 text-red-500 font-semibold">{item.error}</div>}
                </div>
                <div className="flex gap-2">
                  {item.status === 'failed' && (
                    <button onClick={() => retryItem(item.client_id)} className="text-[#0A4174] dark:text-[#4A8CD2] font-bold hover:underline">{t('common.retry')}</button>
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
