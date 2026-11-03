import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { openReceiptWindow } from '../print/receipt';

export default function Invoices() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { can } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [returning, setReturning] = useState(null);
  const [returnableItems, setReturnableItems] = useState([]);
  const [returnQtys, setReturnQtys] = useState({});
  const currency = settings?.currency_symbol || '₹';
  const canCancel = can('pos.cancel_invoice');
  const canReturn = can('pos.sales_return');

  const load = () => api.get('/invoices', { params: { limit: 50 } }).then(({ data }) => setInvoices(data.data));
  useEffect(() => {
    load();
  }, []);

  const cancelInvoice = async (id) => {
    if (!confirm(t('pos.cancel_invoice_confirm'))) return;
    await api.post(`/invoices/${id}/cancel`);
    load();
  };

  const reprint = async (id) => {
    const { data } = await api.get(`/invoices/${id}/print`);
    openReceiptWindow(data.invoice, data.settings);
  };

  const openReturn = async (invoice) => {
    const { data } = await api.get(`/invoices/${invoice.id}/returnable-items`);
    setReturnableItems(data);
    setReturnQtys(Object.fromEntries(data.map((it) => [it.id, 0])));
    setReturning(invoice);
  };

  const submitReturn = async () => {
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([invoice_item_id, qty]) => ({ invoice_item_id: Number(invoice_item_id), qty: Number(qty) }));
    if (items.length === 0) return;
    await api.post('/sales-returns', { invoice_id: returning.id, items });
    setReturning(null);
    load();
  };

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">{t('invoices.title')}</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left">
            <tr>
              <th className="px-3 py-2">{t('invoices.invoice_no')}</th>
              <th className="px-3 py-2">{t('invoices.customer')}</th>
              <th className="px-3 py-2">{t('common.status')}</th>
              <th className="px-3 py-2">{t('invoices.source')}</th>
              <th className="px-3 py-2 text-right">{t('pos.grand_total')}</th>
              <th className="px-3 py-2">{t('common.date')}</th>
              <th className="px-3 py-2">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2">{inv.invoice_no}</td>
                <td className="px-3 py-2">{inv.customer_name || t('invoices.walk_in')}</td>
                <td className="px-3 py-2">
                  <span className={inv.status === 'cancelled' ? 'text-red-500' : 'text-emerald-600'}>{t(`invoices.status_${inv.status}`)}</span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{t(`sync.${inv.source}`)}</td>
                <td className="px-3 py-2 text-right">{currency}{Number(inv.grand_total).toFixed(2)}</td>
                <td className="px-3 py-2">{new Date(inv.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                  <button onClick={() => reprint(inv.id)} className="text-brand-600 hover:underline">{t('common.print')}</button>
                  {inv.status === 'completed' && canReturn && (
                    <button onClick={() => openReturn(inv)} className="text-amber-600 hover:underline">{t('pos.return')}</button>
                  )}
                  {inv.status === 'completed' && canCancel && (
                    <button onClick={() => cancelInvoice(inv.id)} className="text-red-500 hover:underline">{t('pos.cancel_invoice')}</button>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">{t('common.no_data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {returning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-96 rounded-xl bg-white dark:bg-slate-900 p-4">
            <h3 className="mb-3 font-semibold">{t('invoices.return_title', { no: returning.invoice_no })}</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {returnableItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm">
                  <span>{it.product_name_snapshot}</span>
                  <input
                    type="number"
                    min="0"
                    max={it.qty_returnable}
                    value={returnQtys[it.id] || 0}
                    onChange={(e) => setReturnQtys({ ...returnQtys, [it.id]: e.target.value })}
                    className="w-20 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs"
                  />
                </div>
              ))}
              {returnableItems.length === 0 && <div className="text-sm text-slate-400">{t('invoices.nothing_to_return')}</div>}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={submitReturn} className="flex-1 rounded-md bg-brand-600 py-2 text-white text-sm">{t('common.save')}</button>
              <button onClick={() => setReturning(null)} className="flex-1 rounded-md border py-2 text-sm">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
