import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import {
  Layers,
  Package,
  Tags,
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  X,
  CheckCircle2,
  Search,
  ChevronRight,
  FolderPlus,
  FolderTree,
} from 'lucide-react';

const TABS = [
  { id: 'categories', label: 'Categories', icon: FolderPlus },
  { id: 'subcategories', label: 'Subcategories', icon: FolderTree },
  { id: 'brands', label: 'Brands', icon: Tags },
  { id: 'units', label: 'Units', icon: Layers },
  { id: 'tax_rates', label: 'Tax Rates', icon: Layers },
];

export default function MasterData() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'categories';

  const [tab, setTab] = useState(initialTab === 'subcategories' ? 'subcategories' : initialTab);
  const [categoriesList, setCategoriesList] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
  const [unitsList, setUnitsList] = useState([]);
  const [taxRatesList, setTaxRatesList] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  // Individual Dedicated Forms
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '', business_type: '', is_active: 1 });
  const [subCategoryForm, setSubCategoryForm] = useState({ id: null, name: '', parent_id: '', business_type: '', is_active: 1 });
  const [brandForm, setBrandForm] = useState({ id: null, name: '', business_type: '', is_active: 1 });
  const [unitForm, setUnitForm] = useState({ id: null, name: '', short_code: '' });
  const [taxForm, setTaxForm] = useState({ id: null, name: '', percent: '' });

  const loadAll = async () => {
    const bt = settings?.business_type;
    const catParams = bt ? { business_type: bt } : {};

    // 1. Categories
    try {
      const { data } = await api.get('/categories', { params: catParams });
      let list = Array.isArray(data) ? data : [];
      if (list.length === 0 && bt) {
        const allRes = await api.get('/categories');
        if (Array.isArray(allRes.data) && allRes.data.length > 0) list = allRes.data;
      }
      setCategoriesList(list);
    } catch {}

    // 2. Brands
    try {
      const { data } = await api.get('/lookup/brands', { params: catParams });
      let list = Array.isArray(data) ? data : [];
      if (list.length === 0 && bt) {
        const allRes = await api.get('/lookup/brands');
        if (Array.isArray(allRes.data) && allRes.data.length > 0) list = allRes.data;
      }
      setBrandsList(list);
    } catch {}

    // 3. Units
    try {
      const { data } = await api.get('/lookup/units');
      setUnitsList(Array.isArray(data) ? data : []);
    } catch {}

    // 4. Tax Rates
    try {
      const { data } = await api.get('/lookup/tax-rates');
      setTaxRatesList(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (qTab && qTab !== tab) {
      setTab(qTab);
    }
  }, [searchParams]);

  useEffect(() => {
    resetForms();
    loadAll();
  }, [tab, settings?.business_type]);

  const resetForms = () => {
    const bt = settings?.business_type || 'mobile';
    setCategoryForm({ id: null, name: '', business_type: bt, is_active: 1 });
    setSubCategoryForm({ id: null, name: '', parent_id: '', business_type: bt, is_active: 1 });
    setBrandForm({ id: null, name: '', business_type: bt, is_active: 1 });
    setUnitForm({ id: null, name: '', short_code: '' });
    setTaxForm({ id: null, name: '', percent: '' });
    setIsEditing(false);
    setError('');
  };

  const handleTabChange = (tId) => {
    setTab(tId);
    setSearchParams({ tab: tId });
    setSearch('');
    resetForms();
  };

  // Main Categories (parent_id is null/empty)
  const mainCategories = categoriesList.filter((c) => !c.parent_id);

  // Subcategories (parent_id is present)
  const subCategories = categoriesList.filter((c) => Boolean(c.parent_id));

  // Determine rows based on current active tab
  const getTabRows = () => {
    switch (tab) {
      case 'categories':
        return mainCategories;
      case 'subcategories':
        return subCategories;
      case 'brands':
        return brandsList;
      case 'units':
        return unitsList;
      case 'tax_rates':
        return taxRatesList;
      default:
        return [];
    }
  };

  // Submit Handler
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const bt = settings?.business_type || 'mobile';
    try {
      if (tab === 'categories') {
        if (!categoryForm.name.trim()) return;
        const payload = {
          name: categoryForm.name.trim(),
          business_type: categoryForm.business_type || bt,
          parent_id: null,
          is_active: categoryForm.is_active,
        };
        if (categoryForm.id) {
          await api.put(`/categories/${categoryForm.id}`, payload);
          setSuccess('Category updated successfully!');
        } else {
          await api.post('/categories', payload);
          setSuccess('Category created successfully!');
        }
      } else if (tab === 'subcategories') {
        if (!subCategoryForm.name.trim() || !subCategoryForm.parent_id) {
          setError('Please enter subcategory name and select parent category');
          return;
        }
        const payload = {
          name: subCategoryForm.name.trim(),
          business_type: subCategoryForm.business_type || bt,
          parent_id: Number(subCategoryForm.parent_id),
          is_active: subCategoryForm.is_active,
        };
        if (subCategoryForm.id) {
          await api.put(`/categories/${subCategoryForm.id}`, payload);
          setSuccess('Subcategory updated successfully!');
        } else {
          await api.post('/categories', payload);
          setSuccess('Subcategory created successfully!');
        }
      } else if (tab === 'brands') {
        if (!brandForm.name.trim()) return;
        const payload = {
          name: brandForm.name.trim(),
          business_type: brandForm.business_type || bt,
          is_active: brandForm.is_active,
        };
        if (brandForm.id) {
          await api.put(`/lookup/brands/${brandForm.id}`, payload);
          setSuccess('Brand updated successfully!');
        } else {
          await api.post('/lookup/brands', payload);
          setSuccess('Brand created successfully!');
        }
      } else if (tab === 'units') {
        if (!unitForm.name.trim() || !unitForm.short_code.trim()) return;
        const payload = { name: unitForm.name.trim(), short_code: unitForm.short_code.trim() };
        if (unitForm.id) {
          await api.put(`/lookup/units/${unitForm.id}`, payload);
          setSuccess('Unit updated successfully!');
        } else {
          await api.post('/lookup/units', payload);
          setSuccess('Unit created successfully!');
        }
      } else if (tab === 'tax_rates') {
        if (!taxForm.name.trim() || taxForm.percent === '') return;
        const payload = { name: taxForm.name.trim(), percent: Number(taxForm.percent) };
        if (taxForm.id) {
          await api.put(`/lookup/tax-rates/${taxForm.id}`, payload);
          setSuccess('Tax rate updated successfully!');
        } else {
          await api.post('/lookup/tax-rates', payload);
          setSuccess('Tax rate created successfully!');
        }
      }
      resetForms();
      loadAll();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const startEdit = (row) => {
    setIsEditing(true);
    setError('');
    if (tab === 'categories') {
      setCategoryForm({
        id: row.id,
        name: row.name,
        business_type: row.business_type || settings?.business_type || '',
        is_active: row.is_active ?? 1,
      });
    } else if (tab === 'subcategories') {
      setSubCategoryForm({
        id: row.id,
        name: row.name,
        parent_id: row.parent_id || '',
        business_type: row.business_type || settings?.business_type || '',
        is_active: row.is_active ?? 1,
      });
    } else if (tab === 'brands') {
      setBrandForm({
        id: row.id,
        name: row.name,
        business_type: row.business_type || '',
        is_active: row.is_active ?? 1,
      });
    } else if (tab === 'units') {
      setUnitForm(row);
    } else if (tab === 'tax_rates') {
      setTaxForm(row);
    }
  };

  const toggleCategoryStatus = async (c) => {
    const nextStatus = (c.is_active ?? 1) ? 0 : 1;
    try {
      await api.put(`/categories/${c.id}`, {
        name: c.name,
        business_type: c.business_type,
        parent_id: c.parent_id,
        is_active: nextStatus,
      });
      loadAll();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const toggleBrandStatus = async (b) => {
    const nextStatus = (b.is_active ?? 1) ? 0 : 1;
    try {
      await api.put(`/lookup/brands/${b.id}`, {
        name: b.name,
        business_type: b.business_type,
        is_active: nextStatus,
      });
      loadAll();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const deleteRow = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this?')) return;
    try {
      const endpoint =
        tab === 'categories' || tab === 'subcategories'
          ? `/categories/${id}`
          : tab === 'tax_rates'
          ? `/lookup/tax-rates/${id}`
          : `/lookup/${tab}/${id}`;
      await api.delete(endpoint);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const filteredRows = getTabRows().filter((r) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const nameMatch = r.name?.toLowerCase().includes(term);
    const parentCat = categoriesList.find((c) => c.id === r.parent_id);
    const parentMatch = parentCat?.name?.toLowerCase().includes(term);
    return nameMatch || parentMatch;
  });

  return (
    <div className="space-y-5">
      {/* Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DCE5EF] dark:border-[#22354B] pb-3">
        <Link
          to="/products"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-colors bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] border border-[#DCE5EF] dark:border-[#22354B]"
        >
          <Package className="w-4 h-4" />
          <span>All Products</span>
        </Link>
        {TABS.map((tItem) => {
          const Icon = tItem.icon;
          const active = tab === tItem.id;
          return (
            <button
              key={tItem.id}
              onClick={() => handleTabChange(tItem.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold tracking-wide transition-all ${
                active
                  ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-sm'
                  : 'bg-white dark:bg-[#121E2C] text-[#5A6B82] dark:text-[#94A3B8] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] border border-[#DCE5EF] dark:border-[#22354B]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tItem.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: LEFT SIDE = Form, RIGHT SIDE = Get List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: CREATE / EDIT FORM (5 cols)                 */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#121E2C] p-5 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2 text-[#1C2736] dark:text-[#F1F5F9]">
                <Plus className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                {isEditing ? `Edit ${TABS.find((x) => x.id === tab)?.label}` : `Create New ${TABS.find((x) => x.id === tab)?.label}`}
              </h3>
              <p className="text-[11px] text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">
                Fill the details below to add or update
              </p>
            </div>
            {isEditing && (
              <button
                onClick={resetForms}
                className="text-xs text-[#5A6B82] dark:text-[#94A3B8] hover:text-red-500 flex items-center gap-1 font-semibold"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-600 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-600 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4 text-xs">
            {/* 1. CATEGORY FORM */}
            {tab === 'categories' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Category Name *
                  </label>
                  <input
                    required
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="e.g. Smartphones, Furniture, Beverages"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Status
                  </label>
                  <select
                    value={categoryForm.is_active}
                    onChange={(e) => setCategoryForm({ ...categoryForm, is_active: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive (Deactivated)</option>
                  </select>
                </div>
              </>
            )}

            {/* 2. SUBCATEGORY FORM */}
            {tab === 'subcategories' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Parent Category *
                  </label>
                  <select
                    required
                    value={subCategoryForm.parent_id}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, parent_id: e.target.value })}
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-medium"
                  >
                    <option value="">-- Select Parent Category --</option>
                    {mainCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Subcategory Name *
                  </label>
                  <input
                    required
                    value={subCategoryForm.name}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, name: e.target.value })}
                    placeholder="e.g. 5G Mobiles, Dining Chairs, Fresh Juices"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Status
                  </label>
                  <select
                    value={subCategoryForm.is_active}
                    onChange={(e) => setSubCategoryForm({ ...subCategoryForm, is_active: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive (Deactivated)</option>
                  </select>
                </div>
              </>
            )}

            {/* 3. BRAND FORM */}
            {tab === 'brands' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Brand Name *
                  </label>
                  <input
                    required
                    value={brandForm.name}
                    onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                    placeholder="e.g. Apple, Samsung, Godrej, Britannia"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Status
                  </label>
                  <select
                    value={brandForm.is_active}
                    onChange={(e) => setBrandForm({ ...brandForm, is_active: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive (Deactivated)</option>
                  </select>
                </div>
              </>
            )}

            {/* 4. UNITS FORM */}
            {tab === 'units' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Unit Name *
                  </label>
                  <input
                    required
                    value={unitForm.name}
                    onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                    placeholder="e.g. Piece, Box, Kilogram"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Short Code *
                  </label>
                  <input
                    required
                    value={unitForm.short_code}
                    onChange={(e) => setUnitForm({ ...unitForm, short_code: e.target.value })}
                    placeholder="e.g. pcs, box, kg"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-mono"
                  />
                </div>
              </>
            )}

            {/* 5. TAX RATES FORM */}
            {tab === 'tax_rates' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Tax Name *
                  </label>
                  <input
                    required
                    value={taxForm.name}
                    onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                    placeholder="e.g. GST 18%, Exempt"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#F1F5F9]">
                    Percentage (%) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={taxForm.percent}
                    onChange={(e) => setTaxForm({ ...taxForm, percent: e.target.value })}
                    placeholder="e.g. 18"
                    className="w-full rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] px-3.5 py-2.5 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
                  />
                </div>
              </>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold py-2.5 transition-colors shadow-sm text-xs"
              >
                {isEditing ? 'Save Changes' : `Save ${TABS.find((x) => x.id === tab)?.label}`}
              </button>
              <button
                type="button"
                onClick={resetForms}
                className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] px-4 py-2.5 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] text-[#5A6B82] font-semibold text-xs"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: GET LIST TABLE (7 cols)                    */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#121E2C] p-4 rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] shadow-sm">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <span>{TABS.find((x) => x.id === tab)?.label} List</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] font-mono">
                  {filteredRows.length}
                </span>
              </h2>
              <p className="text-[11px] text-[#5A6B82] dark:text-[#94A3B8]">
                {tab === 'categories'
                  ? 'Showing all Top-level / Parent Categories'
                  : tab === 'subcategories'
                  ? 'Showing all Subcategories grouped with their Parent Category'
                  : `Showing all ${TABS.find((x) => x.id === tab)?.label}`}
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#5A6B82] dark:text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm max-h-[700px] overflow-y-auto scrollbar-thin">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] sticky top-0 text-left font-semibold text-[#5A6B82] dark:text-[#94A3B8] border-b border-[#DCE5EF] dark:border-[#22354B]">
                <tr>
                  <th className="px-3.5 py-2.5">Name</th>
                  {tab === 'subcategories' && <th className="px-3.5 py-2.5">Parent Category</th>}
                  {tab === 'brands' && <th className="px-3.5 py-2.5">Scope</th>}
                  {tab === 'units' && <th className="px-3.5 py-2.5">Code</th>}
                  {tab === 'tax_rates' && <th className="px-3.5 py-2.5">Rate (%)</th>}
                  {(tab === 'categories' || tab === 'subcategories' || tab === 'brands') && (
                    <th className="px-3.5 py-2.5">Status</th>
                  )}
                  <th className="px-3.5 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
                {filteredRows.map((r) => {
                  const parentCat = categoriesList.find((c) => c.id === r.parent_id);
                  const isActive = (r.is_active ?? 1) === 1;
                  return (
                    <tr key={r.id} className="hover:bg-[#F4F7FB]/60 dark:hover:bg-[#1A2A3D]/40 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-[#1C2736] dark:text-[#F1F5F9]">{r.name}</td>

                      {/* Parent Category column for subcategories */}
                      {tab === 'subcategories' && (
                        <td className="px-3.5 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#E2EDF8] dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] font-semibold text-[11px]">
                            {parentCat ? parentCat.name : '—'}
                          </span>
                        </td>
                      )}

                      {tab === 'brands' && (
                        <td className="px-3.5 py-2.5">
                          <span className="capitalize font-medium text-[#5A6B82] dark:text-[#94A3B8]">
                            {r.business_type || 'Universal'}
                          </span>
                        </td>
                      )}

                      {tab === 'units' && <td className="px-3.5 py-2.5 font-mono">{r.short_code}</td>}
                      {tab === 'tax_rates' && <td className="px-3.5 py-2.5 font-bold">{r.percent}%</td>}

                      {(tab === 'categories' || tab === 'subcategories' || tab === 'brands') && (
                        <td className="px-3.5 py-2.5">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#5A6B82] dark:text-[#94A3B8] font-medium bg-[#E2EDF8] dark:bg-[#1A2A3D] px-2 py-0.5 rounded text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#5A6B82]"></span>
                              Inactive
                            </span>
                          )}
                        </td>
                      )}

                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEdit(r)}
                            title="Edit"
                            className="p-1.5 text-[#0A4174] hover:text-[#062E52] dark:text-[#4A8CD2] dark:hover:text-[#6BA3E0] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {(tab === 'categories' || tab === 'subcategories' || tab === 'brands') && (
                            <button
                              onClick={() => {
                                if (tab === 'categories' || tab === 'subcategories') toggleCategoryStatus(r);
                                else if (tab === 'brands') toggleBrandStatus(r);
                              }}
                              title={isActive ? 'Deactivate' : 'Reactivate'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive
                                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          <button
                            onClick={() => deleteRow(r.id)}
                            title="Delete"
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-[#5A6B82] dark:text-[#94A3B8]">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
