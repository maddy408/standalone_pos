import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../hooks/useAuth';
import { openReceiptWindow } from '../print/receipt';
import InvoicePreviewModal from '../components/InvoicePreviewModal';
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
  Clock,
  Search,
  Eye,
  Edit2,
  Filter,
} from 'lucide-react';

export default function Invoices() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { can } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [returning, setReturning] = useState(null);
  const [returnableItems, setReturnableItems] = useState([]);
  const [returnQtys, setReturnQtys] = useState({});
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);

  const currency = settings?.currency_symbol || '₹';
  const canCancel = can('pos.cancel_invoice');
  const canReturn = can('pos.sales_return');

  const load = () => {
    const params = {
      limit: 100,
      search: search || undefined,
      customer_id: filterCustomer || undefined,
      from: filterFrom || undefined,
      to: filterTo || undefined,
    };
    api.get('/invoices', { params }).then(({ data }) => {
      const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setInvoices(list);
    });
  };

  useEffect(() => {
    load();
  }, [search, filterCustomer, filterFrom, filterTo]);

  useEffect(() => {
    api.get('/customers').then(({ data }) => setCustomers(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/products').then(({ data }) => setAvailableProducts(Array.isArray(data) ? data : [])).catch(() => {});
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
      setPreviewInvoice(data.invoice);
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
            {t('invoices.title')}
          </h1>
          <p className="text-xs text-[#5A6B82]">Sales receipt logs, customer billing history & thermal printouts</p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm flex flex-wrap items-center gap-2.5 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#5A6B82] dark:text-[#94A3B8] absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice # or customer name..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
          />
        </div>

        <select
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
        >
          <option value="">All Customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 text-[#5A6B82]">
          <span>From:</span>
          <input
            type="date"
            value={filterFrom}
            max={filterTo || undefined}
            onChange={(e) => {
              const newFrom = e.target.value;
              setFilterFrom(newFrom);
              if (filterTo && newFrom > filterTo) {
                setFilterTo(newFrom);
              }
            }}
            className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
          />
          <span>To:</span>
          <input
            type="date"
            value={filterTo}
            min={filterFrom || undefined}
            onChange={(e) => {
              const newTo = e.target.value;
              if (filterFrom && newTo < filterFrom) {
                return;
              }
              setFilterTo(newTo);
            }}
            className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
          />
        </div>

        {(search || filterCustomer || filterFrom || filterTo) && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilterCustomer('');
              setFilterFrom('');
              setFilterTo('');
            }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-[#5A6B82] hover:text-[#1C2736]"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
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
          <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/40 transition-colors">
                <td className="px-3.5 py-2.5 font-mono font-medium">{inv.invoice_no}</td>
                <td className="px-3.5 py-2.5">
                  <div className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    {inv.customer_name || t('invoices.walk_in')}
                  </div>
                  {inv.slogan && (
                    <div className="text-[10px] text-[#0A4174] dark:text-[#4A8CD2] italic font-mono truncate max-w-xs">
                      "{inv.slogan}"
                    </div>
                  )}
                </td>
                <td className="px-3.5 py-2.5">
                  <span className="capitalize font-medium text-[10px] px-2 py-0.5 rounded bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#5A6B82] dark:text-[#94A3B8]">
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
                <td className="px-3.5 py-2.5 text-[10px] text-[#5A6B82] dark:text-[#94A3B8] capitalize">{inv.source}</td>
                <td className="px-3.5 py-2.5 text-right font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                  {formatCurrency(inv.grand_total, currency)}
                </td>
                <td className="px-3.5 py-2.5 text-[#5A6B82]">
                  {new Date(inv.created_at).toLocaleString()}
                </td>
                <td className="px-3.5 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => reprint(inv.id)}
                      title="View & Print Invoice Receipt"
                      className="p-1.5 text-[#0A4174] hover:text-[#062E52] dark:text-[#4A8CD2] dark:hover:text-[#6BA3E0] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => reprint(inv.id)}
                      title="Print Invoice Receipt"
                      className="p-1.5 text-[#5A6B82] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {inv.status === 'completed' && (
                      <button
                        onClick={async () => {
                          try {
                            const { data } = await api.get(`/invoices/${inv.id}`);
                            setEditingInvoice(data);
                          } catch {
                            alert('Failed to load invoice for editing');
                          }
                        }}
                        title="Edit / Update Invoice"
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {inv.status === 'completed' && canReturn && (
                      <button
                        onClick={() => openReturn(inv)}
                        title="Sales Return"
                        className="p-1.5 text-[#0A4174] dark:text-[#4A8CD2] hover:text-[#062E52] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
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
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[#5A6B82] dark:text-[#94A3B8]">
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
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B]">
            <h3 className="mb-2 font-bold text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
              Return Items — Invoice #{returning.invoice_no}
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {returnableItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between p-2 rounded bg-[#F4F7FB] dark:bg-[#1A2A3D]/60 text-xs">
                  <div>
                    <span className="font-semibold block">{it.product_name_snapshot}</span>
                    <span className="text-[#5A6B82] dark:text-[#94A3B8]">Sold: {it.qty}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={it.qty}
                    value={returnQtys[it.id] || 0}
                    onChange={(e) => setReturnQtys({ ...returnQtys, [it.id]: e.target.value })}
                    className="w-20 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2.5 py-1 text-xs text-center"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 text-xs">
              <button
                onClick={submitReturn}
                className="flex-1 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold py-2 shadow-sm"
              >
                Confirm Return
              </button>
              <button
                onClick={() => setReturning(null)}
                className="flex-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] py-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <InvoicePreviewModal
          invoice={previewInvoice}
          settings={settings}
          onClose={() => setPreviewInvoice(null)}
        />
      )}

      {/* Invoice Edit Modal */}
      {editingInvoice && (
        <InvoiceEditModal
          invoice={editingInvoice}
          products={availableProducts}
          currency={currency}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => {
            setEditingInvoice(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function InvoiceEditModal({ invoice, products, currency, onClose, onSaved }) {
  const [items, setItems] = useState(
    (invoice.items || []).map((it) => ({
      product_id: it.product_id,
      variant_id: it.variant_id,
      serial_id: it.serial_id,
      product_name: it.product_name_snapshot,
      qty: Number(it.qty),
      unit_price: Number(it.unit_price),
      discount_amount: Number(it.discount_amount || 0),
      tax_amount: Number(it.tax_amount || 0),
      addons: it.addons || [],
    }))
  );
  const [discountAmount, setDiscountAmount] = useState(Number(invoice.discount_amount || 0));
  const [paidAmount, setPaidAmount] = useState(Number(invoice.paid_amount || 0));
  const [selectedAddProductId, setSelectedAddProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const calcSubtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const calcTax = items.reduce((s, it) => s + (Number(it.tax_amount) || 0), 0);
  const calcItemDiscount = items.reduce((s, it) => s + (Number(it.discount_amount) || 0), 0);
  const grandTotal = Math.max(0, Math.round((calcSubtotal - calcItemDiscount - discountAmount + calcTax) * 100) / 100);

  const updateItemQty = (idx, newQty) => {
    const q = Math.max(0, parseFloat(newQty) || 0);
    setItems((prev) =>
      prev
        .map((it, i) => {
          if (i !== idx) return it;
          if (q === 0) return null;
          const ratio = it.qty > 0 ? q / it.qty : 1;
          return {
            ...it,
            qty: q,
            discount_amount: Math.round(it.discount_amount * ratio * 100) / 100,
            tax_amount: Math.round(it.tax_amount * ratio * 100) / 100,
          };
        })
        .filter(Boolean)
    );
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddNewItem = () => {
    if (!selectedAddProductId) return;
    const prod = products.find((p) => String(p.id) === String(selectedAddProductId));
    if (!prod) return;

    const unitPrice = Number(prod.selling_price || 0);
    const taxPercent = Number(prod.tax_percent || 0);
    const taxAmount = Math.round(((unitPrice * taxPercent) / 100) * 100) / 100;

    setItems((prev) => [
      ...prev,
      {
        product_id: prod.id,
        variant_id: null,
        serial_id: null,
        product_name: prod.name,
        qty: 1,
        unit_price: unitPrice,
        discount_amount: 0,
        tax_amount: taxAmount,
        addons: [],
      },
    ]);
    setSelectedAddProductId('');
  };

  const handleSave = async () => {
    if (items.length === 0) {
      setError('Invoice must have at least one product');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/invoices/${invoice.id}`, {
        items,
        discount_amount: discountAmount,
        paid_amount: paidAmount,
        customer_id: invoice.customer_id,
        customer_type: invoice.customer_type,
        slogan: invoice.slogan,
      });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#DCE5EF] dark:border-[#22354B] pb-3">
          <div>
            <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
              Update Invoice #{invoice.invoice_no}
            </h3>
            <p className="text-[11px] text-[#5A6B82]">
              Customer: <strong>{invoice.customer_name || 'Walk-in'}</strong> • Adjust items, reduce/add quantities
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#5A6B82] hover:bg-[#E2EDF8]">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-50 text-red-600 text-xs border border-red-200">
            {error}
          </div>
        )}

        {/* Add Product Section */}
        <div className="flex gap-2 items-center bg-[#F4F7FB] dark:bg-[#1A2A3D]/50 p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B]">
          <select
            value={selectedAddProductId}
            onChange={(e) => setSelectedAddProductId(e.target.value)}
            className="flex-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#0A4174]"
          >
            <option value="">-- Add New Product to Invoice --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCurrency(p.selling_price, currency)} (Stock: {p.stock_qty})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddNewItem}
            disabled={!selectedAddProductId}
            className="px-3 py-1.5 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] text-white text-xs font-bold disabled:opacity-50"
          >
            + Add
          </button>
        </div>

        {/* Items List */}
        <div className="overflow-x-auto border border-[#DCE5EF] dark:border-[#22354B] rounded-xl">
          <table className="min-w-full text-xs">
            <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-center w-28">Qty</th>
                <th className="px-3 py-2 text-right">Line Total</th>
                <th className="px-2 py-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 font-medium">{it.product_name}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(it.unit_price, currency)}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={it.qty}
                      onChange={(e) => updateItemQty(idx, e.target.value)}
                      className="w-20 rounded border border-[#DCE5EF] dark:border-[#22354B] px-2 py-1 text-center font-bold"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-[#0A4174] dark:text-[#4A8CD2]">
                    {formatCurrency(it.qty * it.unit_price, currency)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#5A6B82]">
                    No items left in invoice
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Calculations / Summary */}
        <div className="bg-[#F4F7FB] dark:bg-[#1A2A3D]/40 p-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs space-y-1.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(calcSubtotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax:</span>
            <span>{formatCurrency(calcTax, currency)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Bill Discount:</span>
            <input
              type="number"
              step="any"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              className="w-24 rounded border border-[#DCE5EF] dark:border-[#22354B] px-2 py-0.5 text-right"
            />
          </div>
          <div className="flex justify-between font-bold text-sm border-t border-[#DCE5EF] dark:border-[#22354B] pt-2 text-[#0A4174] dark:text-[#4A8CD2]">
            <span>Grand Total:</span>
            <span>{formatCurrency(grandTotal, currency)}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span>Paid Amount:</span>
            <input
              type="number"
              step="any"
              value={paidAmount}
              onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
              className="w-24 rounded border border-[#DCE5EF] dark:border-[#22354B] px-2 py-0.5 text-right font-bold text-emerald-600"
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#5A6B82]">
            <span>Balance Due:</span>
            <span>{formatCurrency(Math.max(0, grandTotal - paidAmount), currency)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold text-[#5A6B82]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="px-4 py-2 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] text-xs font-bold disabled:opacity-50 shadow-sm"
          >
            {saving ? 'Updating...' : 'Save Updated Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
