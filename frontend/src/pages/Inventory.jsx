import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { enqueueOutboxItem, newUuid, applyLocalStockDelta } from '../db/db';
import { refreshPendingCount } from '../db/syncService';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import {
  Boxes,
  AlertTriangle,
  Plus,
  Minus,
  X,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Package
} from 'lucide-react';

export default function Inventory() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { settings } = useSettings();
  const canAdjust = can('inventory.adjust');

  const [movements, setMovements] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Adjustment state inside modal
  const [direction, setDirection] = useState('increase'); // 'increase' or 'decrease'
  const [qty, setQty] = useState(1);
  const [adjustType, setAdjustType] = useState('purchase'); // increase: 'purchase', 'other'; decrease: 'damage', 'other'
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const load = () => {
    if (!settings?.business_type) return;
    const params = { business_type: settings.business_type };
    api.get('/stock/movements', { params }).then(({ data }) => setMovements(data));
    api.get('/stock/low', { params }).then(({ data }) => setLowStock(data));
    api.get('/products', { params }).then(({ data }) => setProducts(data));
  };

  useEffect(() => {
    load();
  }, [settings?.business_type]);

  const openAdjustModal = (product) => {
    setSelectedProduct(product);
    setDirection('increase');
    setQty(1);
    setAdjustType('purchase');
    setCustomReason('');
    setModalOpen(true);
  };

  const handleDirectionChange = (dir) => {
    setDirection(dir);
    if (dir === 'increase') {
      setAdjustType('purchase');
    } else {
      setAdjustType('damage');
    }
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedProduct || Number(qty) <= 0) return;
    setSubmitting(true);

    const delta = direction === 'increase' ? Number(qty) : -Number(qty);
    const reasonText = customReason.trim() ? `${adjustType}: ${customReason.trim()}` : adjustType;

    const payload = {
      uuid: newUuid(),
      product_id: Number(selectedProduct.id),
      qty_change: delta,
      reason: reasonText,
    };

    try {
      await api.post('/stock/adjust', payload);
      load();
    } catch {
      await enqueueOutboxItem({ client_id: payload.uuid, type: 'stock_adjustment', payload });
      await applyLocalStockDelta(payload.product_id, payload.qty_change);
      refreshPendingCount();
    } finally {
      setSubmitting(false);
      setModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#7652B5] dark:text-[#A98ADB]" />
            {t('inventory.title')}
          </h1>
          <p className="text-xs text-[#716B7C]">
            Real-time stock ledger, inventory valuation & manual adjustments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Low Stock Alerts + Products Available to Adjust */}
        <div className="space-y-6">
          {/* Low Stock Widget */}
          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#211D2A] p-4 shadow-sm">
            <h2 className="text-sm font-bold flex items-center gap-2 text-red-600 dark:text-red-400 mb-3">
              <AlertTriangle className="w-4 h-4" />
              {t('inventory.low_stock')}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E8E3EF] dark:border-[#393244] text-left font-semibold text-[#716B7C]">
                    <th className="pb-2">{t('common.name')}</th>
                    <th className="pb-2 text-right">{t('products.stock_qty')}</th>
                    {canAdjust && <th className="pb-2 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E3EF] dark:divide-[#393244]">
                  {lowStock.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 font-medium">{p.name}</td>
                      <td className="py-2 text-right font-bold text-red-500">{Number(p.stock_qty)}</td>
                      {canAdjust && (
                        <td className="py-2 text-center">
                          <button
                            onClick={() => openAdjustModal(p)}
                            title="Adjust Stock"
                            className="p-1 text-[#7652B5] dark:text-[#A98ADB] hover:bg-[#EDE7F7] dark:bg-[#2B2536] dark:hover:bg-[#2B2536] rounded transition-colors"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {lowStock.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-[#716B7C] dark:text-[#B8B0C4] italic">
                        All stocks healthy
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Product Picker for Adjustment */}
          {canAdjust && (
            <div className="rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
                Select Product to Adjust
              </h2>
              <p className="text-xs text-[#716B7C]">Click any product to open the adjustment modal with plus/minus</p>
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1 text-xs">
                {products.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => openAdjustModal(p)}
                    className="flex items-center justify-between p-2 rounded-lg border border-[#E8E3EF] dark:border-[#393244] hover:bg-[#EDE7F7]/50 dark:bg-[#2B2536]/50 dark:hover:bg-[#2B2536]/80 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-[#282431] dark:text-[#F5F2F9]">{p.name}</div>
                      <div className="text-[10px] text-[#716B7C] dark:text-[#B8B0C4]">Current: {Number(p.stock_qty)} {p.unit_code || ''}</div>
                    </div>
                    <button className="px-2 py-1 rounded bg-[#EDE7F7] dark:bg-[#2B2536] text-[#7652B5] dark:text-[#A98ADB] font-bold hover:bg-[#5B3B91] dark:hover:bg-[#C0A5EA] hover:text-white dark:hover:text-[#17151D] transition-colors text-[11px]">
                      Adjust
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Complete Stock Movements Ledger */}
        <div className="lg:col-span-2 rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-bold">{t('inventory.stock_movements')}</h2>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F7F5FC] dark:bg-[#2B2536] text-left sticky top-0 font-semibold text-[#716B7C] dark:text-[#B8B0C4]">
                <tr>
                  <th className="px-3.5 py-2.5">{t('common.name')}</th>
                  <th className="px-3.5 py-2.5">Type / Reason</th>
                  <th className="px-3.5 py-2.5 text-right">Adjustment</th>
                  <th className="px-3.5 py-2.5 text-right">{t('common.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E3EF] dark:divide-[#393244]">
                {movements.map((m) => {
                  const qtyChange = Number(m.qty_change);
                  return (
                    <tr key={m.id} className="hover:bg-[#F7F5FC]/50 dark:hover:bg-[#2B2536]/40 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium">{m.product_name}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="capitalize font-medium text-[#282431] dark:text-[#B8B0C4]">
                          {m.notes || m.movement_type}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded ${
                          qtyChange > 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                        }`}>
                          {qtyChange > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {qtyChange > 0 ? `+${qtyChange}` : qtyChange}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-[#716B7C] dark:text-[#B8B0C4]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[#716B7C] dark:text-[#B8B0C4]">
                      No stock movement history
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Modal for Plus / Minus Stock Adjustment */}
      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#211D2A] p-6 shadow-2xl border border-[#E8E3EF] dark:border-[#393244] space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E3EF] dark:border-[#393244]">
              <div>
                <h3 className="font-bold text-sm text-[#282431] dark:text-[#F5F2F9] flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
                  {selectedProduct.name}
                </h3>
                <p className="text-xs text-[#716B7C]">
                  Current Stock: <span className="font-bold text-[#282431] dark:text-[#B8B0C4]">{Number(selectedProduct.stock_qty)}</span>
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#716B7C] dark:hover:text-[#F5F2F9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
              {/* Direction Toggle (Increase / Decrease) */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#EDE7F7] dark:bg-[#2B2536] rounded-xl">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('increase')}
                  className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    direction === 'increase'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#282431]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Increase (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionChange('decrease')}
                  className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    direction === 'decrease'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#282431]'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  Decrease (-)
                </button>
              </div>

              {/* Quantity Counter with Center Input and Plus/Minus Icons on Side */}
              <div>
                <label className="block font-semibold text-[#282431] dark:text-[#B8B0C4] text-center mb-1.5">
                  Quantity to {direction === 'increase' ? 'Add' : 'Deduct'}
                </label>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, Number(q || 1) - 1))}
                    className="w-10 h-10 rounded-xl border border-[#E8E3EF] dark:border-[#393244] flex items-center justify-center text-[#716B7C] dark:text-[#B8B0C4] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] font-bold text-base transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-24 text-center text-lg font-black rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-transparent py-2 focus:ring-1 focus:ring-[#7652B5] focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setQty((q) => Number(q || 0) + 1)}
                    className="w-10 h-10 rounded-xl border border-[#E8E3EF] dark:border-[#393244] flex items-center justify-center text-[#716B7C] dark:text-[#B8B0C4] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] font-bold text-base transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Adjustment Reason Type */}
              <div>
                <label className="mb-1 block font-semibold text-[#282431] dark:text-[#B8B0C4]">
                  Adjustment Type / Reason *
                </label>
                {direction === 'increase' ? (
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#7652B5] focus:outline-none"
                  >
                    <option value="purchase">Purchase (New Stock In)</option>
                    <option value="other">Other Reason</option>
                  </select>
                ) : (
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#7652B5] focus:outline-none"
                  >
                    <option value="damage">Damage (Breakage / Spoilage)</option>
                    <option value="other">Other Reason</option>
                  </select>
                )}
              </div>

              {adjustType === 'other' && (
                <div>
                  <label className="mb-1 block font-semibold text-[#282431] dark:text-[#B8B0C4]">
                    Specify Reason
                  </label>
                  <input
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter reason details..."
                    className="w-full rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#7652B5] focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] text-white dark:text-[#17151D] font-bold py-2.5 transition-colors shadow-sm text-xs"
                >
                  {submitting ? 'Applying...' : 'Apply Stock Change'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#E8E3EF] dark:border-[#393244] px-4 py-2.5 hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536]"
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
