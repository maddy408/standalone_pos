import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import { printVanOrder, printDayReturn, printDayClosing } from '../print/vanSalesPrint';
import { newUuid, enqueueOutboxItem } from '../db/db';
import { refreshPendingCount } from '../db/syncService';
import {
  Truck, Plus, Eye, Printer, Pencil, Ban, Trash2, PackageCheck, X,
  RefreshCw, Search, Lock, Unlock, AlertTriangle,
} from 'lucide-react';

function today() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  loaded: 'bg-[#E2EDF8] text-[#0A4174] dark:bg-[#1A2A3D] dark:text-[#4A8CD2]',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  reopened: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
};

const TABS = ['orders', 'van_stock', 'day_return', 'day_closing'];

export default function VanSales() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { settings } = useSettings();
  const currency = settings?.currency_symbol || '₹';
  const [tab, setTab] = useState('orders');
  const [vehicles, setVehicles] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [eligibleOrders, setEligibleOrders] = useState([]);

  const loadShared = () => {
    api.get('/vehicles', { params: { is_active: 1 } }).then(({ data }) => setVehicles(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/users').then(({ data }) => setEmployees(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/van-orders/eligible-orders').then(({ data }) => setEligibleOrders(Array.isArray(data) ? data : [])).catch(() => {});
    const params = settings?.business_type ? { business_type: settings.business_type } : {};
    api.get('/products', { params }).then(({ data }) => setProducts(Array.isArray(data) ? data : [])).catch(() => {});
  };

  useEffect(() => {
    loadShared();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.business_type]);

  if (!can('van_sales.view')) {
    return <div className="text-sm text-[#5A6B82] dark:text-[#94A3B8]">{t('van_sales.no_permission')}</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
          {t('van_sales.title')}
        </h1>
        <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">{t('van_sales.subtitle')}</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === key ? 'bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E]' : 'border border-[#DCE5EF] dark:border-[#22354B]'
            }`}
          >
            {t(`van_sales.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <OrdersTab
          vehicles={vehicles}
          products={products}
          employees={employees}
          eligibleOrders={eligibleOrders}
          onOrdersChanged={loadShared}
          currency={currency}
          settings={settings}
          can={can}
        />
      )}
      {tab === 'van_stock' && <VanStockTab vehicles={vehicles} employees={employees} currency={currency} can={can} />}
      {tab === 'day_return' && <DayReturnTab vehicles={vehicles} currency={currency} settings={settings} can={can} />}
      {tab === 'day_closing' && <DayClosingTab vehicles={vehicles} currency={currency} settings={settings} can={can} />}
    </div>
  );
}

function emptyLine() {
  return { product_id: '', qty: 1, unit_price: '', discount_amount: 0, tax_percent: 0 };
}

function lineTotal(l) {
  const qty = Number(l.qty || 0);
  const price = Number(l.unit_price || 0);
  const discount = Number(l.discount_amount || 0);
  const tax = Number(l.tax_amount ?? (qty * price * (Number(l.tax_percent || 0) / 100)));
  return qty * price - discount + tax;
}

// ---------------------------------------------------------------------------
// Orders tab
// ---------------------------------------------------------------------------

function OrdersTab({ vehicles, products, employees = [], eligibleOrders = [], onOrdersChanged, currency, settings, can }) {
  const { t } = useTranslation();
  const canManage = can('van_sales.manage_orders');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    vehicle_id: '',
    van_number: '',
    route_line: '',
    employee_id: '',
    order_id: '',
    customer_id: '',
    order_date: today(),
    paid_amount: '',
    notes: '',
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/van-orders').then(({ data }) => setOrders(Array.isArray(data) ? data : [])).catch(() => setOrders([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const updateLine = (idx, patch) => {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, ...patch };
      if (patch.product_id) {
        const product = products.find((p) => String(p.id) === String(patch.product_id));
        if (product) {
          next.unit_price = product.selling_price || 0;
          next.tax_percent = product.tax_percent || 0;
        }
      }
      return next;
    }));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));
  const validLines = useMemo(() => lines.filter((l) => l.product_id && Number(l.qty) > 0), [lines]);

  const totals = useMemo(() => {
    const subtotal = validLines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price), 0);
    const discount = validLines.reduce((s, l) => s + Number(l.discount_amount || 0), 0);
    const tax = validLines.reduce((s, l) => s + Number(l.qty) * Number(l.unit_price) * (Number(l.tax_percent || 0) / 100), 0);
    return { subtotal, discount, tax, grandTotal: subtotal - discount + tax };
  }, [validLines]);

  const handleSelectEligibleOrder = (orderIdStr) => {
    if (!orderIdStr) {
      setForm((f) => ({ ...f, order_id: '', customer_id: '' }));
      return;
    }
    const selected = eligibleOrders.find((o) => String(o.id) === String(orderIdStr));
    if (selected) {
      setForm((f) => ({
        ...f,
        order_id: selected.id,
        customer_id: selected.customer_id || '',
        employee_id: selected.assigned_to ? String(selected.assigned_to) : f.employee_id,
        notes: `Order ${selected.order_no} for ${selected.customer_name || 'Customer'}`,
      }));
      if (Array.isArray(selected.items) && selected.items.length > 0) {
        setLines(
          selected.items.map((it) => {
            const prod = products.find((p) => String(p.id) === String(it.product_id));
            const unitPrice = Number(it.rate || prod?.selling_price || 0);
            const taxPercent = Number(it.tax_percent || prod?.tax_percent || 0);
            return {
              product_id: it.product_id,
              qty: Number(it.qty || 1),
              unit_price: unitPrice,
              discount_amount: 0,
              tax_percent: taxPercent,
            };
          })
        );
      }
    }
  };

  const resetForm = () => {
    setForm({
      vehicle_id: '',
      van_number: '',
      route_line: '',
      employee_id: '',
      order_id: '',
      customer_id: '',
      order_date: today(),
      paid_amount: '',
      notes: '',
    });
    setLines([emptyLine()]);
  };

  const buildPayload = () => ({
    uuid: newUuid(),
    vehicle_id: form.vehicle_id || null,
    van_number: form.van_number?.trim() || null,
    route_line: form.route_line?.trim() || null,
    employee_id: form.employee_id || null,
    order_id: form.order_id || null,
    customer_id: form.customer_id || null,
    order_date: form.order_date,
    paid_amount: Number(form.paid_amount || 0),
    notes: form.notes || null,
    items: validLines.map((l) => ({
      product_id: l.product_id,
      qty: Number(l.qty),
      unit_price: Number(l.unit_price),
      discount_amount: Number(l.discount_amount || 0),
      tax_amount: Number(l.qty) * Number(l.unit_price) * (Number(l.tax_percent || 0) / 100),
    })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!form.vehicle_id && !form.van_number?.trim()) {
      setFormError('Please select a vehicle or enter Van / Vehicle Number');
      return;
    }
    if (validLines.length === 0) {
      setFormError(t('van_sales.select_item_error'));
      return;
    }
    setSubmitting(true);
    const payload = buildPayload();
    try {
      await api.post('/van-orders', payload);
      setFormSuccess(t('van_sales.order_created'));
      resetForm();
      load();
      onOrdersChanged?.();
      setTimeout(() => setFormSuccess(''), 3000);
    } catch (err) {
      if (!err.response) {
        await enqueueOutboxItem({ client_id: payload.uuid, type: 'van_order', payload });
        refreshPendingCount();
        setFormSuccess(t('van_sales.order_queued_offline'));
        resetForm();
        setTimeout(() => setFormSuccess(''), 4000);
      } else {
        setFormError(err?.response?.data?.error || t('van_sales.save_failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const loadToVan = async (id) => {
    if (!window.confirm(t('van_sales.load_confirm'))) return;
    try {
      await api.post(`/van-orders/${id}/load`);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  const cancelOrder = async (id) => {
    const reason = window.prompt(t('van_sales.cancel_reason_prompt'));
    if (reason === null) return;
    try {
      await api.post(`/van-orders/${id}/cancel`, { reason });
      load();
    } catch (err) {
      alert(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm(t('van_sales.delete_confirm'))) return;
    try {
      await api.delete(`/van-orders/${id}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  const openEdit = async (order) => {
    const { data } = await api.get(`/van-orders/${order.id}`);
    setEditing({
      ...data,
      form: { vehicle_id: data.vehicle_id, order_date: data.order_date, paid_amount: data.paid_amount, notes: data.notes || '' },
      lines: (data.items || []).map((it) => ({
        product_id: it.product_id, qty: it.qty, unit_price: it.unit_price,
        discount_amount: it.discount_amount, tax_amount: it.tax_amount,
        tax_percent: it.unit_price > 0 ? (it.tax_amount / (it.qty * it.unit_price)) * 100 : 0,
      })),
    });
  };

  const saveEdit = async () => {
    const valid = editing.lines.filter((l) => l.product_id && Number(l.qty) > 0);
    if (valid.length === 0) return;
    try {
      await api.put(`/van-orders/${editing.id}`, {
        vehicle_id: editing.form.vehicle_id,
        order_date: editing.form.order_date,
        paid_amount: Number(editing.form.paid_amount || 0),
        notes: editing.form.notes || null,
        items: valid.map((l) => ({
          product_id: l.product_id, qty: Number(l.qty), unit_price: Number(l.unit_price),
          discount_amount: Number(l.discount_amount || 0),
          tax_amount: Number(l.qty) * Number(l.unit_price) * (Number(l.tax_percent || 0) / 100),
        })),
      });
      setEditing(null);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((o) => (o.order_no || '').toLowerCase().includes(term) || (o.vehicle_name || '').toLowerCase().includes(term));
  }, [orders, search]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {canManage && (
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
            <h3 className="mb-3 font-bold text-sm flex items-center gap-1.5 text-[#0A4174] dark:text-[#4A8CD2]">
              <Plus className="w-4 h-4" /> {t('van_sales.new_order')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* KC Agency Order Selection -> Populates items, customer & employee */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] flex items-center gap-1.5">
                    <Truck className="w-4 h-4" /> Select Customer Pre-Order (From Order Management)
                  </label>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    {eligibleOrders.length} Available Order(s)
                  </span>
                </div>
                <select
                  value={form.order_id}
                  onChange={(e) => handleSelectEligibleOrder(e.target.value)}
                  className="w-full rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-[#121E2C] px-3 py-2 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Order to Load into Van (e.g. ORD-...) --</option>
                  {eligibleOrders.map((eo) => (
                    <option key={eo.id} value={eo.id}>
                      Order #{eo.order_no} — {eo.customer_name} ({eo.items?.length || 0} items)
                    </option>
                  ))}
                </select>
                {form.order_id && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Order #{eligibleOrders.find((o) => String(o.id) === String(form.order_id))?.order_no} items and customer loaded automatically!
                  </p>
                )}
              </div>

              {/* Van & Staff Assignment (Simple Inputs) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Van / Vehicle Number *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. TN-01-AB-1234 or Van 1"
                    value={form.van_number}
                    onChange={(e) => setForm((f) => ({ ...f, van_number: e.target.value }))}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Route / Line</label>
                  <input
                    type="text"
                    placeholder="e.g. Route 1 / West Zone"
                    value={form.route_line}
                    onChange={(e) => setForm((f) => ({ ...f, route_line: e.target.value }))}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Assign Salesman / Driver</label>
                  <select
                    value={form.employee_id}
                    onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs"
                  >
                    <option value="">-- Select Staff --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || emp.username} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t('van_sales.order_date')}</label>
                  <input
                    type="date"
                    value={form.order_date}
                    onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Order / Dispatch Notes</label>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Morning delivery trip"
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{t('van_sales.items')}</label>
                <div className="space-y-2">
                  {lines.map((line, idx) => {
                    const product = products.find((p) => String(p.id) === String(line.product_id));
                    return (
                      <div key={idx}>
                        <div className="flex items-center gap-1.5">
                          <select value={line.product_id} onChange={(e) => updateLine(idx, { product_id: e.target.value })}
                            className="flex-1 min-w-0 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs">
                            <option value="">{t('van_sales.select_item')}</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name} [{t('van_sales.warehouse_stock')}: {Number(p.stock_qty || 0)}]</option>)}
                          </select>
                          <input type="number" step="any" min="0" value={line.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })}
                            placeholder={t('pos.qty')} className="w-16 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs" />
                          <input type="number" step="any" min="0" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                            placeholder={t('orders.rate')} className="w-20 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs" />
                          <input type="number" step="any" min="0" value={line.discount_amount} onChange={(e) => updateLine(idx, { discount_amount: e.target.value })}
                            placeholder={t('pos.discount')} className="w-16 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs" />
                          <span className="w-20 text-right text-xs font-bold flex-shrink-0">{formatCurrency(lineTotal(line), currency)}</span>
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        {product && Number(product.stock_qty || 0) < Number(line.qty || 0) && (
                          <div className="mt-0.5 ml-0.5 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {t('van_sales.exceeds_warehouse_stock')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={addLine} className="mt-1.5 text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline">
                  + {t('orders.add_item')}
                </button>
              </div>

              <div className="rounded-lg bg-[#F4F7FB] dark:bg-[#1A2A3D] p-2.5 text-xs space-y-1">
                <div className="flex justify-between"><span>{t('pos.subtotal')}</span><span>{formatCurrency(totals.subtotal, currency)}</span></div>
                <div className="flex justify-between"><span>{t('pos.discount')}</span><span>{formatCurrency(totals.discount, currency)}</span></div>
                <div className="flex justify-between"><span>{t('pos.tax')}</span><span>{formatCurrency(totals.tax, currency)}</span></div>
                <div className="flex justify-between font-bold border-t border-[#DCE5EF] dark:border-[#22354B] pt-1 mt-1">
                  <span>{t('pos.grand_total')}</span><span>{formatCurrency(totals.grandTotal, currency)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t('van_sales.paid_amount')}</label>
                  <input type="number" step="any" min="0" value={form.paid_amount} onChange={(e) => setForm((f) => ({ ...f, paid_amount: e.target.value }))}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t('orders.notes')}</label>
                  <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm" />
                </div>
              </div>

              {formError && <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">{formError}</div>}
              {formSuccess && <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">{formSuccess}</div>}

              <button type="submit" disabled={!form.vehicle_id || submitting}
                className="w-full rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] py-2 text-xs font-bold disabled:opacity-50">
                {submitting ? t('common.loading') : t('van_sales.create_order')}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className={canManage ? 'lg:col-span-7' : 'lg:col-span-12'}>
        <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6B82]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('van_sales.search_orders')}
                className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent text-xs" />
            </div>
            <button onClick={load} className="p-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82] hover:text-[#0A4174]"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
                <tr>
                  <th className="px-2 py-2">{t('van_sales.order_no')}</th>
                  <th className="px-2 py-2">{t('common.date')}</th>
                  <th className="px-2 py-2">{t('van_sales.vehicle')}</th>
                  <th className="px-2 py-2">Assigned Staff</th>
                  <th className="px-2 py-2 text-right">{t('pos.grand_total')}</th>
                  <th className="px-2 py-2">{t('common.status')}</th>
                  <th className="px-2 py-2 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="py-6 text-center text-[#5A6B82]">{t('common.loading')}</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-[#5A6B82]">{t('van_sales.no_orders')}</td></tr>}
                {!loading && filtered.map((o) => (
                  <tr key={o.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                    <td className="px-2 py-2">
                      <div className="font-mono font-bold text-[#0A4174] dark:text-[#4A8CD2]">{o.order_no}</div>
                      {o.mapped_order_no && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                          Order: {o.mapped_order_no}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">{o.order_date}</td>
                    <td className="px-2 py-2">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {o.van_number || o.vehicle_name}
                      </div>
                      {o.route_line && (
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          Line: {o.route_line}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-xs font-medium text-[#1C2736] dark:text-[#F1F5F9]">
                        {o.employee_name || '—'}
                      </div>
                      {o.customer_name && (
                        <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
                          Cust: {o.customer_name}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">{formatCurrency(o.grand_total, currency)}</td>
                    <td className="px-2 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_BADGE[o.status] || ''}`}>{o.status}</span></td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button title={t('orders.view_details')} onClick={() => setViewing(o)} className="p-1 text-[#5A6B82] hover:text-[#0A4174]"><Eye className="w-3.5 h-3.5" /></button>
                        <button title={t('orders.print_slip')} onClick={async () => { const { data } = await api.get(`/van-orders/${o.id}`); printVanOrder(data, settings); }} className="p-1 text-[#5A6B82] hover:text-[#0A4174]"><Printer className="w-3.5 h-3.5" /></button>
                        {canManage && o.status === 'pending' && (
                          <button title={t('van_sales.load_to_van')} onClick={() => loadToVan(o.id)} className="p-1 text-[#5A6B82] hover:text-emerald-600"><PackageCheck className="w-3.5 h-3.5" /></button>
                        )}
                        {canManage && (o.status === 'pending' || o.status === 'loaded') && (
                          <button title={t('common.edit')} onClick={() => openEdit(o)} className="p-1 text-[#5A6B82] hover:text-amber-600"><Pencil className="w-3.5 h-3.5" /></button>
                        )}
                        {canManage && (o.status === 'pending' || o.status === 'loaded') && (
                          <button title={t('van_sales.cancel_order')} onClick={() => cancelOrder(o.id)} className="p-1 text-red-500 hover:text-red-700"><Ban className="w-3.5 h-3.5" /></button>
                        )}
                        {canManage && (o.status === 'pending' || o.status === 'cancelled') && (
                          <button title={t('common.delete')} onClick={() => deleteOrder(o.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewing && <VanOrderViewModal order={viewing} currency={currency} onClose={() => setViewing(null)} onPrint={() => printVanOrder(viewing, settings)} t={t} />}
      {editing && (
        <VanOrderEditModal editing={editing} setEditing={setEditing} vehicles={vehicles} products={products} currency={currency}
          onCancel={() => setEditing(null)} onSave={saveEdit} t={t} />
      )}
    </div>
  );
}

function VanOrderViewModal({ order, currency, onClose, onPrint, t }) {
  const [full, setFull] = useState(order);
  useEffect(() => { api.get(`/van-orders/${order.id}`).then(({ data }) => setFull(data)).catch(() => {}); }, [order.id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-sm">{full.order_no}</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1 text-xs mb-3">
          <div>{t('van_sales.vehicle')}: <strong>{full.vehicle_name}</strong></div>
          {full.employee_name && <div>Assigned Staff: <strong>{full.employee_name}</strong></div>}
          {full.mapped_order_no && <div>Mapped Order: <strong>{full.mapped_order_no}</strong> {full.customer_name ? `(${full.customer_name})` : ''}</div>}
          <div>{t('common.status')}: <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_BADGE[full.status] || ''}`}>{full.status}</span></div>
        </div>
        <table className="w-full text-xs mb-3">
          <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D]">
            <tr><th className="text-left px-2 py-1">{t('receipt.item')}</th><th className="px-2 py-1">{t('pos.qty')}</th><th className="px-2 py-1 text-right">{t('pos.price')}</th><th className="px-2 py-1 text-right">{t('van_sales.warehouse_stock')}</th></tr>
          </thead>
          <tbody>
            {(full.items || []).map((it) => (
              <tr key={it.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                <td className="px-2 py-1">{it.product_name}</td>
                <td className="px-2 py-1 text-center">{it.qty}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(it.unit_price, currency)}</td>
                <td className="px-2 py-1 text-right">{it.warehouse_stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end gap-2">
          <button onClick={onPrint} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold"><Printer className="w-3.5 h-3.5" /> {t('orders.print_slip')}</button>
          <button onClick={onClose} className="px-3 py-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold">{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}

function VanOrderEditModal({ editing, setEditing, vehicles, products, currency, onCancel, onSave, t }) {
  const lines = editing.lines;
  const valid = lines.filter((l) => l.product_id && Number(l.qty) > 0);
  const grandTotal = valid.reduce((s, l) => s + lineTotal(l), 0);

  const updateLine = (idx, patch) => {
    setEditing((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, ...patch };
        if (patch.product_id) {
          const product = products.find((p) => String(p.id) === String(patch.product_id));
          if (product) { next.unit_price = product.selling_price || 0; next.tax_percent = product.tax_percent || 0; }
        }
        return next;
      }),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-sm">{t('common.edit')} {editing.order_no}</h3>
          <button onClick={onCancel}><X className="w-4 h-4" /></button>
        </div>
        {editing.status === 'loaded' && (
          <div className="mb-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
            {t('van_sales.edit_loaded_warning')}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs font-semibold mb-1">{t('van_sales.vehicle')}</label>
            <select value={editing.form.vehicle_id} onChange={(e) => setEditing((p) => ({ ...p, form: { ...p.form, vehicle_id: e.target.value } }))}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm">
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">{t('van_sales.order_date')}</label>
            <input type="date" value={editing.form.order_date} onChange={(e) => setEditing((p) => ({ ...p, form: { ...p.form, order_date: e.target.value } }))}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm" />
          </div>
        </div>
        <div className="space-y-2 mb-2">
          {lines.map((line, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <select value={line.product_id} onChange={(e) => updateLine(idx, { product_id: e.target.value })}
                className="flex-1 min-w-0 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs">
                <option value="">{t('van_sales.select_item')}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" step="any" min="0" value={line.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} className="w-16 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs" />
              <input type="number" step="any" min="0" value={line.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} className="w-20 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs" />
              <button type="button" onClick={() => setEditing((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }))} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setEditing((p) => ({ ...p, lines: [...p.lines, emptyLine()] }))} className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline">+ {t('orders.add_item')}</button>
        </div>
        <div className="rounded-lg bg-[#F4F7FB] dark:bg-[#1A2A3D] p-2.5 text-xs mb-3 flex justify-between font-bold">
          <span>{t('pos.grand_total')}</span><span>{formatCurrency(grandTotal, currency)}</span>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold">{t('common.cancel')}</button>
          <button onClick={onSave} disabled={valid.length === 0} className="px-3 py-1.5 rounded-lg bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] text-xs font-bold disabled:opacity-50">{t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Van Stock tab
// ---------------------------------------------------------------------------

export function VanStockTab({ vehicles, currency, can }) {
  const { t } = useTranslation();
  const [vehicleId, setVehicleId] = useState('');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [adjustRow, setAdjustRow] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const load = () => {
    setLoading(true);
    const params = { from, to };
    if (vehicleId) params.vehicle_id = vehicleId;
    api.get('/van-stock', { params }).then(({ data }) => setRows(Array.isArray(data) ? data : [])).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(load, [vehicleId]);

  const openHistory = async (row) => {
    const { data } = await api.get('/van-stock/movements', { params: { vehicle_id: row.vehicle_id, product_id: row.product_id } });
    setHistory({ row, movements: Array.isArray(data) ? data : [] });
  };

  const submitAdjust = async () => {
    if (!adjustRow || !adjustQty) return;
    try {
      await api.post('/van-stock/adjust', {
        vehicle_id: adjustRow.vehicle_id, product_id: adjustRow.product_id,
        qty_change: Number(adjustQty), reason: adjustReason,
      });
      setAdjustRow(null); setAdjustQty(''); setAdjustReason('');
      load();
    } catch (err) {
      alert(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  return (
    <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-xs">
          <option value="">{t('van_sales.all_vehicles')}</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-xs" />
        <span className="text-xs">{t('reports.to')}</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-xs" />
        <button onClick={load} className="rounded-lg bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] px-3 py-1.5 text-xs font-bold">{t('reports.apply')}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
            <tr>
              <th className="px-2 py-2">{t('van_sales.vehicle')}</th>
              <th className="px-2 py-2">{t('reports.cols.product')}</th>
              <th className="px-2 py-2 text-right">{t('van_sales.opening_qty')}</th>
              <th className="px-2 py-2 text-right">{t('van_sales.loaded_qty')}</th>
              <th className="px-2 py-2 text-right">{t('van_sales.sold_qty')}</th>
              <th className="px-2 py-2 text-right">{t('van_sales.returned_qty')}</th>
              <th className="px-2 py-2 text-right">{t('van_sales.damaged_qty')}</th>
              <th className="px-2 py-2 text-right">{t('van_sales.missing_qty')}</th>
              <th className="px-2 py-2 text-right">{t('van_sales.available_qty')}</th>
              <th className="px-2 py-2 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="py-6 text-center text-[#5A6B82]">{t('common.loading')}</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={10} className="py-6 text-center text-[#5A6B82]">{t('reports.no_data')}</td></tr>}
            {!loading && rows.map((r, i) => (
              <tr key={i} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                <td className="px-2 py-2">{r.vehicle_name}</td>
                <td className="px-2 py-2">{r.product_name}</td>
                <td className="px-2 py-2 text-right">{r.opening_qty}</td>
                <td className="px-2 py-2 text-right">{r.loaded_qty}</td>
                <td className="px-2 py-2 text-right">{r.sold_qty}</td>
                <td className="px-2 py-2 text-right">{r.returned_qty}</td>
                <td className="px-2 py-2 text-right">{r.damaged_qty}</td>
                <td className="px-2 py-2 text-right">{r.missing_qty}</td>
                <td className="px-2 py-2 text-right font-bold">{r.available_qty}</td>
                <td className="px-2 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button title={t('van_sales.movement_history')} onClick={() => openHistory(r)} className="p-1 text-[#5A6B82] hover:text-[#0A4174]"><RefreshCw className="w-3.5 h-3.5" /></button>
                    {can('van_sales.manage_orders') && (
                      <button title={t('van_sales.stock_adjustment')} onClick={() => setAdjustRow(r)} className="p-1 text-[#5A6B82] hover:text-amber-600"><Pencil className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-sm">{history.row.vehicle_name} — {history.row.product_name}</h3>
              <button onClick={() => setHistory(null)}><X className="w-4 h-4" /></button>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D]"><tr><th className="text-left px-2 py-1">{t('common.date')}</th><th className="px-2 py-1">{t('inventory.qty_change')}</th><th className="px-2 py-1">{t('common.category')}</th></tr></thead>
              <tbody>
                {history.movements.map((m) => (
                  <tr key={m.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                    <td className="px-2 py-1">{(m.created_at || '').slice(0, 16)}</td>
                    <td className="px-2 py-1 text-center">{m.qty_change}</td>
                    <td className="px-2 py-1 capitalize">{m.movement_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adjustRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-sm">{t('van_sales.stock_adjustment')}</h3>
              <button onClick={() => setAdjustRow(null)}><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs mb-2">{adjustRow.vehicle_name} — {adjustRow.product_name}</p>
            <label className="block text-xs font-semibold mb-1">{t('inventory.qty_change')}</label>
            <input type="number" step="any" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} className="w-full mb-2 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm" />
            <label className="block text-xs font-semibold mb-1">{t('inventory.reason')}</label>
            <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} className="w-full mb-3 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdjustRow(null)} className="px-3 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold">{t('common.cancel')}</button>
              <button onClick={submitAdjust} className="px-3 py-1.5 rounded-lg bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] text-xs font-bold">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Return tab
// ---------------------------------------------------------------------------

function DayReturnTab({ vehicles, currency, settings, can }) {
  const { t } = useTranslation();
  const canManage = can('van_sales.manage_returns');
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState(null);

  const [form, setForm] = useState({ return_date: today(), vehicle_id: '', van_order_id: '', amount_collected: '', credit_amount: '', other_adjustment: '', adjustment_reason: '', notes: '' });
  const [loadedOrders, setLoadedOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [lineInputs, setLineInputs] = useState({});
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/day-returns').then(({ data }) => setReturns(Array.isArray(data) ? data : [])).catch(() => setReturns([])).finally(() => setLoading(false));
    api.get('/van-orders', { params: { status: 'loaded' } })
      .then(({ data }) => setLoadedOrders(Array.isArray(data) ? data : [])).catch(() => setLoadedOrders([]));
  };
  useEffect(load, []);

  useEffect(() => {
    if (form.vehicle_id) {
      api.get('/van-orders', { params: { vehicle_id: form.vehicle_id, status: 'loaded' } })
        .then(({ data }) => setLoadedOrders(Array.isArray(data) ? data : [])).catch(() => setLoadedOrders([]));
    } else {
      api.get('/van-orders', { params: { status: 'loaded' } })
        .then(({ data }) => setLoadedOrders(Array.isArray(data) ? data : [])).catch(() => setLoadedOrders([]));
    }
  }, [form.vehicle_id]);

  useEffect(() => {
    if (!form.van_order_id) { setOrderItems([]); setLineInputs({}); return; }
    api.get(`/van-orders/${form.van_order_id}`).then(({ data }) => {
      setOrderItems(data.items || []);
      const init = {};
      (data.items || []).forEach((it) => { init[it.product_id] = { returned_qty: '', damaged_qty: '', missing_qty: '' }; });
      setLineInputs(init);
    }).catch(() => {});
  }, [form.van_order_id]);

  const computedLines = useMemo(() => orderItems.map((it) => {
    const input = lineInputs[it.product_id] || {};
    const returnedQty = Number(input.returned_qty || 0);
    const damagedQty = Number(input.damaged_qty || 0);
    const missingQty = Number(input.missing_qty || 0);
    const loadedQty = Number(it.qty);
    const soldQty = Math.max(0, loadedQty - returnedQty - damagedQty - missingQty);
    return { ...it, returnedQty, damagedQty, missingQty, soldQty, soldValue: soldQty * it.unit_price };
  }), [orderItems, lineInputs]);

  const totals = useMemo(() => {
    const soldValue = computedLines.reduce((s, l) => s + l.soldValue, 0);
    const returnedValue = computedLines.reduce((s, l) => s + l.returnedQty * l.unit_price, 0);
    const damagedValue = computedLines.reduce((s, l) => s + l.damagedQty * l.unit_price, 0);
    const missingValue = computedLines.reduce((s, l) => s + l.missingQty * l.unit_price, 0);
    const collected = Number(form.amount_collected || 0);
    const credit = Number(form.credit_amount || 0);
    const other = Number(form.other_adjustment || 0);
    const outstanding = soldValue - collected - credit - other;
    return { soldValue, returnedValue, damagedValue, missingValue, outstanding };
  }, [computedLines, form.amount_collected, form.credit_amount, form.other_adjustment]);

  const updateInput = (productId, field, value) => {
    setLineInputs((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));
  };

  const resetForm = () => {
    setForm({ return_date: today(), vehicle_id: '', van_order_id: '', amount_collected: '', credit_amount: '', other_adjustment: '', adjustment_reason: '', notes: '' });
    setOrderItems([]); setLineInputs({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!form.van_order_id) { setFormError(t('van_sales.select_order_error')); return; }
    setSubmitting(true);
    const payload = {
      uuid: newUuid(),
      van_order_id: form.van_order_id,
      return_date: form.return_date,
      amount_collected: Number(form.amount_collected || 0),
      credit_amount: Number(form.credit_amount || 0),
      other_adjustment: Number(form.other_adjustment || 0),
      adjustment_reason: form.adjustment_reason || null,
      notes: form.notes || null,
      items: computedLines.map((l) => ({ product_id: l.product_id, returned_qty: l.returnedQty, damaged_qty: l.damagedQty, missing_qty: l.missingQty })),
    };
    try {
      await api.post('/day-returns', payload);
      setFormSuccess(t('van_sales.return_created'));
      resetForm();
      load();
      setTimeout(() => setFormSuccess(''), 3000);
    } catch (err) {
      if (!err.response) {
        await enqueueOutboxItem({ client_id: payload.uuid, type: 'day_return', payload });
        refreshPendingCount();
        setFormSuccess(t('van_sales.order_queued_offline'));
        resetForm();
        setTimeout(() => setFormSuccess(''), 4000);
      } else {
        setFormError(err?.response?.data?.error || t('van_sales.save_failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const cancelReturn = async (id) => {
    const reason = window.prompt(t('van_sales.cancel_reason_prompt'));
    if (reason === null) return;
    try {
      await api.post(`/day-returns/${id}/cancel`, { reason });
      load();
    } catch (err) {
      alert(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  const deleteReturn = async (id) => {
    if (!window.confirm(t('van_sales.delete_confirm'))) return;
    try {
      await api.delete(`/day-returns/${id}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {canManage && (
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
            <h3 className="mb-3 font-bold text-sm flex items-center gap-1.5 text-[#0A4174] dark:text-[#4A8CD2]"><Plus className="w-4 h-4" /> {t('van_sales.new_return')}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t('van_sales.return_date')}</label>
                  <input type="date" value={form.return_date} onChange={(e) => setForm((f) => ({ ...f, return_date: e.target.value }))} className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Filter by Vehicle (Optional)</label>
                  <select value={form.vehicle_id} onChange={(e) => setForm((f) => ({ ...f, vehicle_id: e.target.value, van_order_id: '' }))} className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm">
                    <option value="">-- All Vehicles / Orders --</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}{v.registration_no ? ` (${v.registration_no})` : ''}</option>)}
                  </select>
                </div>
              </div>
              {/* Van Stock Trip Loading Reference */}
              <div>
                <label className="block text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] mb-1">
                  Choose Van Stock Loading ID (Trip / Vehicle) *
                </label>
                <select
                  required
                  value={form.van_order_id}
                  onChange={(e) => setForm((f) => ({ ...f, van_order_id: e.target.value }))}
                  className="w-full rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-[#121E2C] px-3 py-2 text-xs font-semibold shadow-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Van Trip ID (Order / Vehicle) --</option>
                  {loadedOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_no} ({o.order_date}) • {o.van_number || o.vehicle_name} {o.mapped_order_no ? `• Order #${o.mapped_order_no}` : ''} {o.employee_name ? `• Staff: ${o.employee_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Quantities: Loaded & Returned (Sold is auto-calculated) */}
              {computedLines.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Product Day Return & Sales Quantity
                  </label>
                  <div className="overflow-x-auto border border-[#DCE5EF] dark:border-[#22354B] rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
                        <tr>
                          <th className="px-2.5 py-2 font-semibold">Product</th>
                          <th className="px-2.5 py-2 text-right font-semibold">Loaded Qty</th>
                          <th className="px-2.5 py-2 text-center font-semibold text-blue-600 dark:text-blue-400">Return Qty</th>
                          <th className="px-2.5 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">Sold Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computedLines.map((l) => (
                          <tr key={l.product_id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                            <td className="px-2.5 py-2 font-medium">{l.product_name}</td>
                            <td className="px-2.5 py-2 text-right font-bold text-slate-700 dark:text-slate-300">{l.qty}</td>
                            <td className="px-2.5 py-2 text-center">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={l.qty}
                                placeholder="0"
                                value={lineInputs[l.product_id]?.returned_qty ?? ''}
                                onChange={(e) => updateInput(l.product_id, 'returned_qty', e.target.value)}
                                className="w-20 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-[#121E2C] px-2 py-1 text-xs text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-2.5 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {l.soldQty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Total Sold Value & Amount Collected */}
              {computedLines.length > 0 && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-3 space-y-1 text-xs">
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">Total Sold Value:</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totals.soldValue, currency)}
                    </span>
                  </div>
                </div>
              )}

              {/* Amount Collected Input */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Cash / Amount Collected from Van *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-xs">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter collected amount"
                    value={form.amount_collected}
                    onChange={(e) => setForm((f) => ({ ...f, amount_collected: e.target.value }))}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent pl-7 pr-3 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <textarea rows={1} placeholder={t('orders.notes')} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-sm" />

              {formError && <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">{formError}</div>}
              {formSuccess && <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">{formSuccess}</div>}

              <button type="submit" disabled={!form.van_order_id || submitting} className="w-full rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] py-2 text-xs font-bold disabled:opacity-50">
                {submitting ? t('common.loading') : t('van_sales.create_return')}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className={canManage ? 'lg:col-span-6' : 'lg:col-span-12'}>
        <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
                <tr>
                  <th className="px-2 py-2">{t('van_sales.return_no')}</th>
                  <th className="px-2 py-2">{t('common.date')}</th>
                  <th className="px-2 py-2">{t('van_sales.vehicle')}</th>
                  <th className="px-2 py-2">Assigned Staff</th>
                  <th className="px-2 py-2 text-right">{t('van_sales.total_sold_value')}</th>
                  <th className="px-2 py-2">{t('common.status')}</th>
                  <th className="px-2 py-2 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="py-6 text-center text-[#5A6B82]">{t('common.loading')}</td></tr>}
                {!loading && returns.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-[#5A6B82]">{t('reports.no_data')}</td></tr>}
                {!loading && returns.map((r) => (
                  <tr key={r.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                    <td className="px-2 py-2">
                      <div className="font-mono font-bold text-[#0A4174] dark:text-[#4A8CD2]">{r.return_no}</div>
                      <div className="text-[10px] text-[#5A6B82] font-mono">Load: {r.order_no}</div>
                    </td>
                    <td className="px-2 py-2">{r.return_date}</td>
                    <td className="px-2 py-2">{r.vehicle_name}</td>
                    <td className="px-2 py-2">
                      <div className="text-xs font-medium text-[#1C2736] dark:text-[#F1F5F9]">{r.employee_name || '—'}</div>
                      {r.customer_name && <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">Cust: {r.customer_name}</div>}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">{formatCurrency(r.total_sold_value, currency)}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_BADGE[r.status] || ''}`}>{r.status}</span>
                      {r.day_closing_id && <span className="ml-1 inline-flex items-center"><Lock className="w-3 h-3 text-[#5A6B82]" /></span>}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <button title={t('orders.view_details')} onClick={() => setViewing(r)} className="p-1 text-[#5A6B82] hover:text-[#0A4174]"><Eye className="w-3.5 h-3.5" /></button>
                        <button title={t('orders.print_slip')} onClick={async () => { const { data } = await api.get(`/day-returns/${r.id}`); printDayReturn(data, settings); }} className="p-1 text-[#5A6B82] hover:text-[#0A4174]"><Printer className="w-3.5 h-3.5" /></button>
                        {canManage && r.status === 'completed' && !r.day_closing_id && (
                          <button title={t('van_sales.cancel_return')} onClick={() => cancelReturn(r.id)} className="p-1 text-red-500 hover:text-red-700"><Ban className="w-3.5 h-3.5" /></button>
                        )}
                        {canManage && r.status === 'cancelled' && (
                          <button title={t('common.delete')} onClick={() => deleteReturn(r.id)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewing && <DayReturnViewModal dayReturn={viewing} currency={currency} onClose={() => setViewing(null)} onPrint={() => printDayReturn(viewing, settings)} t={t} />}
    </div>
  );
}

function DayReturnViewModal({ dayReturn, currency, onClose, onPrint, t }) {
  const [full, setFull] = useState(dayReturn);
  useEffect(() => { api.get(`/day-returns/${dayReturn.id}`).then(({ data }) => setFull(data)).catch(() => {}); }, [dayReturn.id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-sm">{full.return_no}</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <table className="w-full text-xs mb-3">
          <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D]">
            <tr><th className="text-left px-2 py-1">{t('receipt.item')}</th><th className="px-2 py-1">{t('van_sales.loaded_qty')}</th><th className="px-2 py-1">{t('van_sales.sold_qty')}</th><th className="px-2 py-1">{t('van_sales.returned_qty')}</th><th className="px-2 py-1">{t('van_sales.damaged_qty')}</th><th className="px-2 py-1">{t('van_sales.missing_qty')}</th></tr>
          </thead>
          <tbody>
            {(full.items || []).map((it) => (
              <tr key={it.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                <td className="px-2 py-1">{it.product_name}</td>
                <td className="px-2 py-1 text-center">{it.loaded_qty}</td>
                <td className="px-2 py-1 text-center">{it.sold_qty}</td>
                <td className="px-2 py-1 text-center">{it.returned_qty}</td>
                <td className="px-2 py-1 text-center">{it.damaged_qty}</td>
                <td className="px-2 py-1 text-center">{it.missing_qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 text-xs mb-3">
          <div className="flex justify-between"><span>{t('van_sales.total_sold_value')}</span><span className="font-bold">{formatCurrency(full.total_sold_value, currency)}</span></div>
          <div className="flex justify-between"><span>{t('van_sales.amount_collected')}</span><span>{formatCurrency(full.amount_collected, currency)}</span></div>
          <div className="flex justify-between"><span>{t('van_sales.credit_amount')}</span><span>{formatCurrency(full.credit_amount, currency)}</span></div>
          <div className="flex justify-between"><span>{t('van_sales.outstanding_amount')}</span><span className="font-bold">{formatCurrency(full.outstanding_amount, currency)}</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onPrint} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold"><Printer className="w-3.5 h-3.5" /> {t('orders.print_slip')}</button>
          <button onClick={onClose} className="px-3 py-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold">{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Closing tab
// ---------------------------------------------------------------------------

function DayClosingTab({ vehicles, currency, settings, can }) {
  const { t } = useTranslation();
  const canManage = can('van_sales.manage_day_closing');
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState(today());
  const [preview, setPreview] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [closings, setClosings] = useState([]);
  const [error, setError] = useState('');

  const loadClosings = () => {
    api.get('/day-closings').then(({ data }) => setClosings(Array.isArray(data) ? data : [])).catch(() => {});
  };
  useEffect(loadClosings, []);

  const runPreview = async () => {
    if (!vehicleId) return;
    setError('');
    try {
      const { data } = await api.get('/day-closings/preview', { params: { vehicle_id: vehicleId, date } });
      setPreview(data);
    } catch (err) {
      setError(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  const closeDay = async () => {
    try {
      await api.post('/day-closings', { vehicle_id: vehicleId, date, override_reason: overrideReason || null });
      setPreview(null);
      setOverrideReason('');
      loadClosings();
    } catch (err) {
      setError(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  const reopen = async (id) => {
    if (!window.confirm(t('van_sales.reopen_confirm'))) return;
    try {
      await api.post(`/day-closings/${id}/reopen`);
      loadClosings();
    } catch (err) {
      alert(err?.response?.data?.error || t('van_sales.save_failed'));
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
          <h3 className="mb-3 font-bold text-sm text-[#0A4174] dark:text-[#4A8CD2]">{t('van_sales.day_closing')}</h3>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setPreview(null); }} className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-xs">
              <option value="">{t('van_sales.select_vehicle')}</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPreview(null); }} className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1.5 text-xs" />
            <button onClick={runPreview} disabled={!vehicleId} className="rounded-lg bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] px-3 py-1.5 text-xs font-bold disabled:opacity-50">{t('van_sales.preview')}</button>
          </div>

          {error && <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400">{error}</div>}

          {preview && (
            <div className="space-y-3">
              {preview.blocking_orders.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <div className="font-bold flex items-center gap-1 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> {t('van_sales.blocking_orders_warning')}</div>
                  <ul className="list-disc list-inside">
                    {preview.blocking_orders.map((o) => <li key={o.id}>{o.order_no}</li>)}
                  </ul>
                  <input placeholder={t('van_sales.override_reason')} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="mt-2 w-full rounded-lg border border-amber-300 bg-transparent px-2 py-1 text-xs" />
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <Stat label={t('van_sales.total_sold_value')} value={formatCurrency(preview.total_sold_value, currency)} />
                <Stat label={t('van_sales.total_cash_collected')} value={formatCurrency(preview.total_cash_collected, currency)} />
                <Stat label={t('van_sales.total_credit')} value={formatCurrency(preview.total_credit, currency)} />
                <Stat label={t('van_sales.amount_difference')} value={formatCurrency(preview.amount_difference, currency)} highlight={Math.abs(preview.amount_difference) > 0.009} />
              </div>
              <button
                onClick={closeDay}
                disabled={preview.return_ids.length === 0 || (preview.blocking_orders.length > 0 && !overrideReason)}
                className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" /> {t('van_sales.close_day')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
              <tr>
                <th className="px-2 py-2">{t('van_sales.closing_no')}</th>
                <th className="px-2 py-2">{t('common.date')}</th>
                <th className="px-2 py-2">{t('van_sales.vehicle')}</th>
                <th className="px-2 py-2 text-right">{t('van_sales.total_sold_value')}</th>
                <th className="px-2 py-2">{t('common.status')}</th>
                <th className="px-2 py-2 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {closings.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-[#5A6B82]">{t('reports.no_data')}</td></tr>}
              {closings.map((c) => (
                <tr key={c.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                  <td className="px-2 py-2 font-mono">{c.closing_no}</td>
                  <td className="px-2 py-2">{c.closing_date}</td>
                  <td className="px-2 py-2">{c.vehicle_name}</td>
                  <td className="px-2 py-2 text-right font-semibold">{formatCurrency(c.total_sold_value, currency)}</td>
                  <td className="px-2 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_BADGE[c.status] || ''}`}>{c.status}</span></td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-1">
                      <button title={t('orders.print_slip')} onClick={async () => { const { data } = await api.get(`/day-closings/${c.id}`); printDayClosing(data, settings); }} className="p-1 text-[#5A6B82] hover:text-[#0A4174]"><Printer className="w-3.5 h-3.5" /></button>
                      {canManage && c.status === 'closed' && (
                        <button title={t('van_sales.reopen')} onClick={() => reopen(c.id)} className="p-1 text-amber-600 hover:text-amber-800"><Unlock className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-md p-3 ${highlight ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-[#F4F7FB] dark:bg-[#1A2A3D]'}`}>
      <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}
