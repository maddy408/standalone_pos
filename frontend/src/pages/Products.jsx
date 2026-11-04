import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { cacheProducts } from '../db/db';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Layers,
  Barcode,
  Layers2,
  ChevronRight
} from 'lucide-react';

const BLANK_FORM = {
  id: null,
  name: '',
  category_id: '',
  brand_id: '',
  unit_id: '',
  tax_rate_id: '',
  supplier_id: '',
  barcode: '',
  sku: '',
  purchase_price: '',
  selling_price: '',
  mrp: '',
  retail_price: '',
  wholesale_price: '',
  customer_price: '',
  stock_qty: '',
  low_stock_threshold: '',
  track_serial: false,
  attributes: {},
  serials: [{ imei1: '', imei2: '', serial_no: '' }],
};

export default function Products() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { can } = useAuth();
  const canManage = can('products.manage');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [attributeFields, setAttributeFields] = useState([]);
  const [form, setForm] = useState(BLANK_FORM);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const currency = settings?.currency_symbol || '₹';

  const loadProducts = () => {
    if (!settings?.business_type) return;
    api
      .get('/products', {
        params: { search: search || undefined, business_type: settings.business_type },
      })
      .then(({ data }) => {
        setProducts(data);
        cacheProducts(data);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadProducts();
  }, [settings?.business_type, search]);

  useEffect(() => {
    if (!settings?.business_type) return;
    const bt = settings.business_type;

    api.get('/categories', { params: { business_type: bt } }).then(({ data }) => setCategories(data));
    api.get('/lookup/brands', { params: { business_type: bt } }).then(({ data }) => setBrands(data));
    api.get('/lookup/units').then(({ data }) => setUnits(data));
    api.get('/lookup/tax-rates').then(({ data }) => setTaxRates(data));

    api.get(`/settings/business-types/${bt}/fields`).then(({ data }) => {
      setAttributeFields(data);
    });
  }, [settings?.business_type]);

  const resetForm = () => {
    setForm(BLANK_FORM);
    setIsEditing(false);
    setError('');
  };

  const startEdit = (p) => {
    setForm({
      id: p.id,
      name: p.name || '',
      category_id: p.category_id || '',
      brand_id: p.brand_id || '',
      unit_id: p.unit_id || '',
      tax_rate_id: p.tax_rate_id || '',
      supplier_id: p.supplier_id || '',
      barcode: p.barcode || '',
      sku: p.sku || '',
      purchase_price: p.purchase_price ? String(Number(p.purchase_price)) : '',
      selling_price: p.selling_price ? String(Number(p.selling_price)) : '',
      mrp: p.mrp ? String(Number(p.mrp)) : '',
      retail_price: p.retail_price ? String(Number(p.retail_price)) : '',
      wholesale_price: p.wholesale_price ? String(Number(p.wholesale_price)) : '',
      customer_price: p.customer_price ? String(Number(p.customer_price)) : '',
      stock_qty: p.stock_qty !== undefined && p.stock_qty !== null ? String(Number(p.stock_qty)) : '',
      low_stock_threshold: p.low_stock_threshold ? String(Number(p.low_stock_threshold)) : '',
      track_serial: !!p.track_serial,
      attributes: p.attributes || {},
      serials: [{ imei1: '', imei2: '', serial_no: '' }],
    });
    setIsEditing(true);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Product name is required');
      return;
    }

    const payload = {
      ...form,
      business_type: settings?.business_type || 'mobile',
      category_id: form.category_id ? Number(form.category_id) : null,
      brand_id: form.brand_id ? Number(form.brand_id) : null,
      unit_id: form.unit_id ? Number(form.unit_id) : null,
      tax_rate_id: form.tax_rate_id ? Number(form.tax_rate_id) : null,
      purchase_price: form.purchase_price === '' ? 0 : Number(form.purchase_price),
      selling_price: form.selling_price === '' ? 0 : Number(form.selling_price),
      retail_price: form.retail_price === '' ? 0 : Number(form.retail_price),
      wholesale_price: form.wholesale_price === '' ? 0 : Number(form.wholesale_price),
      customer_price: form.customer_price === '' ? 0 : Number(form.customer_price),
      mrp: form.mrp === '' ? 0 : Number(form.mrp),
      stock_qty: form.stock_qty === '' ? 0 : Number(form.stock_qty),
      low_stock_threshold: form.low_stock_threshold === '' ? null : Number(form.low_stock_threshold),
      serials: form.track_serial ? form.serials.filter((s) => s.imei1 || s.serial_no) : [],
    };

    try {
      if (form.id) {
        await api.put(`/products/${form.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      resetForm();
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save product');
    }
  };

  const remove = async (id) => {
    if (!confirm(t('products.delete_confirm'))) return;
    try {
      await api.delete(`/products/${id}`);
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products Table Section */}
      <div className={canManage ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-500" />
              {t('products.title')}
            </h1>
            <p className="text-xs text-slate-500">
              Active Category: <span className="capitalize font-semibold text-amber-600">{settings?.business_type}</span> shop inventory
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, barcode..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3.5 py-2.5">{t('common.name')}</th>
                <th className="px-3.5 py-2.5">{t('products.category')}</th>
                <th className="px-3.5 py-2.5 text-right">{t('products.selling_price')}</th>
                <th className="px-3.5 py-2.5 text-right">Wholesale</th>
                <th className="px-3.5 py-2.5 text-right">{t('products.stock_qty')}</th>
                {canManage && <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {products.map((p) => {
                const stock = Number(p.stock_qty || 0);
                const isLow = p.low_stock_threshold && stock <= Number(p.low_stock_threshold);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium">
                      <div>{p.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        {p.barcode && <span>Bar: {p.barcode}</span>}
                        {p.brand_name && <span>• {p.brand_name}</span>}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500">
                      {p.category_name || '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                      {currency}{Number(p.selling_price || 0).toFixed(2)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-500">
                      {p.wholesale_price ? `${currency}${Number(p.wholesale_price).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold">
                      <span className={`px-2 py-0.5 rounded ${isLow ? 'bg-red-50 dark:bg-red-950/40 text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                        {stock} {p.unit_code || ''}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => startEdit(p)}
                            title="Edit Product"
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove(p.id)}
                            title="Delete Product"
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    No products found for this business
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form (Add / Edit) */}
      {canManage && (
        <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 self-start">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-500" />
              {isEditing ? 'Edit Product' : 'Add New Product'}
            </h2>
            {isEditing && (
              <button
                onClick={resetForm}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-600 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-3 text-xs">
            {/* Product Basic Name */}
            <div>
              <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                Product Name *
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. iPhone 15 Pro, Wooden Dining Table"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            {/* Category and Brand */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Category
                </label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- None --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id ? `↳ ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Brand
                </label>
                <select
                  value={form.brand_id}
                  onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- None --</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Unit and Tax */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Unit
                </label>
                <select
                  value={form.unit_id}
                  onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- None --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.short_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Tax Rate
                </label>
                <select
                  value={form.tax_rate_id}
                  onChange={(e) => setForm({ ...form, tax_rate_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="">-- None (0%) --</option>
                  {taxRates.map((tRate) => (
                    <option key={tRate.id} value={tRate.id}>
                      {tRate.name} ({tRate.percent}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price Adjustments Grid */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-bold text-[11px] text-slate-600 dark:text-slate-300 uppercase tracking-wide block">
                Price Configuration
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                    Purchase Price ({currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.purchase_price}
                    onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                    MRP ({currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.mrp}
                    onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                    Retail Price ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.selling_price}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        selling_price: e.target.value,
                        retail_price: e.target.value,
                      })
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none font-semibold text-amber-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                    Wholesale ({currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.wholesale_price}
                    onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                    Cust. Special ({currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.customer_price}
                    onChange={(e) => setForm({ ...form, customer_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Stock Quantity & Threshold */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Stock Quantity
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.stock_qty}
                  onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Low Stock Alert
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.low_stock_threshold}
                  onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                  placeholder="5"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Barcode & SKU */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  Barcode
                </label>
                <input
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Scan or type"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                  SKU
                </label>
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. MOB-001"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 transition-colors shadow-sm"
              >
                {isEditing ? 'Update Product' : t('common.save')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
