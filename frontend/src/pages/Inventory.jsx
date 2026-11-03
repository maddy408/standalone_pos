import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { enqueueOutboxItem, newUuid, applyLocalStockDelta } from '../db/db';
import { refreshPendingCount } from '../db/syncService';
import { useAuth } from '../hooks/useAuth';

export default function Inventory() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canAdjust = can('inventory.adjust');
  const [movements, setMovements] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [adjust, setAdjust] = useState({ product_id: '', qty_change: '', reason: '' });
  const [message, setMessage] = useState('');

  const load = () => {
    api.get('/stock/movements').then(({ data }) => setMovements(data));
    api.get('/stock/low').then(({ data }) => setLowStock(data));
  };

  useEffect(() => {
    load();
    api.get('/products').then(({ data }) => setProducts(data));
  }, []);

  const submitAdjust = async (e) => {
    e.preventDefault();
    if (!adjust.product_id || !adjust.qty_change) return;
    const payload = {
      uuid: newUuid(),
      product_id: Number(adjust.product_id),
      qty_change: Number(adjust.qty_change),
      reason: adjust.reason,
    };
    try {
      await api.post('/stock/adjust', payload);
      load();
    } catch {
      await enqueueOutboxItem({ client_id: payload.uuid, type: 'stock_adjustment', payload });
      await applyLocalStockDelta(payload.product_id, payload.qty_change);
      refreshPendingCount();
    }
    setMessage(t('settings.saved'));
    setAdjust({ product_id: '', qty_change: '', reason: '' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="mb-2 font-semibold text-amber-600">{t('inventory.low_stock')}</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left">
                <tr><th className="px-3 py-2">{t('common.name')}</th><th className="px-3 py-2 text-right">{t('products.stock_qty')}</th></tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-right text-red-500 font-semibold">{Number(p.stock_qty)}</td>
                  </tr>
                ))}
                {lowStock.length === 0 && <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-400">{t('common.no_data')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 font-semibold">{t('inventory.stock_movements')}</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-96 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left sticky top-0">
                <tr>
                  <th className="px-3 py-2">{t('common.name')}</th>
                  <th className="px-3 py-2">{t('common.category')}</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                  <th className="px-3 py-2">{t('common.date')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{m.product_name}</td>
                    <td className="px-3 py-2">{m.movement_type}</td>
                    <td className={`px-3 py-2 text-right ${Number(m.qty_change) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {Number(m.qty_change) > 0 ? '+' : ''}{Number(m.qty_change)}
                    </td>
                    <td className="px-3 py-2">{new Date(m.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {canAdjust && (
      <form onSubmit={submitAdjust} className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3 self-start">
        <h2 className="font-semibold">{t('inventory.adjust_stock')}</h2>
        {message && <div className="text-xs text-emerald-600">{message}</div>}
        <select value={adjust.product_id} onChange={(e) => setAdjust({ ...adjust, product_id: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2">
          <option value="">Select product</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          type="number"
          value={adjust.qty_change}
          onChange={(e) => setAdjust({ ...adjust, qty_change: e.target.value })}
          placeholder={t('inventory.qty_change')}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
        />
        <input
          value={adjust.reason}
          onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
          placeholder={t('inventory.reason')}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
        />
        <button type="submit" className="w-full rounded-md bg-brand-600 py-2 text-white text-sm">{t('common.save')}</button>
      </form>
      )}
    </div>
  );
}
