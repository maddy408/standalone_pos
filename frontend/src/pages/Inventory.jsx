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
  Package,
  Search,
  Trash2,
} from 'lucide-react';

export default function Inventory() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { settings } = useSettings();
  const canAdjust = can('inventory.adjust');

  const [movements, setMovements] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchMovement, setSearchMovement] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Adjustment state inside modal
  const [direction, setDirection] = useState('increase'); // 'increase' or 'decrease'
  const [qty, setQty] = useState(1);
  const [adjustType, setAdjustType] = useState('purchase'); // increase: 'purchase', 'other'; decrease: 'damage', 'other'
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const params = settings?.business_type ? { business_type: settings.business_type } : {};

    api.get('/stock/movements', { params }).then(async ({ data }) => {
      let list = Array.isArray(data) ? data : [];
      if (list.length === 0 && settings?.business_type) {
        try {
          const allRes = await api.get('/stock/movements');
          if (Array.isArray(allRes.data) && allRes.data.length > 0) list = allRes.data;
        } catch {}
      }
      setMovements(list);
    }).catch(() => {});

    api.get('/stock/low', { params }).then(async ({ data }) => {
      let list = Array.isArray(data) ? data : [];
      if (list.length === 0 && settings?.business_type) {
        try {
          const allRes = await api.get('/stock/low');
          if (Array.isArray(allRes.data) && allRes.data.length > 0) list = allRes.data;
        } catch {}
      }
      setLowStock(list);
    }).catch(() => {});

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

  const deleteMovement = async (m) => {
    if (!confirm(`Are you sure you want to delete this movement record? Stock change of ${m.qty_change} will be reversed.`)) return;
    try {
      await api.delete(`/stock/movements/${m.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete movement');
    }
  };

  const filteredProductsToAdjust = products.filter((p) => {
    if (!searchProduct) return true;
    const q = searchProduct.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
  });

  const filteredMovements = movements.filter((m) => {
    if (!searchMovement) return true;
    const q = searchMovement.toLowerCase();
    return (m.product_name || '').toLowerCase().includes(q) || (m.notes || '').toLowerCase().includes(q) || (m.movement_type || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
            {t('inventory.title')}
          </h1>
          <p className="text-xs text-[#5A6B82]">
            Real-time stock ledger, inventory valuation & manual adjustments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Low Stock Alerts + Products Available to Adjust */}
        <div className="space-y-6">
          {/* Low Stock Widget */}
          <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#121E2C] p-4 shadow-sm">
            <h2 className="text-sm font-bold flex items-center gap-2 text-red-600 dark:text-red-400 mb-3">
              <AlertTriangle className="w-4 h-4" />
              {t('inventory.low_stock')}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-[#DCE5EF] dark:border-[#22354B] text-left font-semibold text-[#5A6B82]">
                    <th className="pb-2">{t('common.name')}</th>
                    <th className="pb-2 text-right">{t('products.stock_qty')}</th>
                    {canAdjust && <th className="pb-2 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
                  {lowStock.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 font-medium">{p.name}</td>
                      <td className="py-2 text-right font-bold text-red-500">{Number(p.stock_qty)}</td>
                      {canAdjust && (
                        <td className="py-2 text-center">
                          <button
                            onClick={() => openAdjustModal(p)}
                            title="Adjust Stock"
                            className="p-1 text-[#0A4174] dark:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:bg-[#1A2A3D] dark:hover:bg-[#1A2A3D] rounded transition-colors"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {lowStock.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-[#5A6B82] dark:text-[#94A3B8] italic">
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
            <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                  Stock Adjustment & Opening Stock
                </h2>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#5A6B82] absolute left-2.5 top-2" />
                <input
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  placeholder="Search item to adjust..."
                  className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent focus:outline-none"
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1 text-xs">
                {filteredProductsToAdjust.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => openAdjustModal(p)}
                    className="flex items-center justify-between p-2 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] hover:bg-[#E2EDF8]/50 dark:bg-[#1A2A3D]/50 dark:hover:bg-[#1A2A3D]/80 cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-[#1C2736] dark:text-[#F1F5F9]">{p.name}</div>
                      <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">Current: {Number(p.stock_qty)} {p.unit_code || ''}</div>
                    </div>
                    <button className="px-2 py-1 rounded bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] font-bold hover:bg-[#062E52] dark:hover:bg-[#6BA3E0] hover:text-white dark:hover:text-[#0B131E] transition-colors text-[11px]">
                      Adjust
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Complete Stock Movements Ledger */}
        <div className="lg:col-span-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{t('inventory.stock_movements')}</h2>
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#5A6B82] absolute left-2.5 top-2" />
              <input
                value={searchMovement}
                onChange={(e) => setSearchMovement(e.target.value)}
                placeholder="Search movements..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent focus:outline-none"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left sticky top-0 font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
                <tr>
                  <th className="px-3.5 py-2.5">{t('common.name')}</th>
                  <th className="px-3.5 py-2.5">Type / Reason</th>
                  <th className="px-3.5 py-2.5 text-right">Adjustment</th>
                  <th className="px-3.5 py-2.5 text-right">{t('common.date')}</th>
                  <th className="px-3.5 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
                {filteredMovements.map((m) => {
                  const qtyChange = Number(m.qty_change);
                  return (
                    <tr key={m.id} className="hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/40 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium">{m.product_name}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="capitalize font-medium text-[#1C2736] dark:text-[#94A3B8]">
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
                      <td className="px-3.5 py-2.5 text-right text-[#5A6B82] dark:text-[#94A3B8]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <button
                          onClick={() => deleteMovement(m)}
                          title="Delete / Reverse Adjustment"
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[#5A6B82] dark:text-[#94A3B8]">
                      No stock movement history found
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
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121E2C] p-6 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <div>
                <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                  {selectedProduct.name}
                </h3>
                <p className="text-xs text-[#5A6B82]">
                  Current Stock: <span className="font-bold text-[#1C2736] dark:text-[#94A3B8]">{Number(selectedProduct.stock_qty)}</span>
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#5A6B82] dark:hover:text-[#F1F5F9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
              {/* Direction Toggle (Increase / Decrease) */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#E2EDF8] dark:bg-[#1A2A3D] rounded-xl">
                <button
                  type="button"
                  onClick={() => handleDirectionChange('increase')}
                  className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    direction === 'increase'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#1C2736]'
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
                      : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#1C2736]'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  Decrease (-)
                </button>
              </div>

              {/* Quantity Counter with Center Input and Plus/Minus Icons on Side */}
              <div>
                <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] text-center mb-1.5">
                  Quantity to {direction === 'increase' ? 'Add' : 'Deduct'}
                </label>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, Number(q || 1) - 1))}
                    className="w-10 h-10 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-center text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] font-bold text-base transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-24 text-center text-lg font-black rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setQty((q) => Number(q || 0) + 1)}
                    className="w-10 h-10 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-center text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] font-bold text-base transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Adjustment Reason Type */}
              <div>
                <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
                  Adjustment Type / Reason *
                </label>
                {direction === 'increase' ? (
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  >
                    <option value="purchase">Purchase (New Stock In)</option>
                    <option value="other">Other Reason</option>
                  </select>
                ) : (
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  >
                    <option value="damage">Damage (Breakage / Spoilage)</option>
                    <option value="other">Other Reason</option>
                  </select>
                )}
              </div>

              {adjustType === 'other' && (
                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
                    Specify Reason
                  </label>
                  <input
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter reason details..."
                    className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold py-2.5 transition-colors shadow-sm text-xs"
                >
                  {submitting ? 'Applying...' : 'Apply Stock Change'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] px-4 py-2.5 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
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
