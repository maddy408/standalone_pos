import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { cacheProducts, enqueueOutboxItem, newUuid } from '../db/db';
import { refreshPendingCount } from '../db/syncService';
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
  Image as ImageIcon,
  DollarSign,
  Boxes,
  Sparkles,
  Smartphone,
  Sofa,
  Utensils,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Info,
  Calendar,
  Sliders,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const BLANK_FORM = {
  id: null,
  uuid: null,
  name: '',
  description: '',
  images: [],
  category_id: '',
  brand_id: '',
  unit_id: '',
  tax_rate_id: '',
  tax_inclusive: false,
  supplier_id: '',
  barcode: '',
  sku: '',
  hsn_code: '',
  purchase_price: '',
  mrp: '',
  selling_price: '',
  retail_price: '',
  wholesale_price: '',
  customer_price: '',
  stock_qty: '',
  opening_stock: '',
  low_stock_threshold: '',
  min_stock: '',
  max_stock: '',
  track_serial: false,
  pos_enabled: true,
  online_enabled: true,
  is_returnable: true,
  is_active: 1,
  attributes: {},
  variants: [],
  serials: [{ imei1: '', imei2: '', serial_no: '', color: '', warranty_months: '', warranty_start: '', warranty_end: '' }],
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
  const [addonsList, setAddonsList] = useState([]);
  
  const [form, setForm] = useState(BLANK_FORM);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // Filter table
  const [activeFormSection, setActiveFormSection] = useState('basic'); // 'basic', 'pricing', 'inventory', 'specs', 'variants', 'addons', 'settings'

  // Add-on group creation inside products (Hotel)
  const [newAddonGroup, setNewAddonGroup] = useState({ name: '', price: '', group_name: 'Add-ons', is_mandatory: 0 });

  const currency = settings?.currency_symbol || '₹';
  const businessType = settings?.business_type || 'mobile';

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

    // Load dynamic schema fields
    api.get(`/settings/business-types/${bt}/fields`).then(({ data }) => {
      setAttributeFields(data);
    });

    // Load add-ons if hotel
    if (bt === 'food') {
      api.get('/lookup/addons').then(({ data }) => setAddonsList(data));
    }
  }, [settings?.business_type]);

  // Barcode Auto Generator
  const generateBarcode = () => {
    const prefix = businessType.toUpperCase().substring(0, 3);
    const code = prefix + Math.floor(10000000 + Math.random() * 90000000);
    setForm((f) => ({ ...f, barcode: code }));
  };

  const resetForm = () => {
    setForm({
      ...BLANK_FORM,
      uuid: newUuid(),
      attributes: {},
      variants: [],
      serials: [{ imei1: '', imei2: '', serial_no: '', color: '', warranty_months: '', warranty_start: '', warranty_end: '' }],
    });
    setIsEditing(false);
    setError('');
    setSuccess('');
    setActiveFormSection('basic');
  };

  const startEdit = (p) => {
    setForm({
      ...BLANK_FORM,
      id: p.id,
      uuid: p.uuid || newUuid(),
      name: p.name || '',
      description: p.description || '',
      images: Array.isArray(p.images) ? p.images : [],
      category_id: p.category_id || '',
      brand_id: p.brand_id || '',
      unit_id: p.unit_id || '',
      tax_rate_id: p.tax_rate_id || '',
      tax_inclusive: !!p.tax_inclusive,
      supplier_id: p.supplier_id || '',
      barcode: p.barcode || '',
      sku: p.sku || '',
      hsn_code: p.hsn_code || '',
      purchase_price: p.purchase_price ? String(Number(p.purchase_price)) : '',
      selling_price: p.selling_price ? String(Number(p.selling_price)) : '',
      retail_price: p.retail_price ? String(Number(p.retail_price)) : (p.selling_price ? String(Number(p.selling_price)) : ''),
      wholesale_price: p.wholesale_price ? String(Number(p.wholesale_price)) : '',
      customer_price: p.customer_price ? String(Number(p.customer_price)) : '',
      mrp: p.mrp ? String(Number(p.mrp)) : '',
      stock_qty: p.stock_qty !== undefined && p.stock_qty !== null ? String(Number(p.stock_qty)) : '',
      opening_stock: p.opening_stock ? String(Number(p.opening_stock)) : '',
      low_stock_threshold: p.low_stock_threshold ? String(Number(p.low_stock_threshold)) : '',
      min_stock: p.min_stock ? String(Number(p.min_stock)) : '',
      max_stock: p.max_stock ? String(Number(p.max_stock)) : '',
      track_serial: !!p.track_serial,
      pos_enabled: p.pos_enabled !== undefined ? !!p.pos_enabled : true,
      online_enabled: p.online_enabled !== undefined ? !!p.online_enabled : true,
      is_returnable: p.is_returnable !== undefined ? !!p.is_returnable : true,
      is_active: p.is_active !== undefined ? p.is_active : 1,
      attributes: p.attributes || {},
      variants: p.variants || [],
      serials: (p.available_serials && p.available_serials.length > 0)
        ? p.available_serials.map(s => ({
            imei1: s.imei1 || '',
            imei2: s.imei2 || '',
            serial_no: s.serial_no || '',
            color: s.color || '',
            warranty_months: s.warranty_months ? String(s.warranty_months) : '',
            warranty_start: s.warranty_start || '',
            warranty_end: s.warranty_end || '',
          }))
        : [{ imei1: '', imei2: '', serial_no: '', color: '', warranty_months: '', warranty_start: '', warranty_end: '' }],
    });
    setIsEditing(true);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Variant helpers
  const addVariantRow = () => {
    setForm((f) => ({
      ...f,
      variants: [
        ...(f.variants || []),
        { id: null, variant_name: '', sku: '', price_adjustment: 0, selling_price: f.selling_price || 0, barcode: '', stock_qty: 0 },
      ],
    }));
  };

  const updateVariantRow = (idx, patch) => {
    setForm((f) => ({
      ...f,
      variants: (f.variants || []).map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }));
  };

  const removeVariantRow = (idx) => {
    setForm((f) => ({
      ...f,
      variants: (f.variants || []).filter((_, i) => i !== idx),
    }));
  };

  // Serial helpers
  const addSerialRow = () => {
    setForm((f) => ({
      ...f,
      serials: [
        ...(f.serials || []),
        { imei1: '', imei2: '', serial_no: '', color: f.attributes?.color || '', warranty_months: f.attributes?.warranty_period || '', warranty_start: '', warranty_end: '' },
      ],
    }));
  };

  const updateSerialRow = (idx, patch) => {
    setForm((f) => ({
      ...f,
      serials: (f.serials || []).map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const removeSerialRow = (idx) => {
    setForm((f) => ({
      ...f,
      serials: (f.serials || []).filter((_, i) => i !== idx),
    }));
  };

  // Quick Add-on creation (Hotel)
  const handleCreateAddon = async (e) => {
    e.preventDefault();
    if (!newAddonGroup.name.trim()) return;
    try {
      await api.post('/lookup/addons', {
        name: newAddonGroup.name.trim(),
        price: Number(newAddonGroup.price || 0),
        group_name: newAddonGroup.group_name.trim() || 'General',
        is_mandatory: newAddonGroup.is_mandatory ? 1 : 0,
        is_active: 1,
      });
      const { data } = await api.get('/lookup/addons');
      setAddonsList(data);
      setNewAddonGroup({ name: '', price: '', group_name: 'Add-ons', is_mandatory: 0 });
    } catch (err) {
      alert('Failed to add add-on');
    }
  };

  // Main Submit handler (supports online and offline outbox sync)
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Product Name is required');
      setActiveFormSection('basic');
      return;
    }

    if (!form.selling_price && !form.retail_price) {
      setError('Retail Selling Price is required');
      setActiveFormSection('pricing');
      return;
    }

    // Prepare payload
    const uuid = form.uuid || newUuid();
    const payload = {
      ...form,
      uuid,
      business_type: businessType,
      category_id: form.category_id ? Number(form.category_id) : null,
      brand_id: form.brand_id ? Number(form.brand_id) : null,
      unit_id: form.unit_id ? Number(form.unit_id) : null,
      tax_rate_id: form.tax_rate_id ? Number(form.tax_rate_id) : null,
      tax_inclusive: form.tax_inclusive ? 1 : 0,
      purchase_price: form.purchase_price === '' ? 0 : Number(form.purchase_price),
      selling_price: form.selling_price === '' ? Number(form.retail_price || 0) : Number(form.selling_price),
      retail_price: form.retail_price === '' ? Number(form.selling_price || 0) : Number(form.retail_price),
      wholesale_price: form.wholesale_price === '' ? 0 : Number(form.wholesale_price),
      customer_price: form.customer_price === '' ? 0 : Number(form.customer_price),
      mrp: form.mrp === '' ? 0 : Number(form.mrp),
      stock_qty: form.stock_qty === '' ? 0 : Number(form.stock_qty),
      opening_stock: form.opening_stock === '' ? (form.stock_qty === '' ? 0 : Number(form.stock_qty)) : Number(form.opening_stock),
      low_stock_threshold: form.low_stock_threshold === '' ? null : Number(form.low_stock_threshold),
      min_stock: form.min_stock === '' ? null : Number(form.min_stock),
      max_stock: form.max_stock === '' ? null : Number(form.max_stock),
      serials: form.track_serial ? (form.serials || []).filter((s) => s.imei1 || s.serial_no) : [],
      variants: form.variants || [],
      images: form.images || [],
      attributes: form.attributes || {},
    };

    if (navigator.onLine) {
      try {
        if (form.id) {
          await api.put(`/products/${form.id}`, payload);
          setSuccess('Product updated successfully!');
        } else {
          await api.post('/products', payload);
          setSuccess('Product created successfully!');
        }
        resetForm();
        loadProducts();
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to save product');
      }
    } else {
      // Offline mode handling
      try {
        await enqueueOutboxItem({
          client_id: uuid,
          type: 'product',
          payload: { ...payload, created_at: new Date().toISOString() },
        });
        refreshPendingCount();
        setSuccess('Saved offline! Will sync automatically when network returns.');
        resetForm();
      } catch (err) {
        setError('Failed to queue offline product: ' + err.message);
      }
    }
  };

  const removeProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      loadProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const businessIcon = {
    mobile: <Smartphone className="w-5 h-5 text-amber-500" />,
    furniture: <Sofa className="w-5 h-5 text-amber-500" />,
    food: <Utensils className="w-5 h-5 text-amber-500" />,
  }[businessType];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {businessIcon}
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Product Creation & Catalog
              <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {businessType} mode
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Configured dynamically for {businessType} specs, variants, barcodes & inventory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, barcode, SKU..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>
          {isEditing && (
            <button
              onClick={resetForm}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New Product
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Catalog Table, Right Comprehensive Create/Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Products List (Left side - 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            <span>Product Inventory ({products.length})</span>
            <span className="text-amber-600 capitalize">{businessType}</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm max-h-[850px] overflow-y-auto scrollbar-thin">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 text-left font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-3.5 py-2.5">Product</th>
                  <th className="px-3.5 py-2.5 text-right">Price ({currency})</th>
                  <th className="px-3.5 py-2.5 text-right">Stock</th>
                  <th className="px-3.5 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p) => {
                  const isLow = p.low_stock_threshold && Number(p.stock_qty || 0) <= Number(p.low_stock_threshold);
                  const isSelected = form.id === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => startEdit(p)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-4 border-amber-500'
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">{p.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          {p.category_name && <span>{p.category_name}</span>}
                          {p.barcode && <span className="font-mono">#{p.barcode}</span>}
                          {p.variants?.length > 0 && (
                            <span className="text-amber-600 font-bold">({p.variants.length} var)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-amber-600 dark:text-amber-400">
                        {currency}{Number(p.selling_price || 0).toFixed(2)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-medium">
                        <span className={`px-1.5 py-0.5 rounded ${isLow ? 'bg-red-50 dark:bg-red-950/40 text-red-500 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                          {Number(p.stock_qty || 0)} {p.unit_code || ''}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEdit(p)}
                            title="Edit"
                            className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeProduct(p.id)}
                            title="Delete"
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 italic">
                      No products found. Use the form to create your first item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Comprehensive Product Form (Right side - 7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          {/* Form Action Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-white">
                <Plus className="w-4 h-4 text-amber-500" />
                {isEditing ? `Edit Product: ${form.name}` : `Create New ${businessType.toUpperCase()} Product`}
              </h2>
              <p className="text-xs text-slate-500">Fill common information, pricing, variants & business specifications</p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          {/* Form Section Navigation Pills */}
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-3">
            {[
              { id: 'basic', label: '1. Basic Info' },
              { id: 'pricing', label: '2. Pricing & Tax' },
              { id: 'inventory', label: '3. Inventory' },
              { id: 'specs', label: `4. ${businessType.toUpperCase()} Specs` },
              { id: 'variants', label: '5. Variants' },
              ...(businessType === 'food' ? [{ id: 'addons', label: '6. Add-ons' }] : []),
              { id: 'settings', label: '7. Settings' },
            ].map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveFormSection(sec.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeFormSection === sec.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Alert messages */}
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-600 border border-red-200 dark:border-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-600 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-5 text-xs">
            {/* SECTION 1: BASIC INFORMATION */}
            {activeFormSection === 'basic' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={
                      businessType === 'mobile'
                        ? 'e.g. Apple iPhone 15 Pro, Samsung Galaxy S24'
                        : businessType === 'furniture'
                        ? 'e.g. Solid Teak Wood Dining Table, Ergonomic Office Chair'
                        : 'e.g. Special Chicken Biryani, Butter Naan'
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                    <select
                      value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parent_id ? `↳ ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Brand</label>
                    <select
                      value={form.brand_id}
                      onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">-- Select Brand --</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU</label>
                    <input
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      placeholder="e.g. MOB-0012"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Barcode</label>
                      <button
                        type="button"
                        onClick={generateBarcode}
                        className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5"
                      >
                        <Barcode className="w-3 h-3" /> Auto Gen
                      </button>
                    </div>
                    <input
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      placeholder="Type or auto-generate"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">HSN Code</label>
                    <input
                      value={form.hsn_code}
                      onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
                      placeholder="e.g. 85171200"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Enter detailed description, key specifications, or highlights..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>


              </div>
            )}

            {/* SECTION 2: PRICING & TAXATION */}
            {activeFormSection === 'pricing' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="font-bold text-xs uppercase text-slate-500 tracking-wider">
                    Price Tiers ({currency})
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Retail Selling Price *
                      </label>
                      <input
                        required
                        type="number"
                        step="any"
                        value={form.retail_price}
                        onChange={(e) => setForm({ ...form, retail_price: e.target.value, selling_price: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-amber-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Wholesale Price
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.wholesale_price}
                        onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Customer Special Price
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.customer_price}
                        onChange={(e) => setForm({ ...form, customer_price: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Purchase Price ({currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.purchase_price}
                        onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        MRP ({currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.mrp}
                        onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Tax Configuration */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="font-bold text-xs uppercase text-slate-500 tracking-wider">
                    Taxation & GST
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tax Rate</label>
                      <select
                        value={form.tax_rate_id}
                        onChange={(e) => setForm({ ...form, tax_rate_id: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      >
                        <option value="">-- None (0%) --</option>
                        {taxRates.map((tRate) => (
                          <option key={tRate.id} value={tRate.id}>
                            {tRate.name} ({tRate.percent}%)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tax Calculation</label>
                      <select
                        value={form.tax_inclusive ? '1' : '0'}
                        onChange={(e) => setForm({ ...form, tax_inclusive: e.target.value === '1' })}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      >
                        <option value="0">Tax Exclusive (Added on top)</option>
                        <option value="1">Tax Inclusive (Included in price)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: INVENTORY & STOCK */}
            {activeFormSection === 'inventory' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Stock Unit</label>
                    <select
                      value={form.unit_id}
                      onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">-- Select Unit (Pcs, Set, Pair, Kg...) --</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.short_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current Stock Qty
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.stock_qty}
                      onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 font-bold focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Opening Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.opening_stock}
                      onChange={(e) => setForm({ ...form, opening_stock: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Low Stock Alert
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.low_stock_threshold}
                      onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                      placeholder="e.g. 5"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Minimum Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.min_stock}
                      onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                      placeholder="e.g. 2"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Maximum Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.max_stock}
                      onChange={(e) => setForm({ ...form, max_stock: e.target.value })}
                      placeholder="e.g. 100"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Mobile Shop: Unique IMEI / Serial Number Tracking */}
                {businessType === 'mobile' && (
                  <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4" />
                          Individual Device IMEI & Serial Tracking
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Enable for phones/tablets. Disable for phone covers, cables, chargers & accessories.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.track_serial}
                          onChange={(e) => setForm({ ...form, track_serial: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {form.track_serial && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                            Registered Devices / IMEIs ({form.serials?.length || 0})
                          </span>
                          <button
                            type="button"
                            onClick={addSerialRow}
                            className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> + Add Device IMEI
                          </button>
                        </div>

                        {form.serials?.map((s, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                value={s.imei1}
                                onChange={(e) => updateSerialRow(idx, { imei1: e.target.value })}
                                placeholder="Primary IMEI 1 (15 digits)"
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs font-mono"
                              />
                              <input
                                value={s.imei2}
                                onChange={(e) => updateSerialRow(idx, { imei2: e.target.value })}
                                placeholder="Secondary IMEI 2 (Optional)"
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs font-mono"
                              />
                              <div className="flex gap-1">
                                <input
                                  value={s.serial_no}
                                  onChange={(e) => updateSerialRow(idx, { serial_no: e.target.value })}
                                  placeholder="Serial Number / S/N"
                                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs font-mono"
                                />
                                {form.serials.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSerialRow(idx)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                              <input
                                value={s.color}
                                onChange={(e) => updateSerialRow(idx, { color: e.target.value })}
                                placeholder="Device Color (e.g. Titanium Blue)"
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1 text-[11px]"
                              />
                              <input
                                type="number"
                                value={s.warranty_months}
                                onChange={(e) => updateSerialRow(idx, { warranty_months: e.target.value })}
                                placeholder="Warranty (Months)"
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1 text-[11px]"
                              />
                              <input
                                type="date"
                                value={s.warranty_start}
                                onChange={(e) => updateSerialRow(idx, { warranty_start: e.target.value })}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1 text-[11px]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: DYNAMIC BUSINESS SPECIFICATIONS */}
            {activeFormSection === 'specs' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {businessIcon}
                    <span className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300">
                      {businessType} Specific Attributes
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {attributeFields.length} dynamic fields configured
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {attributeFields.map((field) => {
                    const value = form.attributes?.[field.field_key];
                    const label = `${field.label_en} ${field.unit_suffix ? `(${field.unit_suffix})` : ''}`;

                    if (field.field_type === 'select') {
                      let options = [];
                      try {
                        options = typeof field.options === 'string' ? JSON.parse(field.options) : (field.options || []);
                      } catch {
                        options = [];
                      }
                      return (
                        <div key={field.field_key}>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            {label} {field.is_required ? '*' : ''}
                          </label>
                          <select
                            value={value ?? ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                attributes: { ...form.attributes, [field.field_key]: e.target.value },
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          >
                            <option value="">-- Choose {field.label_en} --</option>
                            {options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label_en}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (field.field_type === 'textarea') {
                      return (
                        <div key={field.field_key} className="sm:col-span-2">
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            {label}
                          </label>
                          <textarea
                            rows={2}
                            value={value ?? ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                attributes: { ...form.attributes, [field.field_key]: e.target.value },
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={field.field_key}>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {label} {field.is_required ? '*' : ''}
                        </label>
                        <input
                          type={field.field_type === 'number' ? 'number' : 'text'}
                          value={value ?? ''}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              attributes: { ...form.attributes, [field.field_key]: e.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 5: REUSABLE PRODUCT VARIANTS */}
            {activeFormSection === 'variants' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 block">
                      Product Variants
                    </span>
                    <span className="text-[11px] text-slate-500">
                      e.g. Size (Small/Large), RAM/Storage (8GB/128GB), Color (Teak/Walnut)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Variant
                  </button>
                </div>

                <div className="space-y-2.5">
                  {form.variants?.map((v, i) => (
                    <div key={i} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-amber-600">Variant #{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeVariantRow(i)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2">
                          <input
                            value={v.variant_name}
                            onChange={(e) => updateVariantRow(i, { variant_name: e.target.value })}
                            placeholder="Variant Name (e.g. 256GB Space Gray / Half / 6-Seater)"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs font-medium"
                          />
                        </div>
                        <div>
                          <input
                            value={v.sku}
                            onChange={(e) => updateVariantRow(i, { sku: e.target.value })}
                            placeholder="Variant SKU"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <input
                            value={v.barcode}
                            onChange={(e) => updateVariantRow(i, { barcode: e.target.value })}
                            placeholder="Variant Barcode"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block">Price Adjust ({currency})</label>
                          <input
                            type="number"
                            step="any"
                            value={v.price_adjustment}
                            onChange={(e) => updateVariantRow(i, { price_adjustment: e.target.value })}
                            placeholder="+/- 0.00"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block">Exact Selling Price ({currency})</label>
                          <input
                            type="number"
                            step="any"
                            value={v.selling_price}
                            onChange={(e) => updateVariantRow(i, { selling_price: e.target.value })}
                            placeholder="Override Price"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1 text-xs font-bold text-amber-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block">Variant Stock</label>
                          <input
                            type="number"
                            step="any"
                            value={v.stock_qty}
                            onChange={(e) => updateVariantRow(i, { stock_qty: e.target.value })}
                            placeholder="0"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2.5 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!form.variants || form.variants.length === 0) && (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No variants added. This product will be sold as a single standard item.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 6: HOTEL / RESTAURANT ADD-ONS MANAGEMENT */}
            {businessType === 'food' && activeFormSection === 'addons' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-amber-800 dark:text-amber-300 block">
                      Food Add-ons & Extra Toppings
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Configured add-on items appear dynamically during POS billing for customization
                    </span>
                  </div>
                </div>

                {/* Quick Add-on Creator Box */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                  <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block">
                    Create Reusable Food Add-on
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      value={newAddonGroup.name}
                      onChange={(e) => setNewAddonGroup({ ...newAddonGroup, name: e.target.value })}
                      placeholder="Add-on Name (e.g. Extra Cheese)"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      step="any"
                      value={newAddonGroup.price}
                      onChange={(e) => setNewAddonGroup({ ...newAddonGroup, price: e.target.value })}
                      placeholder={`Extra Price (${currency})`}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                    />
                    <input
                      value={newAddonGroup.group_name}
                      onChange={(e) => setNewAddonGroup({ ...newAddonGroup, group_name: e.target.value })}
                      placeholder="Group (e.g. Toppings / Sides)"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleCreateAddon}
                      className="rounded-lg bg-amber-500 hover:bg-amber-400 font-bold text-slate-950 py-1.5 text-xs shadow-sm"
                    >
                      + Save Add-on
                    </button>
                  </div>
                </div>

                {/* Add-ons List */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 block">
                    Available Add-ons in System ({addonsList.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {addonsList.map((a) => (
                      <div key={a.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">{a.name}</span>
                          <span className="text-[10px] text-slate-400">{a.group_name || 'General'}</span>
                        </div>
                        <span className="font-bold text-xs text-emerald-600">
                          +{currency}{Number(a.price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 7: SALES CHANNELS & OTHER SETTINGS */}
            {activeFormSection === 'settings' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <span className="font-bold text-xs uppercase text-slate-500 tracking-wider block">
                    Sales Channel Visibility & Policies
                  </span>

                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200">POS Sale Enabled</span>
                        <span className="text-[10px] text-slate-400">Display and sell this item on the POS Billing cashier screen</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.pos_enabled}
                        onChange={(e) => setForm({ ...form, pos_enabled: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200">Online Sale Enabled</span>
                        <span className="text-[10px] text-slate-400">Expose product on online catalog & sync to external web channels</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.online_enabled}
                        onChange={(e) => setForm({ ...form, online_enabled: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200">Product Returnable</span>
                        <span className="text-[10px] text-slate-400">Allow customers to return this product for refund or credit note</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.is_returnable}
                        onChange={(e) => setForm({ ...form, is_returnable: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200">Product Status (Active / Inactive)</span>
                        <span className="text-[10px] text-slate-400">Inactive products are hidden from daily operations</span>
                      </div>
                      <select
                        value={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs font-semibold"
                      >
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Form Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {activeFormSection !== 'basic' && (
                  <button
                    type="button"
                    onClick={() => {
                      const sections = ['basic', 'pricing', 'inventory', 'specs', 'variants', ...(businessType === 'food' ? ['addons'] : []), 'settings'];
                      const idx = sections.indexOf(activeFormSection);
                      if (idx > 0) setActiveFormSection(sections[idx - 1]);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    ← Previous
                  </button>
                )}
                {activeFormSection !== 'settings' && (
                  <button
                    type="button"
                    onClick={() => {
                      const sections = ['basic', 'pricing', 'inventory', 'specs', 'variants', ...(businessType === 'food' ? ['addons'] : []), 'settings'];
                      const idx = sections.indexOf(activeFormSection);
                      if (idx < sections.length - 1) setActiveFormSection(sections[idx + 1]);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Next →
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-colors"
                >
                  {isEditing ? 'Save Product Changes' : 'Create Product Now'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
