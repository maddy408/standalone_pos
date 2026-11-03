import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';

export default function Purchases() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ product_id: '', qty: 1, unit_price: 0, serials_text: '' }]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});

  const load = () => api.get('/purchases').then(({ data }) => setPurchases(data));

  useEffect(() => {
    load();
    api.get('/suppliers').then(({ data }) => setSuppliers(data));
    api.get('/products').then(({ data }) => setProducts(data));
  }, []);

  const updateItem = (i, patch) => setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setItems((rows) => [...rows, { product_id: '', qty: 1, unit_price: 0, serials_text: '' }]);
  const removeRow = (i) => setItems((rows) => rows.filter((_, idx) => idx !== i));

  const selectedProduct = (id) => products.find((p) => p.id === Number(id));

  const grandTotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unit_price || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!supplierId) {
      setError('Select a supplier');
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
          qty: serials.length || Number(it.qty),
          unit_price: Number(it.unit_price),
          discount_amount: 0,
          tax_amount: 0,
          serials,
        };
      });

    try {
      await api.post('/purchases', { supplier_id: Number(supplierId), items: payloadItems, paid_amount: Number(paidAmount) });
      setSupplierId('');
      setItems([{ product_id: '', qty: 1, unit_price: 0, serials_text: '' }]);
      setPaidAmount(0);
      load();
      api.get('/products').then(({ data }) => setProducts(data));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save purchase');
    }
  };

  const currency = settings?.currency_symbol || '₹';

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
      <div className="lg:col-span-2">
        <h1 className="mb-3 text-xl font-bold">{t('purchases.title')}</h1>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t('purchases.supplier')}</th>
                <th className="px-3 py-2 text-right">{t('purchases.grand_total')}</th>
                <th className="px-3 py-2 text-right">{t('purchases.paid_amount')}</th>
                <th className="px-3 py-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{p.purchase_no}</td>
                  <td className="px-3 py-2">{p.supplier_name}</td>
                  <td className="px-3 py-2 text-right">{currency}{Number(p.grand_total).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{currency}{Number(p.paid_amount).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => openReturn(p)} className="text-amber-600 hover:underline text-xs">{t('pos.return')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {returning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-96 rounded-xl bg-white dark:bg-slate-900 p-4">
            <h3 className="mb-3 font-semibold">{t('purchases.return_title', { no: returning.purchase_no })}</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {returning.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm">
                  <span>{it.product_name} ({t('pos.qty')}: {it.qty})</span>
                  <input
                    type="number"
                    min="0"
                    max={it.qty}
                    value={returnQtys[it.id] || 0}
                    onChange={(e) => setReturnQtys({ ...returnQtys, [it.id]: e.target.value })}
                    className="w-20 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={submitReturn} className="flex-1 rounded-md bg-brand-600 py-2 text-white text-sm">{t('common.save')}</button>
              <button onClick={() => setReturning(null)} className="flex-1 rounded-md border py-2 text-sm">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3 self-start">
        <h2 className="font-semibold">{t('purchases.new_purchase')}</h2>
        {error && <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700">{error}</div>}
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2">
          <option value="">{t('purchases.supplier')}</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {items.map((it, i) => {
          const product = selectedProduct(it.product_id);
          return (
            <div key={i} className="space-y-1 rounded-md border border-slate-200 dark:border-slate-700 p-2">
              <select
                value={it.product_id}
                onChange={(e) => updateItem(i, { product_id: e.target.value })}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
              >
                <option value="">{t('purchases.select_product')}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="flex gap-1">
                {!product?.track_serial && (
                  <input type="number" value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} placeholder={t('purchases.qty_placeholder')} className="w-20 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm" />
                )}
                <input type="number" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} placeholder={t('purchases.unit_price_placeholder')} className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm" />
                <button type="button" onClick={() => removeRow(i)} className="text-red-500 text-xs">✕</button>
              </div>
              {product?.track_serial && (
                <input
                  value={it.serials_text}
                  onChange={(e) => updateItem(i, { serials_text: e.target.value })}
                  placeholder={t('purchases.imei_placeholder')}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
                />
              )}
            </div>
          );
        })}
        <button type="button" onClick={addRow} className="text-xs text-brand-600 hover:underline">{t('purchases.add_item')}</button>

        <div>
          <label className="mb-1 block text-sm font-medium">{t('purchases.paid_amount')}</label>
          <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
        </div>

        <div className="flex justify-between text-sm font-semibold">
          <span>{t('purchases.grand_total')}</span>
          <span>{currency}{grandTotal.toFixed(2)}</span>
        </div>

        <button type="submit" className="w-full rounded-md bg-brand-600 py-2 text-white text-sm">{t('common.save')}</button>
      </form>
    </div>
  );
}
