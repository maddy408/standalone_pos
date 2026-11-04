import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import {
  ShoppingBag,
  Plus,
  Trash2,
  X,
  RotateCcw,
  CheckCircle2,
  DollarSign
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
    if (!settings?.business_type) return;
    api.get('/products', { params: { business_type: settings.business_type } }).then(({ data }) => setProducts(data));
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
      {/* Purchases List */}
      <div className="lg:col-span-2 space-y-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            {t('purchases.title')}
          </h1>
          <p className="text-xs text-slate-500">Record stock procurement, invoice vouchers & returns</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3.5 py-2.5">Voucher #</th>
                <th className="px-3.5 py-2.5">{t('purchases.supplier')}</th>
                <th className="px-3.5 py-2.5 text-right">{t('purchases.grand_total')}</th>
                <th className="px-3.5 py-2.5 text-right">{t('purchases.paid_amount')}</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-3.5 py-2.5 font-mono font-medium">{p.purchase_no}</td>
                  <td className="px-3.5 py-2.5">{p.supplier_name}</td>
                  <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                    {currency}{Number(p.grand_total).toFixed(2)}
                  </td>
                  <td className="px-3.5 py-2.5 text-right text-emerald-600 font-semibold">
                    {currency}{Number(p.paid_amount).toFixed(2)}
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    <button
                      onClick={() => openReturn(p)}
                      title="Return items"
                      className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
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
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="mb-2 font-bold text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              Return Items — {returning.purchase_no}
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {returning.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <div>
                    <span className="font-semibold block">{it.product_name}</span>
                    <span className="text-slate-400">Purchased Qty: {it.qty}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={it.qty}
                    value={returnQtys[it.id] || 0}
                    onChange={(e) => setReturnQtys({ ...returnQtys, [it.id]: e.target.value })}
                    className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-center"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 text-xs">
              <button onClick={submitReturn} className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 shadow-sm">
                Confirm Return
              </button>
              <button onClick={() => setReturning(null)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Form */}
      <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 self-start">
        <h2 className="font-bold text-sm flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Plus className="w-4 h-4 text-amber-500" />
          {t('purchases.new_purchase')}
        </h2>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-600 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              Select Supplier *
            </label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
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
            <label className="block font-semibold text-slate-700 dark:text-slate-300">
              Purchased Items
            </label>
            {items.map((it, i) => {
              const product = selectedProduct(it.product_id);
              return (
                <div key={i} className="space-y-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-2.5">
                  <select
                    required
                    value={it.product_id}
                    onChange={(e) => updateItem(i, { product_id: e.target.value })}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">{t('purchases.select_product')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.purchase_price ? `(${currency}${Number(p.purchase_price).toFixed(2)})` : ''}
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
                          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-center focus:ring-1 focus:ring-amber-500 focus:outline-none"
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
                        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none font-semibold"
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
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono text-[11px]"
                    />
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addRow}
              className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('purchases.add_item')}
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span>{t('purchases.grand_total')}:</span>
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {currency}{grandTotal.toFixed(2)}
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {t('purchases.paid_amount')} ({currency})
                </label>
                <button
                  type="button"
                  onClick={handleAutoFillPaid}
                  className="text-[10px] text-amber-600 hover:underline"
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
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 font-bold text-emerald-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 transition-colors shadow-sm text-xs mt-2"
          >
            Save Purchase
          </button>
        </form>
      </div>
    </div>
  );
}
