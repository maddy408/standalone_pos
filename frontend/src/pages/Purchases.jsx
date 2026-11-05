import { useEffect, useState } from 'react';
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
  Truck
} from 'lucide-react';

export default function Purchases() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ product_id: '', qty: 1, unit_price: '', serials_text: '' }]);
  const [paidAmount, setPaidAmount] = useState('');
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});

  const currency = settings?.currency_symbol || '₹';

  const load = () => api.get('/purchases').then(({ data }) => setPurchases(data));

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
        // If product_id changed, map the purchase price automatically!
        if (patch.product_id !== undefined && patch.product_id !== '') {
          const prod = products.find((p) => p.id === Number(patch.product_id));
          if (prod && (r.unit_price === '' || r.unit_price === 0)) {
            updated.unit_price = prod.purchase_price ? String(Number(prod.purchase_price)) : '0';
          }
        }
        return updated;
      })
    );
  };

  const addRow = () => setItems((rows) => [...rows, { product_id: '', qty: 1, unit_price: '', serials_text: '' }]);
  const removeRow = (i) => setItems((rows) => rows.filter((_, idx) => idx !== i));

  const selectedProduct = (id) => products.find((p) => p.id === Number(id));

  const grandTotal = items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.unit_price || 0),
    0
  );

  // Auto set paidAmount to grandTotal if empty or matching previous total
  const handleAutoFillPaid = () => {
    setPaidAmount(String(grandTotal.toFixed(2)));
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
          discount_amount: 0,
          tax_amount: 0,
          serials,
        };
      });

    if (payloadItems.length === 0) {
      setError('Add at least one product with valid details');
      return;
    }

    try {
      await api.post('/purchases', {
        supplier_id: Number(supplierId),
        items: payloadItems,
        paid_amount: paidAmount === '' ? grandTotal : Number(paidAmount),
      });
      setSupplierId('');
      setItems([{ product_id: '', qty: 1, unit_price: '', serials_text: '' }]);
      setPaidAmount('');
      load();
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save purchase');
    }
  };

  const openReturn = async (purchase) => {
    const { data } = await api.get(`/purchases/${purchase.id}`);
    setReturnQtys(Object.fromEntries(data.items.map((it) => [it.id, 0])));
    setReturning(data);
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
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
            {t('purchases.title')}
          </h1>
          <p className="text-xs text-[#5A6B82]">Record stock procurement, invoice vouchers & returns</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
              <tr>
                <th className="px-3.5 py-2.5">Voucher #</th>
                <th className="px-3.5 py-2.5">{t('purchases.supplier')}</th>
                <th className="px-3.5 py-2.5 text-right">{t('purchases.grand_total')}</th>
                <th className="px-3.5 py-2.5 text-right">{t('purchases.paid_amount')}</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/40 transition-colors">
                  <td className="px-3.5 py-2.5 font-mono font-medium">{p.purchase_no}</td>
                  <td className="px-3.5 py-2.5">{p.supplier_name}</td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-[#1C2736] dark:text-[#F1F5F9]">
                    {formatCurrency(p.grand_total, currency)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-emerald-600 font-semibold">
                    {formatCurrency(p.paid_amount, currency)}
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    <button
                      onClick={() => openReturn(p)}
                      title="Return items"
                      className="p-1.5 text-[#0A4174] hover:text-[#062E52] dark:text-[#4A8CD2] dark:hover:text-[#6BA3E0] hover:bg-[#E2EDF8] dark:bg-[#1A2A3D] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[#5A6B82] dark:text-[#94A3B8]">
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

      {/* New Purchase Form */}
      <div className="rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4 self-start">
        <h2 className="font-bold text-sm flex items-center gap-2 pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <Plus className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
          {t('purchases.new_purchase')}
        </h2>

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
              return (
                <div key={i} className="space-y-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/50 dark:bg-[#1A2A3D]/30 p-2.5">
                  <select
                    required
                    value={it.product_id}
                    onChange={(e) => updateItem(i, { product_id: e.target.value })}
                    className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2 py-1.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  >
                    <option value="">{t('purchases.select_product')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.purchase_price ? `(${formatCurrency(p.purchase_price, currency)})` : ''}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    {!product?.track_serial && (
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={it.qty}
                          onChange={(e) => updateItem(i, { qty: e.target.value })}
                          placeholder="Qty"
                          className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2 py-1.5 text-center focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="number"
                        step="any"
                        value={it.unit_price}
                        onChange={(e) => updateItem(i, { unit_price: e.target.value })}
                        placeholder="Price / Unit"
                        className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2 py-1.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-semibold"
                      />
                    </div>
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
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={grandTotal.toFixed(2)}
                className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 font-bold text-emerald-600 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold py-2.5 transition-colors shadow-sm text-xs mt-2"
          >
            Save Purchase
          </button>
        </form>
      </div>
    </div>
  );
}
