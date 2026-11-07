import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
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
  Tags,
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
  discount_percent: '',
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

  // Quick Category & Subcategory Creation Modals
  const [quickCatModal, setQuickCatModal] = useState(false);
  const [quickCatForm, setQuickCatForm] = useState({ name: '', parent_id: '', business_type: '' });
  const [quickSubCatModal, setQuickSubCatModal] = useState(false);
  const [quickSubCatForm, setQuickSubCatForm] = useState({ name: '', parent_id: '', business_type: '' });

  // Separate Category and Subcategory selection state
  const [selectedMainCatId, setSelectedMainCatId] = useState('');
  const [selectedSubCatId, setSelectedSubCatId] = useState('');

  const currency = settings?.currency_symbol || '₹';
  const businessType = settings?.business_type || 'mobile';

  const filteredProducts = useMemo(() => {
    if (!search || !search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const cat = (p.category_name || '').toLowerCase();
      const brand = (p.brand_name || '').toLowerCase();
      return name.includes(q) || barcode.includes(q) || sku.includes(q) || cat.includes(q) || brand.includes(q);
    });
  }, [products, search]);

  const loadProducts = () => {
    const params = { search: search || undefined };
    if (settings?.business_type) {
      params.business_type = settings.business_type;
    }
    api
      .get('/products', { params })
      .then(async ({ data }) => {
        let list = Array.isArray(data) ? data : [];
        if (list.length === 0 && settings?.business_type) {
          try {
            const allRes = await api.get('/products', { params: { search: search || undefined } });
            if (Array.isArray(allRes.data) && allRes.data.length > 0) {
              list = allRes.data;
            }
          } catch {}
        }
        setProducts(list);
        if (list.length > 0) cacheProducts(list);
      })
      .catch((err) => console.error(err));
  };

  const loadCategories = () => {
    const bt = settings?.business_type;
    const catParams = bt ? { business_type: bt } : {};

    api.get('/categories', { params: catParams }).then(async ({ data }) => {
      let cats = Array.isArray(data) ? data : [];
      if (cats.length === 0 && bt) {
        try {
          const allCats = await api.get('/categories');
          if (Array.isArray(allCats.data) && allCats.data.length > 0) cats = allCats.data;
        } catch {}
      }
      setCategories(cats);
    }).catch(() => {});
  };

  const handleSaveQuickCategory = async (e) => {
    e.preventDefault();
    if (!quickCatForm.name.trim()) return;
    try {
      const payload = {
        name: quickCatForm.name.trim(),
        parent_id: null,
        business_type: settings?.business_type || 'mobile',
        is_active: 1,
      };
      const { data } = await api.post('/categories', payload);
      loadCategories();
      setForm((prev) => ({ ...prev, category_id: data.id }));
      setQuickCatModal(false);
      setQuickCatForm({ name: '', parent_id: '', business_type: '' });
      setSelectedMainCatId(String(data.id));
      setSelectedSubCatId('');
      setSuccess('Category created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create category');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSaveQuickSubCategory = async (e) => {
    e.preventDefault();
    if (!quickSubCatForm.name.trim() || !quickSubCatForm.parent_id) return;
    try {
      const payload = {
        name: quickSubCatForm.name.trim(),
        parent_id: quickSubCatForm.parent_id,
        business_type: settings?.business_type || 'mobile',
        is_active: 1,
      };
      const { data } = await api.post('/categories', payload);
      loadCategories();
      setForm((prev) => ({ ...prev, category_id: data.id }));
      setQuickSubCatModal(false);
      setQuickSubCatForm({ name: '', parent_id: '', business_type: '' });
      setSelectedMainCatId(String(data.parent_id));
      setSelectedSubCatId(String(data.id));
      setSuccess('Subcategory created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create subcategory');
      setTimeout(() => setError(''), 3000);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [settings?.business_type, search]);

  useEffect(() => {
    const bt = settings?.business_type;
    loadCategories();

    api.get('/lookup/brands', { params: bt ? { business_type: bt, is_active: 1 } : { is_active: 1 } }).then(async ({ data }) => {
      let bList = Array.isArray(data) ? data : [];
      if (bList.length === 0 && bt) {
        try {
          const allBrands = await api.get('/lookup/brands', { params: { is_active: 1 } });
          if (Array.isArray(allBrands.data) && allBrands.data.length > 0) bList = allBrands.data;
        } catch {}
      }
      // Ensure only active brands are available for product creation
      setBrands(bList.filter((b) => b.is_active !== 0 && b.is_active !== false && b.is_active !== '0'));
    }).catch(() => {});

    api.get('/lookup/units').then(({ data }) => setUnits(Array.isArray(data) ? data : [])).catch(() => {});
    api.get('/lookup/tax-rates').then(({ data }) => setTaxRates(Array.isArray(data) ? data : [])).catch(() => {});

    if (bt) {
      api.get(`/settings/business-types/${bt}/fields`).then(({ data }) => {
        setAttributeFields(Array.isArray(data) ? data : []);
      }).catch(() => {});
    }

    if (bt === 'food') {
      api.get('/lookup/addons').then(({ data }) => setAddonsList(Array.isArray(data) ? data : [])).catch(() => {});
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
    setSelectedMainCatId('');
    setSelectedSubCatId('');
    setIsEditing(false);
    setError('');
    setSuccess('');
    setActiveFormSection('basic');
  };

  const startEdit = (p) => {
    // Determine main category and subcategory from p.category_id
    const currentCat = categories.find((c) => String(c.id) === String(p.category_id));
    if (currentCat) {
      if (currentCat.parent_id) {
        setSelectedMainCatId(String(currentCat.parent_id));
        setSelectedSubCatId(String(currentCat.id));
      } else {
        setSelectedMainCatId(String(currentCat.id));
        setSelectedSubCatId('');
      }
    } else {
      setSelectedMainCatId('');
      setSelectedSubCatId('');
    }

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
      discount_percent: (p.mrp && (p.selling_price || p.retail_price) && Number(p.mrp) > Number(p.selling_price || p.retail_price))
        ? String(Math.round(((Number(p.mrp) - Number(p.selling_price || p.retail_price)) / Number(p.mrp)) * 100))
        : '',
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

    // Determine effective category_id: prefer subcategory if selected, else main category
    const effectiveCategoryId = selectedSubCatId || selectedMainCatId || form.category_id;

    // Prepare payload
    const uuid = form.uuid || newUuid();
    const payload = {
      ...form,
      uuid,
      business_type: businessType,
      category_id: effectiveCategoryId ? Number(effectiveCategoryId) : null,
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
    mobile: <Smartphone className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />,
    furniture: <Sofa className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />,
    food: <Utensils className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />,
  }[businessType];

  return (
    <div className="space-y-6">
      {/* Products & Master Navigation Options */}
      <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-[#121E2C] rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] shadow-sm overflow-x-auto scrollbar-thin">
        <Link
          to="/products"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[#0A4174] text-white shadow-sm dark:bg-[#4A8CD2] dark:text-[#0B131E] flex-shrink-0"
        >
          <Package className="w-4 h-4" />
          <span>All Products</span>
        </Link>
        <Link
          to="/master-data?tab=categories"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] hover:text-[#1C2736] dark:hover:bg-[#1A2A3D] dark:hover:text-[#F1F5F9] flex-shrink-0"
        >
          <Layers className="w-4 h-4" />
          <span>Categories</span>
        </Link>
        <Link
          to="/master-data?tab=subcategories"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] hover:text-[#1C2736] dark:hover:bg-[#1A2A3D] dark:hover:text-[#F1F5F9] flex-shrink-0"
        >
          <Layers className="w-4 h-4" />
          <span>Subcategories</span>
        </Link>
        <Link
          to="/master-data?tab=brands"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] hover:text-[#1C2736] dark:hover:bg-[#1A2A3D] dark:hover:text-[#F1F5F9] flex-shrink-0"
        >
          <Tags className="w-4 h-4" />
          <span>Brands</span>
        </Link>
      </div>

      {/* Main Grid: Left Catalog Table, Right Comprehensive Create/Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Products List (Left side - 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-bold text-[#5A6B82] px-1">
            <div className="flex items-center gap-2 uppercase tracking-wider flex-shrink-0">
              <span>Product Inventory ({products.length})</span>
              <span className="text-[#0A4174] dark:text-[#4A8CD2] capitalize text-[11px]">({businessType})</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-4 h-4 text-[#5A6B82] dark:text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, barcode, SKU..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-normal shadow-2xs"
                />
              </div>
              {isEditing && (
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] flex items-center gap-1 bg-white dark:bg-[#121E2C] shadow-2xs flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> New Product
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm max-h-[850px] overflow-y-auto scrollbar-thin">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D]/80 sticky top-0 text-left font-semibold text-[#5A6B82] dark:text-[#94A3B8] border-b border-[#DCE5EF] dark:border-[#22354B]">
                <tr>
                  <th className="px-3.5 py-2.5">Product</th>
                  <th className="px-3.5 py-2.5 text-right">Price ({currency})</th>
                  <th className="px-3.5 py-2.5 text-right">Stock</th>
                  <th className="px-3.5 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
                {filteredProducts.map((p) => {
                  const isLow = p.low_stock_threshold && Number(p.stock_qty || 0) <= Number(p.low_stock_threshold);
                  const isSelected = form.id === p.id;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => startEdit(p)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#E2EDF8] dark:bg-[#1A2A3D] border-l-4 border-[#0A4174] dark:border-[#4A8CD2]'
                          : 'hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/40'
                      }`}
                    >
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-[#1C2736] dark:text-[#F1F5F9] line-clamp-1">{p.name}</div>
                        <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] flex items-center gap-2">
                          {p.category_name && <span>{p.category_name}</span>}
                          {p.barcode && <span className="font-mono">#{p.barcode}</span>}
                          {p.variants?.length > 0 && (
                            <span className="text-[#0A4174] dark:text-[#4A8CD2] font-bold">({p.variants.length} var)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-bold text-[#0A4174] dark:text-[#4A8CD2]">
                        {formatCurrency(p.selling_price || 0, currency)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-medium">
                        <span className={`px-1.5 py-0.5 rounded ${isLow ? 'bg-red-50 dark:bg-red-950/40 text-red-500 font-bold' : 'text-[#5A6B82] dark:text-[#94A3B8]'}`}>
                          {Number(p.stock_qty || 0)} {p.unit_code || ''}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEdit(p)}
                            title="Edit"
                            className="p-1 text-[#0A4174] dark:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:bg-[#1A2A3D] dark:hover:bg-[#1A2A3D] rounded transition-colors"
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
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-[#5A6B82] dark:text-[#94A3B8] italic">
                      No products found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Comprehensive Product Form (Right side - 7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#121E2C] rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] shadow-sm p-6 space-y-5">
          {/* Form Action Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div>
              <h2 className="font-bold text-base flex items-center gap-2 text-[#1C2736] dark:text-[#F1F5F9]">
                <Plus className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                {isEditing ? `Edit Product: ${form.name}` : `Create New ${businessType.toUpperCase()} Product`}
              </h2>
              <p className="text-xs text-[#5A6B82]">Fill common information, pricing, variants & business specifications</p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#5A6B82] flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          {/* Form Section Navigation Pills */}
          <div className="flex flex-wrap gap-1.5 border-b border-[#DCE5EF] dark:border-[#22354B] pb-3">
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
                    ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-sm'
                    : 'bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#1C2736] dark:hover:text-white'
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
                  <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
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
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Main Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8]">Category *</label>
                      <button
                        type="button"
                        onClick={() => setQuickCatModal(true)}
                        className="text-[#0A4174] dark:text-[#4A8CD2] hover:underline font-bold flex items-center gap-0.5 text-[10px]"
                      >
                        <Plus className="w-3 h-3" /> + Category
                      </button>
                    </div>
                    <select
                      value={selectedMainCatId}
                      onChange={(e) => {
                        const newMainId = e.target.value;
                        setSelectedMainCatId(newMainId);
                        setSelectedSubCatId('');
                        setForm((prev) => ({ ...prev, category_id: newMainId }));
                      }}
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    >
                      <option value="">-- Select Category --</option>
                      {categories
                        .filter((c) => !c.parent_id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* 2. Subcategory (Filtered by selected Category) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8]">Subcategory</label>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickSubCatForm((prev) => ({ ...prev, parent_id: selectedMainCatId || '' }));
                          setQuickSubCatModal(true);
                        }}
                        className="text-[#0A4174] dark:text-[#4A8CD2] hover:underline font-bold flex items-center gap-0.5 text-[10px]"
                      >
                        <Plus className="w-3 h-3" /> + Subcategory
                      </button>
                    </div>
                    <select
                      value={selectedSubCatId}
                      disabled={!selectedMainCatId}
                      onChange={(e) => {
                        const subId = e.target.value;
                        setSelectedSubCatId(subId);
                        setForm((prev) => ({ ...prev, category_id: subId || selectedMainCatId }));
                      }}
                      className={`w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none ${
                        !selectedMainCatId ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">
                        {!selectedMainCatId
                          ? '-- Select Category First --'
                          : categories.filter((c) => String(c.parent_id) === String(selectedMainCatId)).length === 0
                          ? '-- No Subcategories Available --'
                          : '-- Select Subcategory (Optional) --'}
                      </option>
                      {categories
                        .filter((c) => String(c.parent_id) === String(selectedMainCatId))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* 3. Brand */}
                  <div>
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">Brand</label>
                    <select
                      value={form.brand_id}
                      onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    >
                      <option value="">-- Select Brand --</option>
                      {brands
                        .filter((b) => b.is_active !== 0 && b.is_active !== false && b.is_active !== '0')
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">SKU</label>
                    <input
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      placeholder="e.g. MOB-0012"
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-[#1C2736] dark:text-[#94A3B8]">Barcode</label>
                      <button
                        type="button"
                        onClick={generateBarcode}
                        className="text-[10px] text-[#0A4174] dark:text-[#4A8CD2] hover:underline flex items-center gap-0.5"
                      >
                        <Barcode className="w-3 h-3" /> Auto Gen
                      </button>
                    </div>
                    <input
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      placeholder="Type or auto-generate"
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">HSN Code</label>
                    <input
                      value={form.hsn_code}
                      onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
                      placeholder="e.g. 85171200"
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                    Product Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Enter detailed description, key specifications, or highlights..."
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />
                </div>


              </div>
            )}

            {/* SECTION 2: PRICING & TAXATION */}
            {activeFormSection === 'pricing' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-4 rounded-xl bg-[#F4F7FB] dark:bg-[#1A2A3D]/40 border border-[#DCE5EF] dark:border-[#22354B] space-y-3">
                  <div className="font-bold text-xs uppercase text-[#5A6B82] tracking-wider">
                    Price Tiers ({currency})
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                        MRP ({currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.mrp}
                        onChange={(e) => {
                          const newMrp = e.target.value;
                          const sp = Number(form.retail_price || form.selling_price || 0);
                          let disc = form.discount_percent;
                          if (newMrp && Number(newMrp) > 0 && sp > 0 && Number(newMrp) > sp) {
                            disc = String(Math.round(((Number(newMrp) - sp) / Number(newMrp)) * 100));
                          } else if (newMrp && sp >= Number(newMrp)) {
                            disc = '0';
                          }
                          setForm({ ...form, mrp: newMrp, discount_percent: disc });
                        }}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 font-bold focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                        Retail Selling Price *
                      </label>
                      <input
                        required
                        type="number"
                        step="any"
                        value={form.retail_price}
                        onChange={(e) => {
                          const newSp = e.target.value;
                          const mrpVal = Number(form.mrp || 0);
                          let disc = form.discount_percent;
                          if (mrpVal > 0 && newSp !== '' && mrpVal > Number(newSp)) {
                            disc = String(Math.round(((mrpVal - Number(newSp)) / mrpVal) * 100));
                          } else if (mrpVal > 0 && Number(newSp) >= mrpVal) {
                            disc = '0';
                          }
                          setForm({ ...form, retail_price: newSp, selling_price: newSp, discount_percent: disc });
                        }}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 font-bold text-[#0A4174] dark:text-[#4A8CD2] focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                        Discount %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={form.discount_percent}
                          onChange={(e) => {
                            const newDisc = e.target.value;
                            const mrpVal = Number(form.mrp || 0);
                            let newSp = form.retail_price;
                            if (mrpVal > 0 && newDisc !== '') {
                              const calcSp = Math.round((mrpVal - (mrpVal * Number(newDisc)) / 100) * 100) / 100;
                              newSp = String(Math.max(0, calcSp));
                            }
                            setForm({
                              ...form,
                              discount_percent: newDisc,
                              retail_price: newSp,
                              selling_price: newSp,
                            });
                          }}
                          placeholder="e.g. 15"
                          className="w-full rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 font-bold text-emerald-700 dark:text-emerald-400 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-emerald-600">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                        Purchase Price ({currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.purchase_price}
                        onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                        Wholesale Price
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.wholesale_price}
                        onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                        Customer Special Price
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={form.customer_price}
                        onChange={(e) => setForm({ ...form, customer_price: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Tax Configuration */}
                <div className="p-4 rounded-xl bg-[#F4F7FB] dark:bg-[#1A2A3D]/40 border border-[#DCE5EF] dark:border-[#22354B] space-y-3">
                  <div className="font-bold text-xs uppercase text-[#5A6B82] tracking-wider">
                    Taxation & GST
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">Tax Rate</label>
                      <select
                        value={form.tax_rate_id}
                        onChange={(e) => setForm({ ...form, tax_rate_id: e.target.value })}
                        className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
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
                      <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">Tax Calculation</label>
                      <select
                        value={form.tax_inclusive ? '1' : '0'}
                        onChange={(e) => setForm({ ...form, tax_inclusive: e.target.value === '1' })}
                        className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
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
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">Stock Unit</label>
                    <select
                      value={form.unit_id}
                      onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
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
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                      Current Stock Qty
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.stock_qty}
                      onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 font-bold focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                      Opening Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.opening_stock}
                      onChange={(e) => setForm({ ...form, opening_stock: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                      Low Stock Alert
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.low_stock_threshold}
                      onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                      placeholder="e.g. 5"
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                      Minimum Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.min_stock}
                      onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                      placeholder="e.g. 2"
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
                      Maximum Stock
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={form.max_stock}
                      onChange={(e) => setForm({ ...form, max_stock: e.target.value })}
                      placeholder="e.g. 100"
                      className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Mobile Shop: Unique IMEI / Serial Number Tracking */}
                {businessType === 'mobile' && (
                  <div className="p-4 rounded-xl bg-[#E2EDF8]/50 dark:bg-[#1A2A3D]/50 dark:bg-[#1A2A3D] border border-[#DCE5EF] dark:border-[#22354B] dark:border-[#22354B] space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-[#0A4174] dark:text-[#9BBFE0] flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4" />
                          Individual Device IMEI & Serial Tracking
                        </div>
                        <p className="text-[11px] text-[#5A6B82]">
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
                        <div className="w-11 h-6 bg-[#E2EDF8] peer-focus:outline-none rounded-full peer dark:bg-[#22354B] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#DCE5EF] dark:border-[#22354B] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0A4174] dark:bg-[#4A8CD2]"></div>
                      </label>
                    </div>

                    {form.track_serial && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-[#1C2736] dark:text-[#94A3B8]">
                            Registered Devices / IMEIs ({form.serials?.length || 0})
                          </span>
                          <button
                            type="button"
                            onClick={addSerialRow}
                            className="text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> + Add Device IMEI
                          </button>
                        </div>

                        {form.serials?.map((s, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                value={s.imei1}
                                onChange={(e) => updateSerialRow(idx, { imei1: e.target.value })}
                                placeholder="Primary IMEI 1 (15 digits)"
                                className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs font-mono"
                              />
                              <input
                                value={s.imei2}
                                onChange={(e) => updateSerialRow(idx, { imei2: e.target.value })}
                                placeholder="Secondary IMEI 2 (Optional)"
                                className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs font-mono"
                              />
                              <div className="flex gap-1">
                                <input
                                  value={s.serial_no}
                                  onChange={(e) => updateSerialRow(idx, { serial_no: e.target.value })}
                                  placeholder="Serial Number / S/N"
                                  className="flex-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs font-mono"
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
                                className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1 text-[11px]"
                              />
                              <input
                                type="number"
                                value={s.warranty_months}
                                onChange={(e) => updateSerialRow(idx, { warranty_months: e.target.value })}
                                placeholder="Warranty (Months)"
                                className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1 text-[11px]"
                              />
                              <input
                                type="date"
                                value={s.warranty_start}
                                onChange={(e) => updateSerialRow(idx, { warranty_start: e.target.value })}
                                className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1 text-[11px]"
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
                <div className="p-3.5 rounded-xl bg-[#F4F7FB] dark:bg-[#1A2A3D]/40 border border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {businessIcon}
                    <span className="font-bold text-xs uppercase text-[#1C2736] dark:text-[#94A3B8]">
                      {businessType} Specific Attributes
                    </span>
                  </div>
                  <span className="text-[11px] text-[#5A6B82] font-medium">
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
                          <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
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
                            className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
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
                          <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
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
                            className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={field.field_key}>
                        <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-1">
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
                          className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
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
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#F4F7FB] dark:bg-[#1A2A3D]/40 border border-[#DCE5EF] dark:border-[#22354B]">
                  <div>
                    <span className="font-bold text-xs uppercase text-[#1C2736] dark:text-[#94A3B8] block">
                      Product Variants
                    </span>
                    <span className="text-[11px] text-[#5A6B82]">
                      e.g. Size (Small/Large), RAM/Storage (8GB/128GB), Color (Teak/Walnut)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addVariantRow}
                    className="px-3 py-1.5 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Variant
                  </button>
                </div>

                <div className="space-y-2.5">
                  {form.variants?.map((v, i) => (
                    <div key={i} className="p-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#0A4174] dark:text-[#4A8CD2]">Variant #{i + 1}</span>
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
                            className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs font-medium"
                          />
                        </div>
                        <div>
                          <input
                            value={v.sku}
                            onChange={(e) => updateVariantRow(i, { sku: e.target.value })}
                            placeholder="Variant SKU"
                            className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <input
                            value={v.barcode}
                            onChange={(e) => updateVariantRow(i, { barcode: e.target.value })}
                            placeholder="Variant Barcode"
                            className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] block">Price Adjust ({currency})</label>
                          <input
                            type="number"
                            step="any"
                            value={v.price_adjustment}
                            onChange={(e) => updateVariantRow(i, { price_adjustment: e.target.value })}
                            placeholder="+/- 0.00"
                            className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] block">Exact Selling Price ({currency})</label>
                          <input
                            type="number"
                            step="any"
                            value={v.selling_price}
                            onChange={(e) => updateVariantRow(i, { selling_price: e.target.value })}
                            placeholder="Override Price"
                            className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1 text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] block">Variant Stock</label>
                          <input
                            type="number"
                            step="any"
                            value={v.stock_qty}
                            onChange={(e) => updateVariantRow(i, { stock_qty: e.target.value })}
                            placeholder="0"
                            className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2.5 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!form.variants || form.variants.length === 0) && (
                    <div className="p-8 text-center text-[#5A6B82] dark:text-[#94A3B8] border border-dashed border-[#DCE5EF] dark:border-[#22354B] rounded-xl">
                      No variants added. This product will be sold as a single standard item.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 6: HOTEL / RESTAURANT ADD-ONS MANAGEMENT */}
            {businessType === 'food' && activeFormSection === 'addons' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-[#E2EDF8]/50 dark:bg-[#1A2A3D]/50 dark:bg-[#1A2A3D] border border-[#DCE5EF] dark:border-[#22354B] dark:border-[#22354B] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#0A4174] dark:text-[#9BBFE0] block">
                      Food Add-ons & Extra Toppings
                    </span>
                    <span className="text-[11px] text-[#5A6B82]">
                      Configured add-on items appear dynamically during POS billing for customization
                    </span>
                  </div>
                </div>

                {/* Quick Add-on Creator Box */}
                <div className="p-3 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/60 dark:bg-[#1A2A3D]/40 space-y-2">
                  <span className="font-bold text-[11px] text-[#1C2736] dark:text-[#94A3B8] block">
                    Create Reusable Food Add-on
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      value={newAddonGroup.name}
                      onChange={(e) => setNewAddonGroup({ ...newAddonGroup, name: e.target.value })}
                      placeholder="Add-on Name (e.g. Extra Cheese)"
                      className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      step="any"
                      value={newAddonGroup.price}
                      onChange={(e) => setNewAddonGroup({ ...newAddonGroup, price: e.target.value })}
                      placeholder={`Extra Price (${currency})`}
                      className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2.5 py-1.5 text-xs"
                    />
                    <input
                      value={newAddonGroup.group_name}
                      onChange={(e) => setNewAddonGroup({ ...newAddonGroup, group_name: e.target.value })}
                      placeholder="Group (e.g. Toppings / Sides)"
                      className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleCreateAddon}
                      className="rounded-lg bg-[#0A4174] dark:bg-[#4A8CD2] hover:bg-[#062E52] dark:hover:bg-[#6BA3E0] font-bold text-white dark:text-[#0B131E] py-1.5 text-xs shadow-sm"
                    >
                      + Save Add-on
                    </button>
                  </div>
                </div>

                {/* Add-ons List */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-xs text-[#1C2736] dark:text-[#94A3B8] block">
                    Available Add-ons in System ({addonsList.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {addonsList.map((a) => (
                      <div key={a.id} className="p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#1C2736] dark:text-[#F1F5F9] block">{a.name}</span>
                          <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">{a.group_name || 'General'}</span>
                        </div>
                        <span className="font-bold text-xs text-emerald-600">
                          +{formatCurrency(a.price, currency)}
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
                <div className="p-4 rounded-xl bg-[#F4F7FB] dark:bg-[#1A2A3D]/40 border border-[#DCE5EF] dark:border-[#22354B] space-y-3">
                  <span className="font-bold text-xs uppercase text-[#5A6B82] tracking-wider block">
                    Sales Channel Visibility & Policies
                  </span>

                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] cursor-pointer">
                      <div>
                        <span className="font-bold block text-[#1C2736] dark:text-[#F1F5F9]">POS Sale Enabled</span>
                        <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">Display and sell this item on the POS Billing cashier screen</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.pos_enabled}
                        onChange={(e) => setForm({ ...form, pos_enabled: e.target.checked })}
                        className="w-4 h-4 accent-[#0A4174] rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] cursor-pointer">
                      <div>
                        <span className="font-bold block text-[#1C2736] dark:text-[#F1F5F9]">Online Sale Enabled</span>
                        <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">Expose product on online catalog & sync to external web channels</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.online_enabled}
                        onChange={(e) => setForm({ ...form, online_enabled: e.target.checked })}
                        className="w-4 h-4 accent-[#0A4174] rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] cursor-pointer">
                      <div>
                        <span className="font-bold block text-[#1C2736] dark:text-[#F1F5F9]">Product Returnable</span>
                        <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">Allow customers to return this product for refund or credit note</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.is_returnable}
                        onChange={(e) => setForm({ ...form, is_returnable: e.target.checked })}
                        className="w-4 h-4 accent-[#0A4174] rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] cursor-pointer">
                      <div>
                        <span className="font-bold block text-[#1C2736] dark:text-[#F1F5F9]">Product Status (Active / Inactive)</span>
                        <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">Inactive products are hidden from daily operations</span>
                      </div>
                      <select
                        value={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                        className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-xs font-semibold"
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
            <div className="pt-4 border-t border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {activeFormSection !== 'basic' && (
                  <button
                    type="button"
                    onClick={() => {
                      const sections = ['basic', 'pricing', 'inventory', 'specs', 'variants', ...(businessType === 'food' ? ['addons'] : []), 'settings'];
                      const idx = sections.indexOf(activeFormSection);
                      if (idx > 0) setActiveFormSection(sections[idx - 1]);
                    }}
                    className="px-3 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
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
                    className="px-3 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
                  >
                    Next →
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-black text-xs shadow-md transition-colors"
                >
                  {isEditing ? 'Save Product Changes' : 'Create Product Now'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Quick Create Category Modal */}
      {quickCatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                Create New Category
              </h3>
              <button onClick={() => setQuickCatModal(false)} className="text-[#5A6B82] hover:text-[#1C2736]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1C2736] dark:text-[#F1F5F9] mb-1">Category Name *</label>
                <input
                  required
                  value={quickCatForm.name}
                  onChange={(e) => setQuickCatForm({ ...quickCatForm, name: e.target.value })}
                  placeholder="e.g. Smart TV, Living Room, Desserts"
                  className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickCatModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] font-bold"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Subcategory Modal */}
      {quickSubCatModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                Create New Subcategory
              </h3>
              <button onClick={() => setQuickSubCatModal(false)} className="text-[#5A6B82] hover:text-[#1C2736]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickSubCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1C2736] dark:text-[#F1F5F9] mb-1">Parent Category *</label>
                <select
                  required
                  value={quickSubCatForm.parent_id}
                  onChange={(e) => setQuickSubCatForm({ ...quickSubCatForm, parent_id: e.target.value })}
                  className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                >
                  <option value="">-- Select Parent Category --</option>
                  {categories.filter((c) => !c.parent_id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#1C2736] dark:text-[#F1F5F9] mb-1">Subcategory Name *</label>
                <input
                  required
                  value={quickSubCatForm.name}
                  onChange={(e) => setQuickSubCatForm({ ...quickSubCatForm, name: e.target.value })}
                  placeholder="e.g. OLED TV, Dining Chairs, Starters"
                  className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3 py-2 text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickSubCatModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] font-bold"
                >
                  Save Subcategory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
