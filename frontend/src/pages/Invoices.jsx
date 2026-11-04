import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../hooks/useAuth';
import { openReceiptWindow } from '../print/receipt';
import {
  FileText,
  Printer,
  RotateCcw,
  Ban,
  Trash2,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

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
  const load = () =>
    api.get('/invoices', { params: { limit: 50 } }).then(({ data }) => setInvoices(data.data));

  useEffect(() => {
    load();
  }, []);

  const cancelInvoice = async (id) => {
    if (!confirm(t('pos.cancel_invoice_confirm'))) return;
    try {
      await api.post(`/invoices/${id}/cancel`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel invoice');
    }
  };

  const reprint = async (id) => {
    try {
      const { data } = await api.get(`/invoices/${id}/print`);
      openReceiptWindow(data.invoice, data.settings);
    } catch (err) {
      alert('Failed to load print preview');
    }
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
      .map(([invoice_item_id, qty]) => ({
        invoice_item_id: Number(invoice_item_id),
        qty: Number(qty),
      }));
    if (items.length === 0) return;
    try {
      await api.post('/sales-returns', { invoice_id: returning.id, items });
      setReturning(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Return failed');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#7652B5] dark:text-[#A98ADB]" />
          {t('invoices.title')}
        </h1>
        <p className="text-xs text-[#716B7C]">Sales receipt logs, customer billing history & thermal printouts</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-[#F7F5FC] dark:bg-[#2B2536] text-left font-semibold text-[#716B7C] dark:text-[#B8B0C4]">
            <tr>
              <th className="px-3.5 py-2.5">{t('invoices.invoice_no')}</th>
              <th className="px-3.5 py-2.5">{t('invoices.customer')}</th>
              <th className="px-3.5 py-2.5">Pricing Type</th>
              <th className="px-3.5 py-2.5">{t('common.status')}</th>
              <th className="px-3.5 py-2.5">{t('invoices.source')}</th>
              <th className="px-3.5 py-2.5 text-right">{t('pos.grand_total')}</th>
              <th className="px-3.5 py-2.5">{t('common.date')}</th>
              <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E3EF] dark:divide-[#393244]">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-[#F7F5FC]/50 dark:hover:bg-[#2B2536]/40 transition-colors">
                <td className="px-3.5 py-2.5 font-mono font-medium">{inv.invoice_no}</td>
                <td className="px-3.5 py-2.5">
                  <div className="font-semibold text-[#282431] dark:text-[#F5F2F9]">
                    {inv.customer_name || t('invoices.walk_in')}
                  </div>
                  {inv.slogan && (
                    <div className="text-[10px] text-[#7652B5] dark:text-[#A98ADB] italic font-mono truncate max-w-xs">
                      "{inv.slogan}"
                    </div>
                  )}
                </td>
                <td className="px-3.5 py-2.5">
                  <span className="capitalize font-medium text-[10px] px-2 py-0.5 rounded bg-[#EDE7F7] dark:bg-[#2B2536] text-[#716B7C] dark:text-[#B8B0C4]">
                    {inv.customer_type || 'Retail'}
                  </span>
                </td>
                <td className="px-3.5 py-2.5">
                  {inv.status === 'cancelled' ? (
                    <span className="inline-flex items-center gap-1 text-red-500 font-semibold bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded text-[10px]">
                      <XCircle className="w-3 h-3" />
                      Cancelled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-[10px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2.5 text-[10px] text-[#716B7C] dark:text-[#B8B0C4] capitalize">{inv.source}</td>
                <td className="px-3.5 py-2.5 text-right font-bold text-[#282431] dark:text-[#F5F2F9]">
                  {formatCurrency(inv.grand_total, currency)}
                </td>
                <td className="px-3.5 py-2.5 text-[#716B7C]">
                  {new Date(inv.created_at).toLocaleString()}
                </td>
                <td className="px-3.5 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => reprint(inv.id)}
                      title="Print Invoice Receipt"
                      className="p-1.5 text-[#7652B5] hover:text-[#5B3B91] dark:text-[#A98ADB] dark:hover:text-[#C0A5EA] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] rounded-lg transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {inv.status === 'completed' && canReturn && (
                      <button
                        onClick={() => openReturn(inv)}
                        title="Sales Return"
                        className="p-1.5 text-[#7652B5] dark:text-[#A98ADB] hover:text-[#5B3B91] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {inv.status === 'completed' && canCancel && (
                      <button
                        onClick={() => cancelInvoice(inv.id)}
                        title="Cancel Invoice"
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[#716B7C] dark:text-[#B8B0C4]">
                  {t('common.no_data')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Return Modal */}
      {returning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#211D2A] p-5 shadow-2xl border border-[#E8E3EF] dark:border-[#393244]">
            <h3 className="mb-2 font-bold text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
              Return Items — Invoice #{returning.invoice_no}
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {returnableItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between p-2 rounded bg-[#F7F5FC] dark:bg-[#2B2536]/60 text-xs">
                  <div>
                    <span className="font-semibold block">{it.product_name_snapshot}</span>
                    <span className="text-[#716B7C] dark:text-[#B8B0C4]">Sold: {it.qty}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={it.qty}
                    value={returnQtys[it.id] || 0}
                    onChange={(e) => setReturnQtys({ ...returnQtys, [it.id]: e.target.value })}
                    className="w-20 rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] px-2.5 py-1 text-xs text-center"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 text-xs">
              <button
                onClick={submitReturn}
                className="flex-1 rounded-lg bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] text-white dark:text-[#17151D] font-bold py-2 shadow-sm"
              >
                Confirm Return
              </button>
              <button
                onClick={() => setReturning(null)}
                className="flex-1 rounded-lg border border-[#E8E3EF] dark:border-[#393244] py-2 hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
