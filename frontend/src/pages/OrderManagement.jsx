import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import { openOrderSlipWindow } from '../print/orderSlip';
import { exportTableCsv } from '../utils/reportExport';
import { VanStockTab } from './VanSales';
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  Printer,
  Receipt,
  CheckCircle2,
  Ban,
  Trash2,
  X,
  Pencil,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  Truck,
} from 'lucide-react';

const BOOKING_SOURCES = ['direct', 'salesman', 'phone', 'whatsapp'];

const NEXT_STATUS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
};

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  confirmed: 'bg-[#E2EDF8] text-[#0A4174] dark:bg-[#1A2A3D] dark:text-[#4A8CD2]',
  processing: 'bg-[#E2EDF8] text-[#0A4174] dark:bg-[#1A2A3D] dark:text-[#4A8CD2]',
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

const PAGE_SIZE = 10;

function emptyLine() {
  return { product_id: '', qty: 1, rate: '' };
}

function lineTotal(line) {
  const qty = Number(line.qty || 0);
  const rate = Number(line.rate || 0);
  const taxPercent = Number(line.tax_percent || 0);
  return qty * rate * (1 + taxPercent / 100);
}

/** 3-state stock-availability badge next to an order item line — mirrors
 * KC Agency's advisory (non-blocking) stock indicator: red = out of stock,
 * amber = ordered qty exceeds what's on hand, green = otherwise available. */
function StockBadge({ product, qty, t }) {
  const available = Number(product.stock_qty || 0);
  const requested = Number(qty || 0);
  if (available <= 0) {
    return (
      <span title={t('orders.stock_out_tooltip')} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
        {t('orders.stock')}: {available}
      </span>
    );
  }
  if (requested > available) {
    return (
      <span title={t('orders.stock_over_tooltip')} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-2.5 h-2.5" /> {t('orders.stock')}: {available}
      </span>
    );
  }
  return (
    <span title={t('orders.stock_ok_tooltip')} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
      {t('orders.stock')}: {available}
    </span>
  );
}

export default function OrderManagement() {
  const { t } = useTranslation();
  const { can, user } = useAuth();
  const { settings } = useSettings();
  const currency = settings?.currency_symbol || '₹';

  const canCreate = can('orders.create');
  const canManageStatus = can('orders.manage_status');
  const canViewVanStock = can('van_sales.view');

  const [section, setSection] = useState('pre_bookings');
  const [vehicles, setVehicles] = useState([]);

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    customer_id: '',
    booking_source: 'direct',
    assigned_to: '',
    notes: '',
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [viewingOrder, setViewingOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [dispatchingOrder, setDispatchingOrder] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/customers').then(({ data }) => setCustomers(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/users').then(({ data }) => setUsers(Array.isArray(data) ? data : [])).catch(() => {});
    if (canViewVanStock) {
      api.get('/vehicles', { params: { is_active: 1 } }).then(({ data }) => setVehicles(Array.isArray(data) ? data : [])).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = settings?.business_type ? { business_type: settings.business_type } : {};
    api.get('/products', { params }).then(({ data }) => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
  }, [settings?.business_type]);

  const resetForm = () => {
    setForm({ customer_id: '', booking_source: 'direct', assigned_to: '', notes: '' });
    setLines([emptyLine()]);
  };

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, ...patch };
      if (patch.product_id) {
        const product = products.find((p) => String(p.id) === String(patch.product_id));
        if (product) {
          next.rate = product.selling_price || 0;
          next.tax_percent = product.tax_percent || 0;
        }
      }
      return next;
    }));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const validLines = useMemo(() => lines.filter((l) => l.product_id && Number(l.qty) > 0), [lines]);

  const formTotals = useMemo(() => {
    const subtotal = validLines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
    const gst = validLines.reduce((s, l) => s + Number(l.qty) * Number(l.rate) * (Number(l.tax_percent || 0) / 100), 0);
    return { subtotal, gst, grandTotal: subtotal + gst };
  }, [validLines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!form.customer_id) {
      setFormError(t('orders.select_customer_error'));
      return;
    }
    if (validLines.length === 0) {
      setFormError(t('orders.select_item_error'));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/orders', {
        customer_id: form.customer_id,
        booking_source: form.booking_source,
        assigned_to: form.assigned_to || null,
        notes: form.notes || null,
        created_by: user?.uid || null,
        items: validLines.map((l) => ({ product_id: l.product_id, qty: Number(l.qty), rate: Number(l.rate) })),
      });
      setFormSuccess(t('orders.created_success'));
      resetForm();
      load();
      setTimeout(() => setFormSuccess(''), 3000);
    } catch (err) {
      setFormError(err?.response?.data?.error || t('orders.save_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = async (order) => {
    try {
      const { data } = await api.get(`/orders/${order.id}`);
      setEditingOrder({
        ...data,
        form: {
          customer_id: data.customer_id,
          booking_source: data.booking_source,
          assigned_to: data.assigned_to || '',
          notes: data.notes || '',
        },
        lines: (data.items || []).map((it) => ({
          product_id: it.product_id,
          qty: it.qty,
          rate: it.rate,
          tax_percent: it.tax_percent,
        })),
      });
    } catch {
      // ignore
    }
  };

  const saveEdit = async () => {
    if (!editingOrder) return;
    const valid = editingOrder.lines.filter((l) => l.product_id && Number(l.qty) > 0);
    if (!editingOrder.form.customer_id || valid.length === 0) return;
    try {
      await api.put(`/orders/${editingOrder.id}`, {
        customer_id: editingOrder.form.customer_id,
        booking_source: editingOrder.form.booking_source,
        assigned_to: editingOrder.form.assigned_to || null,
        notes: editingOrder.form.notes || null,
        items: valid.map((l) => ({ product_id: l.product_id, qty: Number(l.qty), rate: Number(l.rate) })),
      });
      setEditingOrder(null);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || t('orders.save_failed'));
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      load();
      if (viewingOrder?.id === id) setViewingOrder(null);
    } catch (err) {
      alert(err?.response?.data?.error || t('orders.save_failed'));
    }
  };

  const cancelOrder = async (id) => {
    if (!window.confirm(t('orders.cancel_confirm'))) return;
    try {
      await api.post(`/orders/${id}/cancel`);
      load();
      if (viewingOrder?.id === id) setViewingOrder(null);
    } catch (err) {
      alert(err?.response?.data?.error || t('orders.save_failed'));
    }
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((o) =>
      (o.order_no || '').toLowerCase().includes(term) ||
      (o.customer_name || '').toLowerCase().includes(term) ||
      (o.status || '').toLowerCase().includes(term)
    );
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pagedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search]);

  const exportOrders = () => {
    exportTableCsv('customer_orders', [
      ['order_no', t('orders.cols.order_no')],
      ['created_at', t('common.date')],
      ['customer_name', t('orders.customer')],
      ['assigned_to_name', t('orders.assigned_to')],
      ['booking_source', t('orders.booking_source')],
      ['item_count', t('orders.items')],
      ['estimated_total', t('orders.estimated_total'), (v) => formatCurrency(v, currency)],
      ['status', t('common.status')],
    ], filteredOrders);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
            {t('orders.title')}
          </h1>
          <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">{t('orders.subtitle')}</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] px-3 py-1.5 text-xs font-bold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t('orders.refresh')}
        </button>
      </div>

      {canViewVanStock && (
        <div className="mb-4 flex flex-wrap gap-1">
          <button
            onClick={() => setSection('pre_bookings')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              section === 'pre_bookings' ? 'bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E]' : 'border border-[#DCE5EF] dark:border-[#22354B]'
            }`}
          >
            {t('orders.tabs.pre_bookings')}
          </button>
          <button
            onClick={() => setSection('van_stock')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
              section === 'van_stock' ? 'bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E]' : 'border border-[#DCE5EF] dark:border-[#22354B]'
            }`}
          >
            <Truck className="w-3.5 h-3.5" /> {t('orders.tabs.van_stock')}
          </button>
        </div>
      )}

      {section === 'van_stock' && canViewVanStock && (
        <VanStockTab vehicles={vehicles} currency={currency} can={can} />
      )}

      {section === 'pre_bookings' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {canCreate && (
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
              <h3 className="mb-3 font-bold text-sm flex items-center gap-1.5 text-[#0A4174] dark:text-[#4A8CD2]">
                <Plus className="w-4 h-4" /> {t('orders.new_order')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t('orders.customer')} *</label>
                  <select
                    required
                    value={form.customer_id}
                    onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm"
                  >
                    <option value="">{t('orders.select_customer')}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t('orders.booking_source')}</label>
                    <select
                      value={form.booking_source}
                      onChange={(e) => setForm((f) => ({ ...f, booking_source: e.target.value }))}
                      className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm"
                    >
                      {BOOKING_SOURCES.map((src) => (
                        <option key={src} value={src}>{t(`orders.booking_sources.${src}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t('orders.assigned_to')}</label>
                    <select
                      value={form.assigned_to}
                      onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                      className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm"
                    >
                      <option value="">{t('orders.none')}</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">{t('orders.items')}</label>
                  <div className="space-y-2">
                    {lines.map((line, idx) => {
                      const product = products.find((p) => String(p.id) === String(line.product_id));
                      return (
                        <div key={idx}>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={line.product_id}
                              onChange={(e) => updateLine(idx, { product_id: e.target.value })}
                              className="flex-1 min-w-0 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs"
                            >
                              <option value="">{t('orders.select_item')}</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku || p.barcode || p.id}) [{t('orders.stock')}: {Number(p.stock_qty || 0)}]
                                </option>
                              ))}
                            </select>
                            <input
                              type="number" step="any" min="0"
                              value={line.qty}
                              onChange={(e) => updateLine(idx, { qty: e.target.value })}
                              placeholder={t('pos.qty')}
                              className="w-16 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs"
                            />
                            <input
                              type="number" step="any" min="0"
                              value={line.rate}
                              onChange={(e) => updateLine(idx, { rate: e.target.value })}
                              placeholder={t('orders.rate')}
                              className="w-20 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs"
                            />
                            <span className="w-20 text-right text-xs font-bold flex-shrink-0">
                              {formatCurrency(lineTotal(line), currency)}
                            </span>
                            <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 flex-shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {product && (
                            <div className="mt-0.5 ml-0.5 flex items-center gap-1.5">
                              <StockBadge product={product} qty={line.qty} t={t} />
                              {Number(product.tax_percent || 0) > 0 && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2]">
                                  GST {product.tax_percent}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={addLine}
                    className="mt-1.5 text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline"
                  >
                    + {t('orders.add_item')}
                  </button>
                </div>

                <div className="rounded-lg bg-[#F4F7FB] dark:bg-[#1A2A3D] p-2.5 text-xs space-y-1">
                  <div className="flex justify-between"><span>{t('pos.subtotal')}</span><span>{formatCurrency(formTotals.subtotal, currency)}</span></div>
                  <div className="flex justify-between"><span>{t('pos.tax')}</span><span>{formatCurrency(formTotals.gst, currency)}</span></div>
                  <div className="flex justify-between font-bold border-t border-[#DCE5EF] dark:border-[#22354B] pt-1 mt-1">
                    <span>{t('orders.estimated_total')}</span><span>{formatCurrency(formTotals.grandTotal, currency)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">{t('orders.notes')}</label>
                  <textarea
                    rows={1}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder={t('orders.notes_placeholder')}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm"
                  />
                </div>

                {formError && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {formSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!form.customer_id || submitting}
                  className="w-full rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] py-2 text-xs font-bold disabled:opacity-50"
                >
                  {submitting ? t('common.loading') : t('orders.create_order')}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={canCreate ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6B82]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('orders.search_placeholder')}
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent text-xs"
                />
              </div>
              <button
                onClick={exportOrders}
                disabled={filteredOrders.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] px-2.5 py-1 text-xs font-bold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] disabled:opacity-40"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> {t('reports.export_excel')}
              </button>
              <span className="text-xs text-[#5A6B82] dark:text-[#94A3B8]">{t('orders.order_count', { count: filteredOrders.length })}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
                  <tr>
                    <th className="px-2 py-2">{t('orders.cols.order_no')}</th>
                    <th className="px-2 py-2">{t('common.date')}</th>
                    <th className="px-2 py-2">{t('orders.customer')}</th>
                    <th className="px-2 py-2 text-right">{t('orders.estimated_total')}</th>
                    <th className="px-2 py-2">{t('common.status')}</th>
                    <th className="px-2 py-2 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} className="py-6 text-center text-[#5A6B82]">{t('common.loading')}</td></tr>
                  )}
                  {!loading && pagedOrders.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-[#5A6B82]">{t('orders.no_orders')}</td></tr>
                  )}
                  {!loading && pagedOrders.map((o) => (
                    <tr key={o.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                      <td className="px-2 py-2 font-mono">{o.order_no}</td>
                      <td className="px-2 py-2">{(o.created_at || '').slice(0, 10)}</td>
                      <td className="px-2 py-2">{o.customer_name}</td>
                      <td className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatCurrency(o.estimated_total, currency)}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_BADGE[o.status] || ''}`}>
                          {o.status}
                        </span>
                        {o.van_order_no && (
                          <div className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1" title="Van stock loading order">
                            <Truck className="w-3 h-3" /> {o.van_order_no}
                          </div>
                        )}
                        {o.invoice_no && (
                          <div className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Receipt className="w-3 h-3" /> {o.invoice_no}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {canViewVanStock && !o.van_order_no && !o.invoice_id && ['pending', 'confirmed'].includes(o.status) && (
                            <button
                              title="Dispatch to Van Stock (Assign vehicle & staff)"
                              onClick={() => setDispatchingOrder(o)}
                              className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button title={t('orders.view_details')} onClick={() => setViewingOrder(o)} className="p-1 text-[#5A6B82] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title={t('orders.print_slip')}
                            onClick={async () => {
                              const { data } = await api.get(`/orders/${o.id}`);
                              openOrderSlipWindow(data, settings);
                            }}
                            className="p-1 text-[#5A6B82] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {o.status !== 'cancelled' && !o.invoice_id && (
                            <Link
                              to={`/pos?order_id=${o.id}`}
                              title={t('orders.convert_to_bill')}
                              className="p-1 text-[#5A6B82] hover:text-emerald-600"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          {canCreate && o.status === 'pending' && (
                            <button title={t('common.edit')} onClick={() => openEdit(o)} className="p-1 text-[#5A6B82] hover:text-amber-600">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canManageStatus && (NEXT_STATUS[o.status] || []).filter((s) => s !== 'cancelled').map((next) => (
                            <button
                              key={next}
                              title={t('orders.mark_status', { status: next })}
                              onClick={() => setStatus(o.id, next)}
                              className="p-1 text-emerald-600 hover:text-emerald-800"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          ))}
                          {canManageStatus && (NEXT_STATUS[o.status] || []).includes('cancelled') && (
                            <button title={t('orders.cancel_order')} onClick={() => cancelOrder(o.id)} className="p-1 text-red-500 hover:text-red-700">
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded border border-[#DCE5EF] dark:border-[#22354B] disabled:opacity-40">{t('common.prev')}</button>
                <span>{t('common.page_of', { page, total: totalPages })}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded border border-[#DCE5EF] dark:border-[#22354B] disabled:opacity-40">{t('common.next')}</button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {viewingOrder && (
        <OrderViewModal
          order={viewingOrder}
          currency={currency}
          canManageStatus={canManageStatus}
          onClose={() => setViewingOrder(null)}
          onPrint={() => openOrderSlipWindow(viewingOrder, settings)}
        />
      )}

      {editingOrder && (
        <OrderEditModal
          editingOrder={editingOrder}
          setEditingOrder={setEditingOrder}
          customers={customers}
          products={products}
          users={users}
          currency={currency}
          onCancel={() => setEditingOrder(null)}
          onSave={saveEdit}
        />
      )}

      {dispatchingOrder && (
        <OrderDispatchModal
          order={dispatchingOrder}
          vehicles={vehicles}
          users={users}
          currency={currency}
          onClose={() => setDispatchingOrder(null)}
          onSuccess={() => {
            setDispatchingOrder(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function OrderViewModal({ order, currency, canManageStatus, onClose, onPrint }) {
  const { t } = useTranslation();
  const [full, setFull] = useState(order);

  useEffect(() => {
    api.get(`/orders/${order.id}`).then(({ data }) => setFull(data)).catch(() => {});
  }, [order.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-sm">{full.order_no}</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1 text-xs mb-3">
          <div>{t('orders.customer')}: <strong>{full.customer_name}</strong></div>
          <div>{t('common.status')}: <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_BADGE[full.status] || ''}`}>{full.status}</span></div>
          {full.van_order_no && (
            <div className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" /> Van Stock Order: <strong>{full.van_order_no}</strong>
            </div>
          )}
          {full.assigned_to_name && <div>{t('orders.assigned_to')}: {full.assigned_to_name}</div>}
          {full.notes && <div>{t('orders.notes')}: {full.notes}</div>}
        </div>
        <table className="w-full text-xs mb-3">
          <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D]">
            <tr><th className="text-left px-2 py-1">{t('receipt.item')}</th><th className="px-2 py-1">{t('pos.qty')}</th><th className="px-2 py-1 text-right">{t('pos.price')}</th><th className="px-2 py-1 text-right">{t('common.total')}</th></tr>
          </thead>
          <tbody>
            {(full.items || []).map((it) => (
              <tr key={it.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                <td className="px-2 py-1">{it.product_name}</td>
                <td className="px-2 py-1 text-center">{it.qty}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(it.rate, currency)}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(lineTotal(it), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {full.status !== 'cancelled' && !full.invoice_id && (
              <Link to={`/pos?order_id=${full.id}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">
                <Receipt className="w-3.5 h-3.5" /> {t('orders.convert_to_bill')}
              </Link>
            )}
            <button onClick={onPrint} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold">
              <Printer className="w-3.5 h-3.5" /> {t('orders.print_slip')}
            </button>
          </div>
          <button onClick={onClose} className="px-3 py-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold">{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}

function OrderEditModal({ editingOrder, setEditingOrder, customers, products, users, currency, onCancel, onSave }) {
  const { t } = useTranslation();
  const lines = editingOrder.lines;
  const valid = lines.filter((l) => l.product_id && Number(l.qty) > 0);
  const subtotal = valid.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
  const gst = valid.reduce((s, l) => s + Number(l.qty) * Number(l.rate) * (Number(l.tax_percent || 0) / 100), 0);

  const updateLine = (idx, patch) => {
    setEditingOrder((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        if (patch.product_id) {
          const product = products.find((p) => String(p.id) === String(patch.product_id));
          if (product) {
            next.rate = product.selling_price || 0;
            next.tax_percent = product.tax_percent || 0;
          }
        }
        return next;
      }),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-sm">{t('common.edit')} {editingOrder.order_no}</h3>
          <button onClick={onCancel}><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs font-semibold mb-1">{t('orders.customer')}</label>
            <select
              value={editingOrder.form.customer_id}
              onChange={(e) => setEditingOrder((p) => ({ ...p, form: { ...p.form, customer_id: e.target.value } }))}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm"
            >
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">{t('orders.booking_source')}</label>
            <select
              value={editingOrder.form.booking_source}
              onChange={(e) => setEditingOrder((p) => ({ ...p, form: { ...p.form, booking_source: e.target.value } }))}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm"
            >
              {BOOKING_SOURCES.map((src) => <option key={src} value={src}>{t(`orders.booking_sources.${src}`)}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-2">
          <label className="block text-xs font-semibold mb-1">{t('orders.assigned_to')}</label>
          <select
            value={editingOrder.form.assigned_to}
            onChange={(e) => setEditingOrder((p) => ({ ...p, form: { ...p.form, assigned_to: e.target.value } }))}
            className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="">{t('orders.none')}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>

        <div className="space-y-2 mb-2">
          {lines.map((line, idx) => {
            const product = products.find((p) => String(p.id) === String(line.product_id));
            return (
              <div key={idx}>
                <div className="flex items-center gap-1.5">
                  <select
                    value={line.product_id}
                    onChange={(e) => updateLine(idx, { product_id: e.target.value })}
                    className="flex-1 min-w-0 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs"
                  >
                    <option value="">{t('orders.select_item')}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" step="any" min="0" value={line.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} className="w-16 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs" />
                  <input type="number" step="any" min="0" value={line.rate} onChange={(e) => updateLine(idx, { rate: e.target.value })} className="w-20 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs" />
                  <button type="button" onClick={() => setEditingOrder((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))} className="text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {product && (
                  <div className="mt-0.5 ml-0.5 flex items-center gap-1.5">
                    <StockBadge product={product} qty={line.qty} t={t} />
                    {Number(product.tax_percent || 0) > 0 && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2]">
                        GST {product.tax_percent}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => setEditingOrder((p) => ({ ...p, lines: [...p.lines, emptyLine()] }))} className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline">
            + {t('orders.add_item')}
          </button>
        </div>

        <div className="rounded-lg bg-[#F4F7FB] dark:bg-[#1A2A3D] p-2.5 text-xs space-y-1 mb-3">
          <div className="flex justify-between"><span>{t('pos.subtotal')}</span><span>{formatCurrency(subtotal, currency)}</span></div>
          <div className="flex justify-between"><span>{t('pos.tax')}</span><span>{formatCurrency(gst, currency)}</span></div>
          <div className="flex justify-between font-bold border-t border-[#DCE5EF] dark:border-[#22354B] pt-1 mt-1">
            <span>{t('orders.estimated_total')}</span><span>{formatCurrency(subtotal + gst, currency)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold">{t('common.cancel')}</button>
          <button
            onClick={onSave}
            disabled={!editingOrder.form.customer_id || valid.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] text-xs font-bold disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDispatchModal({ order, vehicles, users, currency, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [employeeId, setEmployeeId] = useState(order.assigned_to || '');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(`Dispatched from Pre-Order #${order.order_no}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!vehicleId) {
      setError('Please select a delivery vehicle');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/orders/${order.id}/dispatch-van`, {
        vehicle_id: vehicleId,
        employee_id: employeeId || null,
        order_date: orderDate,
        notes: notes || null,
      });
      onSuccess();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to dispatch order to van');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between border-b border-[#DCE5EF] dark:border-[#22354B] pb-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-sm text-[#0A4174] dark:text-[#4A8CD2]">
              Dispatch to Van Stock
            </h3>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-[#5A6B82]" /></button>
        </div>

        <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] mb-3">
          This will map customer order <strong className="text-slate-800 dark:text-slate-200 font-mono">{order.order_no}</strong> ({order.customer_name}) into a Van Stock Loading Order, allocate stock, and assign the delivery staff.
        </p>

        <form onSubmit={handleDispatch} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Select Delivery Vehicle *</label>
            <select
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5"
            >
              <option value="">-- Choose Vehicle --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_no} {v.model ? `(${v.model})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Assigned Salesman / Driver</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5"
            >
              <option value="">-- None / Select Staff --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold mb-1">Dispatch Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Order Total</label>
              <input
                type="text"
                disabled
                value={formatCurrency(order.estimated_total, currency)}
                className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Dispatch Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 px-2.5 py-1.5 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#DCE5EF] dark:border-[#22354B]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !vehicleId}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              {loading ? 'Dispatching...' : 'Dispatch to Van'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
