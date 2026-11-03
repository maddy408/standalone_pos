import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../theme/ThemeProvider';
import { changeLanguage } from '../i18n';
import { getAllOutboxItems, retryOutboxItem, discardOutboxItem } from '../db/db';
import { syncNow, subscribeSyncStatus, refreshPendingCount } from '../db/syncService';

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

  if (!form) return <div>{t('common.loading')}</div>;

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const save = async (patch) => {
    await update(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBusinessTypeChange = (newType) => {
    if (newType === form.business_type) return;
    // Switching never deletes existing products of the previous type — they
    // simply stop appearing in the (now-filtered) Product Creation list for
    // the new type, so historical data and past invoices stay intact.
    setConfirmSwitch(newType);
  };

  const confirmBusinessTypeSwitch = async () => {
    set('business_type', confirmSwitch);
    await save({ business_type: confirmSwitch });
    setConfirmSwitch(null);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">{t('settings.title')}</h1>

      <section className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="mb-3 font-semibold">{t('settings.business_type')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {BUSINESS_TYPES.map((bt) => (
            <button
              key={bt}
              onClick={() => handleBusinessTypeChange(bt)}
              className={`rounded-lg border px-3 py-3 text-sm font-medium ${
                form.business_type === bt
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              {t(`settings.${bt}`)}
            </button>
          ))}
        </div>
        {confirmSwitch && (
          <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-900/30 p-3 text-sm">
            <p className="mb-2">
              {t('settings.business_switch_confirm', { type: t(`settings.${confirmSwitch}`) })}
            </p>
            <div className="flex gap-2">
              <button onClick={confirmBusinessTypeSwitch} className="rounded-md bg-brand-600 px-3 py-1 text-white text-xs">
                {t('common.confirm')}
              </button>
              <button onClick={() => setConfirmSwitch(null)} className="rounded-md border px-3 py-1 text-xs">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="font-semibold">{t('settings.company_profile')}</h2>
        {['company_name', 'company_address', 'company_phone', 'company_gstin'].map((field) => (
          <div key={field}>
            <label className="mb-1 block text-sm font-medium">{t(`settings.${field}`)}</label>
            <input
              value={form[field] || ''}
              onChange={(e) => set(field, e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
            />
          </div>
        ))}
        <button onClick={() => save(form)} className="rounded-md bg-brand-600 px-4 py-2 text-white text-sm">
          {t('common.save')}
        </button>
        {saved && <span className="ml-3 text-sm text-emerald-600">{t('settings.saved')}</span>}
      </section>

      <section className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="font-semibold">{t('settings.invoice_settings')}</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('settings.invoice_prefix')}</label>
          <input
            value={form.invoice_prefix || ''}
            onChange={(e) => set('invoice_prefix', e.target.value)}
            className="w-40 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('settings.currency_symbol')}</label>
          <input
            value={form.currency_symbol || ''}
            onChange={(e) => set('currency_symbol', e.target.value)}
            className="w-24 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('settings.low_stock_threshold')}</label>
          <input
            type="number"
            value={form.low_stock_threshold || 0}
            onChange={(e) => set('low_stock_threshold', e.target.value)}
            className="w-32 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          />
        </div>
        <button onClick={() => save(form)} className="rounded-md bg-brand-600 px-4 py-2 text-white text-sm">
          {t('common.save')}
        </button>
      </section>

      <section className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="font-semibold">{t('settings.language')} &amp; {t('settings.theme')}</h2>
        <div className="flex gap-4">
          <select
            value={i18n.language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          >
            <option value="en">English</option>
            <option value="ta">தமிழ்</option>
          </select>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          >
            <option value="light">{t('settings.light')}</option>
            <option value="dark">{t('settings.dark')}</option>
          </select>
        </div>
      </section>

      <section className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="font-semibold">{t('settings.printer_scanner')}</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('settings.receipt_paper_width')}</label>
          <select
            value={form.receipt_paper_width || '80mm'}
            onChange={(e) => set('receipt_paper_width', e.target.value)}
            className="w-40 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          >
            <option value="58mm">{t('settings.paper_58mm')}</option>
            <option value="80mm">{t('settings.paper_80mm')}</option>
            <option value="a5">{t('settings.paper_a5')}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!Number(form.auto_print_on_sale)}
            onChange={(e) => set('auto_print_on_sale', e.target.checked ? 1 : 0)}
          />
          {t('settings.auto_print')}
        </label>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('settings.barcode_scanner_mode')}</label>
          <select
            value={form.barcode_scanner_mode || 'keyboard_wedge'}
            onChange={(e) => set('barcode_scanner_mode', e.target.value)}
            className="w-56 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          >
            <option value="keyboard_wedge">{t('settings.scanner_keyboard')}</option>
            <option value="camera">{t('settings.scanner_camera')}</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">
            {t('settings.scanner_hint')}
          </p>
        </div>
        <button onClick={() => save(form)} className="rounded-md bg-brand-600 px-4 py-2 text-white text-sm">
          {t('common.save')}
        </button>
      </section>

      <section className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('settings.offline_sync')}</h2>
          <button
            onClick={() => syncNow({ silent: true })}
            disabled={syncStatus?.syncing || !syncStatus?.online}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            {syncStatus?.syncing ? t('sync.syncing') : t('sync.sync_now')}
          </button>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t('sync.last_synced')}: {syncStatus?.lastSyncAt ? new Date(syncStatus.lastSyncAt).toLocaleString() : t('sync.never')}
        </div>

        {outbox.length === 0 ? (
          <div className="text-sm text-slate-400">{t('settings.no_queued_changes')}</div>
        ) : (
          <div className="space-y-1">
            {outbox.map((item) => (
              <div
                key={item.client_id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
                  item.status === 'failed'
                    ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                    : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                }`}
              >
                <div>
                  <div className="font-medium capitalize">{item.type} &middot; {item.status}</div>
                  <div className="text-slate-400">{new Date(item.created_at).toLocaleString()}</div>
                  {item.error && <div className="mt-0.5 text-red-500">{item.error}</div>}
                </div>
                <div className="flex gap-2">
                  {item.status === 'failed' && (
                    <button onClick={() => retryItem(item.client_id)} className="text-brand-600 hover:underline">{t('common.retry')}</button>
                  )}
                  <button onClick={() => discardItem(item.client_id)} className="text-red-500 hover:underline">{t('common.discard')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
