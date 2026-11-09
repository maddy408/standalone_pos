import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import {
  ShoppingBag,
  Plus,
  Trash2,
  X,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  Truck,
  Search,
  Eye,
  Printer,
  History,
  Edit2,
  CreditCard,
} from 'lucide-react';

export default function Purchases() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ product_id: '', qty: 1, unit_price: '', mrp: '', discount: 0, serials_text: '' }]);
  const [paidAmount, setPaidAmount] = useState('');
  const [error, setError] = useState('');
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [payingPurchase, setPayingPurchase] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', notes: '' });
  const [payingError, setPayingError] = useState('');
  const [payingLoading, setPayingLoading] = useState(false);
  const [returning, setReturning] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [historyPurchase, setHistoryPurchase] = useState(null);

  const currency = settings?.currency_symbol || '₹';

  const load = () => {
    api.get('/purchases')
      .then(({ data }) => setPurchases(Array.isArray(data) ? data : []))
      .catch(() => setPurchases([]));
  };

  const loadProducts = () => {
    const params = settings?.business_type ? { business_type: settings.business_type } : {};
    api.get('/products', { params }).then(async ({ data }) => {
      let list = Array.isArray(data) ? data : [];
      if (list.length === 0 && settings?.business_type) {
        try {
          const allRes = await api.get('/products');
          if (Array.isArray(allRes.data) && allRes.data.length > 0) list = allRes.data;
        } catch {}
      }
      setProducts(list);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    api.get('/suppliers').then(({ data }) => setSuppliers(data));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [settings?.business_type]);

  const updateItem = (index, patch) => {
    setItems((rows) =>
      rows.map((r, idx) => {
        if (idx !== index) return r;
        const updated = { ...r, ...patch };
        // If product_id changed, map the purchase price, mrp automatically!
        if (patch.product_id !== undefined && patch.product_id !== '') {
          const prod = products.find((p) => p.id === Number(patch.product_id));
          if (prod) {
            updated.unit_price = prod.purchase_price ? String(Number(prod.purchase_price)) : '0';
            updated.mrp = prod.mrp ? String(Number(prod.mrp)) : (prod.selling_price ? String(Number(prod.selling_price)) : '0');
            updated.discount = 0;
          }
        }
        return updated;
      })
    );
  };

  const addRow = () => setItems((rows) => [...rows, { product_id: '', qty: 1, unit_price: '', mrp: '', discount: 0, serials_text: '' }]);
  const removeRow = (i) => setItems((rows) => rows.filter((_, idx) => idx !== i));

  const selectedProduct = (id) => products.find((p) => p.id === Number(id));

  const grandTotal = items.reduce(
    (s, it) => {
      const q = Number(it.qty || 0);
      const rate = Number(it.unit_price || 0);
      const disc = Number(it.discount || 0);
      const lineSubtotal = Math.max(0, (q * rate) - disc);
      return s + lineSubtotal;
    },
    0
  );

  // Auto set paidAmount to grandTotal if empty or matching previous total
  const filteredPurchases = useMemo(() => {
    if (!search.trim()) return purchases;
    const term = search.toLowerCase().trim();
    return purchases.filter((p) => {
      const vNo = (p.purchase_no || '').toLowerCase();
      const sName = (p.supplier_name || '').toLowerCase();
      return vNo.includes(term) || sName.includes(term);
    });
  }, [purchases, search]);

  const handleAutoFillPaid = () => {
    setPaidAmount(String(grandTotal.toFixed(2)));
  };

  const startEdit = async (p) => {
    setError('');
    try {
      const { data } = await api.get(`/purchases/${p.id}`);
      setEditingPurchase(data);
      setSupplierId(String(data.supplier_id));
      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(
          data.items.map((it) => {
            let serials_text = '';
            if (it.serials) {
              try {
                const parsed = typeof it.serials === 'string' ? JSON.parse(it.serials) : it.serials;
                if (Array.isArray(parsed)) {
                  serials_text = parsed.map((s) => s.imei1 || s.serial_no || s).filter(Boolean).join(', ');
                }
              } catch {}
            }
            return {
              product_id: String(it.product_id),
              qty: it.qty,
              unit_price: String(it.unit_price),
              mrp: '',
              discount: it.discount_amount || 0,
              serials_text,
            };
          })
        );
      } else {
        setItems([{ product_id: '', qty: 1, unit_price: '', mrp: '', discount: 0, serials_text: '' }]);
      }
      setPaidAmount(String(data.paid_amount || 0));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load purchase for edit');
    }
  };

  const cancelEdit = () => {
    setEditingPurchase(null);
    setSupplierId('');
    setItems([{ product_id: '', qty: 1, unit_price: '', mrp: '', discount: 0, serials_text: '' }]);
    setPaidAmount('');
    setError('');
  };

  const openPayModal = (p) => {
    setPayingPurchase(p);
    setPayForm({
      amount: String(p.balance_amount || ''),
      payment_method: 'cash',
      notes: `Payment for ${p.purchase_no}`,
    });
    setPayingError('');
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!payingPurchase) return;
    setPayingError('');
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) {
      setPayingError('Please enter a valid payment amount greater than 0');
      return;
    }
    const maxDue = Number(payingPurchase.balance_amount || 0);
    if (amt > maxDue) {
      setPayingError(`Amount cannot exceed current due balance of ${formatCurrency(maxDue, currency)}`);
      return;
    }
    setPayingLoading(true);
    try {
      await api.post(`/purchases/${payingPurchase.id}/pay`, {
        amount: amt,
        payment_method: payForm.payment_method,
        notes: payForm.notes,
      });
      setPayingPurchase(null);
      load();
      api.get('/suppliers').then(({ data }) => setSuppliers(data));
    } catch (err) {
      setPayingError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setPayingLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }

    const payloadItems = items
      .filter((it) => it.product_id)
      .map((it) => {
        const product = selectedProduct(it.product_id);
        const serials = product?.track_serial
          ? it.serials_text
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((imei1) => ({ imei1 }))
          : [];
        return {
          product_id: Number(it.product_id),
          qty: serials.length || Number(it.qty || 1),
          unit_price: Number(it.unit_price || 0),
          discount_amount: Number(it.discount || 0),
          tax_amount: 0,
          serials,
        };
      });

    if (payloadItems.length === 0) {
      setError('Add at least one product with valid details');
      return;
    }

    try {
      if (editingPurchase) {
        await api.put(`/purchases/${editingPurchase.id}`, {
          supplier_id: Number(supplierId),
          items: payloadItems,
          paid_amount: paidAmount === '' ? grandTotal : Number(paidAmount),
        });
      } else {
        await api.post('/purchases', {
          supplier_id: Number(supplierId),
          items: payloadItems,
          paid_amount: paidAmount === '' ? grandTotal : Number(paidAmount),
        });
      }
      setEditingPurchase(null);
      setSupplierId('');
      setItems([{ product_id: '', qty: 1, unit_price: '', serials_text: '' }]);
      setPaidAmount('');
      load();
      loadProducts();
      api.get('/suppliers').then(({ data }) => setSuppliers(data));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save purchase');
    }
  };

  const deletePurchase = async (p) => {
    if (!confirm(`Are you sure you want to cancel and delete purchase voucher "${p.purchase_no}"? Stock will be reversed.`)) return;
    try {
      await api.delete(`/purchases/${p.id}`);
      load();
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete purchase');
    }
  };

  const printPurchase = (p) => {
    const win = window.open('', '_blank', 'width=700,height=600');
    if (!win) return;
    const html = `
      <html>
        <head>
          <title>Purchase Voucher ${p.purchase_no}</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 650px; margin: 0 auto; }
            h2 { text-align: center; margin-bottom: 4px; }
            hr { border: none; border-top: 1px dashed #333; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th, td { padding: 4px 0; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h2>${settings?.company_name || 'My Business'}</h2>
          <div style="text-align: center; font-size: 12px;">PURCHASE INVOICE VOUCHER</div>
          <hr />
          <div>Voucher No: <b>${p.purchase_no}</b></div>
          <div>Supplier: ${p.supplier_name || 'N/A'}</div>
          <div>Date: ${new Date(p.created_at).toLocaleString()}</div>
          <hr />
          <table>
            <thead><tr><th align="left">Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Total</th></tr></thead>
            <tbody>
              ${(p.items || []).map(it => `
                <tr>
                  <td>${it.product_name}</td>
                  <td class="right">${it.qty}</td>
                  <td class="right">${formatCurrency(it.unit_price, currency)}</td>
                  <td class="right">${formatCurrency(it.line_total || (it.qty * it.unit_price), currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <hr />
          <div class="right">Grand Total: <b>${formatCurrency(p.grand_total, currency)}</b></div>
          <div class="right">Paid Amount: <b>${formatCurrency(p.paid_amount, currency)}</b></div>
          <div class="right">Balance Due: <b>${formatCurrency(p.balance_amount || 0, currency)}</b></div>
          <hr />
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  };

  const openReturn = async (purchase) => {
    const { data } = await api.get(`/purchases/${purchase.id}`);
    setReturnQtys(Object.fromEntries(data.items.map((it) => [it.id, 0])));
    setReturning(data);
  };

  const openView = async (purchase) => {
    const { data } = await api.get(`/purchases/${purchase.id}`);
    setViewingPurchase(data);
  };

  const openHistory = async (purchase) => {
    const { data } = await api.get(`/purchases/${purchase.id}`);
    setHistoryPurchase(data);
  };

  const submitReturn = async () => {
    const returnItems = Object.entries(returnQtys)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([purchase_item_id, qty]) => ({ purchase_item_id: Number(purchase_item_id), qty: Number(qty) }));
    if (returnItems.length === 0) return;
    await api.post('/purchase-returns', { purchase_id: returning.id, items: returnItems });
    setReturning(null);
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Internal Navigation Tabs */}
      <div className="lg:col-span-3 flex items-center gap-2 pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
        <Link
          to="/purchases"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Purchases</span>
        </Link>
        <Link
          to="/suppliers"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Suppliers</span>
        </Link>
      </div>
      {/* Purchases List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
              {t('purchases.title')}
            </h1>
            <p className="text-xs text-[#5A6B82]">Record stock procurement, invoice vouchers & returns</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#5A6B82] dark:text-[#94A3B8] absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by voucher # or supplier..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
              <tr>
                <th className="px-3.5 py-2.5">Voucher #</th>
                <th className="px-3.5 py-2.5">{t('purchases.supplier')}</th>
                <th className="px-3.5 py-2.5 text-right">{t('purchases.grand_total')}</th>
                <th className="px-3.5 py-2.5 text-right">{t('purchases.paid_amount')}</th>
                <th className="px-3.5 py-2.5 text-right">Balance Due</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
              {filteredPurchases.map((p) => {
                const bal = Number(p.balance_amount || 0);
                return (
                  <tr key={p.id} className="hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-mono font-medium">{p.purchase_no}</td>
                    <td className="px-3.5 py-2.5">{p.supplier_name}</td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                      {formatCurrency(p.grand_total, currency)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-emerald-600 font-semibold">
                      {formatCurrency(p.paid_amount, currency)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      {bal > 0 ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-bold text-rose-600">{formatCurrency(bal, currency)}</span>
                          <button
                            onClick={() => openPayModal(p)}
                            title="Pay Due / Installment"
                            className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-xs flex items-center gap-0.5"
                          >
                            <CreditCard className="w-2.5 h-2.5" />
                            Pay
                          </button>
                        </div>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Paid
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => startEdit(p)}
                          title="Edit Purchase (Items & Quantities)"
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openView(p)}
                          title="View Purchase Details"
                          className="p-1.5 text-[#0A4174] dark:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => printPurchase(p)}
                          title="Print Purchase Voucher"
                          className="p-1.5 text-[#5A6B82] hover:text-[#1C2736] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openHistory(p)}
                          title="View Timeline / History"
                          className="p-1.5 text-[#5A6B82] hover:text-[#1C2736] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openReturn(p)}
                          title="Return items"
                          className="p-1.5 text-[#0A4174] hover:text-[#062E52] dark:text-[#4A8CD2] dark:hover:text-[#6BA3E0] hover:bg-[#E2EDF8] dark:bg-[#1A2A3D] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deletePurchase(p)}
                          title="Delete Purchase"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[#5A6B82] dark:text-[#94A3B8]">
                    No purchases recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Modal */}
      {returning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B]">
            <h3 className="mb-2 font-bold text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
              Return Items — {returning.purchase_no}
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {returning.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between p-2 rounded bg-[#F4F7FB] dark:bg-[#1A2A3D]/60 text-xs">
                  <div>
                    <span className="font-semibold block">{it.product_name}</span>
                    <span className="text-[#5A6B82] dark:text-[#94A3B8]">Purchased Qty: {it.qty}</span>
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
              <button onClick={submitReturn} className="flex-1 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold py-2 shadow-sm">
                Confirm Return
              </button>
              <button onClick={() => setReturning(null)} className="flex-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] py-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Form (Create or Edit) */}
      <div className="rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4 self-start">
        <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <h2 className="font-bold text-sm flex items-center gap-2">
            {editingPurchase ? (
              <>
                <Edit2 className="w-4 h-4 text-amber-500" />
                <span>Edit Purchase — {editingPurchase.purchase_no}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                <span>{t('purchases.new_purchase')}</span>
              </>
            )}
          </h2>
          {editingPurchase && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-[#5A6B82] hover:text-[#1C2736] dark:hover:text-white flex items-center gap-1 font-semibold"
            >
              <X className="w-3.5 h-3.5" />
              Cancel Edit
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-600 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              Select Supplier *
            </label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            >
              <option value="">-- Choose Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              Purchased Items
            </label>
            {items.map((it, i) => {
              const product = selectedProduct(it.product_id);
              const qty = Number(it.qty || 0);
              const unitPrice = Number(it.unit_price || 0);
              const discount = Number(it.discount || 0);
              const subtotal = Math.max(0, (qty * unitPrice) - discount);

              return (
                <div key={i} className="space-y-2 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/50 dark:bg-[#1A2A3D]/30 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      required
                      value={it.product_id}
                      onChange={(e) => updateItem(i, { product_id: e.target.value })}
                      className="flex-1 rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2 py-1.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    >
                      <option value="">{t('purchases.select_product')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.purchase_price ? `(${formatCurrency(p.purchase_price, currency)})` : ''}
                        </option>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="p-1.5 text-red-500 hover:text-red-700 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Grid for Qty, Unit Cost, MRP, Discount, and Subtotal */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px]">
                    <div>
                      <span className="text-[#5A6B82] font-semibold block text-[10px]">Qty</span>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={it.qty}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateItem(i, { qty: val === '' ? '' : val.replace(/^0+(?=\d)/, '') });
                        }}
                        placeholder="Qty"
                        className="w-full rounded border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-1.5 py-1 text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[#5A6B82] font-semibold block text-[10px]">Unit Cost</span>
                      <input
                        type="number"
                        step="any"
                        value={it.unit_price}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateItem(i, { unit_price: val === '' ? '' : val.replace(/^0+(?=\d)/, '') });
                        }}
                        placeholder="Cost"
                        className="w-full rounded border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-1.5 py-1 text-right font-semibold"
                      />
                    </div>
                    <div>
                      <span className="text-[#5A6B82] font-semibold block text-[10px]">MRP</span>
                      <input
                        type="number"
                        step="any"
                        value={it.mrp}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateItem(i, { mrp: val === '' ? '' : val.replace(/^0+(?=\d)/, '') });
                        }}
                        placeholder="MRP"
                        className="w-full rounded border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-1.5 py-1 text-right"
                      />
                    </div>
                    <div>
                      <span className="text-[#5A6B82] font-semibold block text-[10px]">Discount ({currency})</span>
                      <input
                        type="number"
                        step="any"
                        value={it.discount}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateItem(i, { discount: val === '' ? '' : val.replace(/^0+(?=\d)/, '') });
                        }}
                        placeholder="0"
                        className="w-full rounded border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-1.5 py-1 text-right text-emerald-600"
                      />
                    </div>
                    <div>
                      <span className="text-[#5A6B82] font-semibold block text-[10px]">Subtotal</span>
                      <div className="w-full rounded border border-transparent bg-[#E2EDF8] dark:bg-[#1A2A3D] px-1.5 py-1 text-right font-bold text-[#0A4174] dark:text-[#4A8CD2] truncate">
                        {formatCurrency(subtotal, currency)}
                      </div>
                    </div>
                  </div>

                  {product?.track_serial && (
                    <input
                      value={it.serials_text}
                      onChange={(e) => updateItem(i, { serials_text: e.target.value })}
                      placeholder="Comma separated IMEIs (e.g. 123456789012345, 987654321098765)"
                      className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2 py-1.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-mono text-[11px]"
                    />
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="text-xs text-[#0A4174] dark:text-[#4A8CD2] font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('purchases.add_item')}
            </button>
          </div>

          <div className="pt-2 border-t border-[#DCE5EF] dark:border-[#22354B] space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span>{t('purchases.grand_total')}:</span>
              <span className="text-base font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                {formatCurrency(grandTotal, currency)}
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-[#1C2736] dark:text-[#94A3B8]">
                  {t('purchases.paid_amount')} ({currency})
                </label>
                <button
                  type="button"
                  onClick={handleAutoFillPaid}
                  className="text-[10px] text-[#0A4174] dark:text-[#4A8CD2] hover:underline"
                >
                  Pay Full Total
                </button>
              </div>
              <input
                type="number"
                step="any"
                value={paidAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setPaidAmount(val === '' ? '' : val.replace(/^0+(?=\d)/, ''));
                }}
                placeholder={grandTotal.toFixed(2)}
                className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 font-bold text-emerald-600 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className={`w-full rounded-lg text-white font-bold py-2.5 transition-colors shadow-sm text-xs mt-2 ${
              editingPurchase
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] dark:text-[#0B131E]'
            }`}
          >
            {editingPurchase ? 'Update Purchase & Stock' : 'Save Purchase'}
          </button>
        </form>
      </div>

      {/* View Purchase Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                Purchase Details: {viewingPurchase.purchase_no}
              </h3>
              <button onClick={() => setViewingPurchase(null)} className="text-[#5A6B82] hover:text-[#1C2736]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#5A6B82] block text-[10px]">Supplier</span>
                <span className="font-bold">{viewingPurchase.supplier_name}</span>
              </div>
              <div>
                <span className="text-[#5A6B82] block text-[10px]">Date</span>
                <span>{new Date(viewingPurchase.created_at).toLocaleString()}</span>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B]">
              <table className="w-full text-xs">
                <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Cost</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
                  {(viewingPurchase.items || []).map((it) => (
                    <tr key={it.id}>
                      <td className="p-2 font-medium">{it.product_name}</td>
                      <td className="p-2 text-right">{it.qty}</td>
                      <td className="p-2 text-right">{formatCurrency(it.unit_price, currency)}</td>
                      <td className="p-2 text-right font-bold">{formatCurrency(it.line_total || (it.qty * it.unit_price), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#DCE5EF] dark:border-[#22354B] text-xs font-bold">
              <span>Grand Total:</span>
              <span className="text-base text-[#0A4174] dark:text-[#4A8CD2]">{formatCurrency(viewingPurchase.grand_total, currency)}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => printPurchase(viewingPurchase)}
                className="flex-1 py-2 rounded-xl bg-[#0A4174] text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Voucher
              </button>
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Purchase Modal */}
      {historyPurchase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <History className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                Audit Timeline — {historyPurchase.purchase_no}
              </h3>
              <button onClick={() => setHistoryPurchase(null)} className="text-[#5A6B82] hover:text-[#1C2736]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#F4F7FB] dark:bg-[#1A2A3D]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                <div>
                  <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">Purchase Created & Stock Inwarded</div>
                  <div className="text-[10px] text-[#5A6B82]">{new Date(historyPurchase.created_at).toLocaleString()}</div>
                  <div className="text-[11px] text-[#5A6B82] mt-0.5">Supplier: {historyPurchase.supplier_name} • Paid: {formatCurrency(historyPurchase.paid_amount, currency)}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#F4F7FB] dark:bg-[#1A2A3D]">
                <ShoppingBag className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2] mt-0.5" />
                <div>
                  <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{historyPurchase.items?.length || 0} Products Cataloged</div>
                  <div className="text-[11px] text-[#5A6B82]">Products added into store available stock for billing.</div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHistoryPurchase(null)}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
            >
              Close History
            </button>
          </div>
        </div>
      )}

      {/* Pay Due / Installment Modal */}
      {payingPurchase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Record Supplier Payment
              </h3>
              <button onClick={() => setPayingPurchase(null)} className="text-[#5A6B82] hover:text-[#1C2736]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-[#F4F7FB] dark:bg-[#1A2A3D] p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#5A6B82]">Voucher No:</span>
                <span className="font-mono font-bold">{payingPurchase.purchase_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A6B82]">Supplier:</span>
                <span className="font-semibold">{payingPurchase.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A6B82]">Grand Total:</span>
                <span className="font-semibold">{formatCurrency(payingPurchase.grand_total, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A6B82]">Already Paid:</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(payingPurchase.paid_amount, currency)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#DCE5EF] dark:border-[#22354B] font-bold">
                <span className="text-rose-600">Current Due Balance:</span>
                <span className="text-rose-600 text-sm">{formatCurrency(payingPurchase.balance_amount || 0, currency)}</span>
              </div>
            </div>

            {payingError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-600 border border-red-200 dark:border-red-800">
                {payingError}
              </div>
            )}

            <form onSubmit={submitPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[#1C2736] dark:text-[#94A3B8]">
                  Payment Amount ({currency}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    max={payingPurchase.balance_amount || undefined}
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    placeholder="Enter amount (partial or full)"
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 font-bold text-emerald-600 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPayForm({ ...payForm, amount: String(payingPurchase.balance_amount || 0) })}
                    className="absolute right-2 top-2 text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded"
                  >
                    Pay Full Due
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#1C2736] dark:text-[#94A3B8]">
                  Payment Method
                </label>
                <select
                  value={payForm.payment_method}
                  onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                  className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="card">Debit / Credit Card</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#1C2736] dark:text-[#94A3B8]">
                  Notes / Reference
                </label>
                <input
                  type="text"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder="e.g. UTR # or Cheque # or remarks"
                  className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={payingLoading}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  {payingLoading ? 'Processing...' : 'Record Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setPayingPurchase(null)}
                  className="px-4 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
