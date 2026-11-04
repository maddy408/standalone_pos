import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import {
  Layers,
  Tags,
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  X,
  CheckCircle2,
  Search
} from 'lucide-react';

const TABS = [
  { id: 'categories', label: 'Categories & Subcategories', icon: Layers },
  { id: 'brands', label: 'Brands Mapping', icon: Tags },
  { id: 'units', label: 'Units', icon: Layers },
  { id: 'tax_rates', label: 'Tax Rates', icon: Layers },
];

export default function MasterData() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'categories';

  const [tab, setTab] = useState(initialTab);
  const [rows, setRows] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Forms
  const [catForm, setCatForm] = useState({ id: null, name: '', business_type: '', parent_id: '', is_active: 1 });
  const [brandForm, setBrandForm] = useState({ id: null, name: '', business_type: '', is_active: 1 });
  const [unitForm, setUnitForm] = useState({ id: null, name: '', short_code: '' });
  const [taxForm, setTaxForm] = useState({ id: null, name: '', percent: '' });

  const endpoint =
    tab === 'categories'
      ? '/categories'
      : tab === 'tax_rates'
      ? '/lookup/tax-rates'
      : `/lookup/${tab}`;

  const loadCategories = () => {
    api.get('/categories', { params: { business_type: settings?.business_type || undefined } })
      .then(({ data }) => setCategoriesList(data));
  };

  const load = () => {
    const params = {};
    if (tab === 'categories' || tab === 'brands') {
      if (settings?.business_type) {
        params.business_type = settings.business_type;
      }
    }
    api.get(endpoint, { params }).then(({ data }) => setRows(data));
    if (tab === 'categories') {
      loadCategories();
    }
  };

  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (qTab && qTab !== tab) {
      setTab(qTab);
    }
  }, [searchParams]);

  useEffect(() => {
    resetForms();
    load();
  }, [tab, settings?.business_type]);

  const resetForms = () => {
    const bt = settings?.business_type || 'mobile';
    setCatForm({ id: null, name: '', business_type: bt, parent_id: '', is_active: 1 });
    setBrandForm({ id: null, name: '', business_type: bt, is_active: 1 });
    setUnitForm({ id: null, name: '', short_code: '' });
    setTaxForm({ id: null, name: '', percent: '' });
    setIsEditing(false);
    setError('');
  };

  const handleTabChange = (tId) => {
    setTab(tId);
    setSearchParams({ tab: tId });
  };

  // Submit Handler
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (tab === 'categories') {
        const payload = {
          name: catForm.name.trim(),
          business_type: catForm.business_type || settings?.business_type,
          parent_id: catForm.parent_id ? Number(catForm.parent_id) : null,
          is_active: catForm.is_active,
        };
        if (catForm.id) {
          await api.put(`/categories/${catForm.id}`, payload);
        } else {
          await api.post('/categories', payload);
        }
      } else if (tab === 'brands') {
        const payload = {
          name: brandForm.name.trim(),
          business_type: brandForm.business_type || null,
          is_active: brandForm.is_active,
        };
        if (brandForm.id) {
          await api.put(`/lookup/brands/${brandForm.id}`, payload);
        } else {
          await api.post('/lookup/brands', payload);
        }
      } else if (tab === 'units') {
        const payload = { name: unitForm.name.trim(), short_code: unitForm.short_code.trim() };
        if (unitForm.id) {
          await api.put(`/lookup/units/${unitForm.id}`, payload);
        } else {
          await api.post('/lookup/units', payload);
        }
      } else if (tab === 'tax_rates') {
        const payload = { name: taxForm.name.trim(), percent: Number(taxForm.percent) };
        if (taxForm.id) {
          await api.put(`/lookup/tax-rates/${taxForm.id}`, payload);
        } else {
          await api.post('/lookup/tax-rates', payload);
        }
      }
      resetForms();
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const startEditCategory = (c) => {
    setCatForm({
      id: c.id,
      name: c.name,
      business_type: c.business_type,
      parent_id: c.parent_id || '',
      is_active: c.is_active ?? 1,
    });
    setIsEditing(true);
  };

  const startEditBrand = (b) => {
    setBrandForm({
      id: b.id,
      name: b.name,
      business_type: b.business_type || '',
      is_active: b.is_active ?? 1,
    });
    setIsEditing(true);
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
      load();
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
      load();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const deleteRow = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    return r.name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-5">
      {/* Tab Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {TABS.map((tItem) => {
          const Icon = tItem.icon;
          const active = tab === tItem.id;
          return (
            <button
              key={tItem.id}
              onClick={() => handleTabChange(tItem.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                active
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tItem.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table View */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              {TABS.find((x) => x.id === tab)?.label} List
            </h2>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5">Name</th>
                  {tab === 'categories' && <th className="px-3.5 py-2.5">Category Type</th>}
                  {tab === 'categories' && <th className="px-3.5 py-2.5">Parent Category</th>}
                  {tab === 'brands' && <th className="px-3.5 py-2.5">Scope</th>}
                  {tab === 'units' && <th className="px-3.5 py-2.5">Code</th>}
                  {tab === 'tax_rates' && <th className="px-3.5 py-2.5">Rate (%)</th>}
                  {(tab === 'categories' || tab === 'brands') && <th className="px-3.5 py-2.5">Status</th>}
                  <th className="px-3.5 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.map((r) => {
                  const parentCat = categoriesList.find((c) => c.id === r.parent_id);
                  const isActive = (r.is_active ?? 1) === 1;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium">{r.name}</td>

                      {tab === 'categories' && (
                        <td className="px-3.5 py-2.5">
                          {r.parent_id ? (
                            <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded text-[10px]">
                              Subcategory
                            </span>
                          ) : (
                            <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded text-[10px]">
                              Main Category
                            </span>
                          )}
                        </td>
                      )}

                      {tab === 'categories' && (
                        <td className="px-3.5 py-2.5 text-slate-500">
                          {parentCat ? parentCat.name : '—'}
                        </td>
                      )}

                      {tab === 'brands' && (
                        <td className="px-3.5 py-2.5">
                          <span className="capitalize font-medium text-slate-600 dark:text-slate-300">
                            {r.business_type || 'Universal'}
                          </span>
                        </td>
                      )}

                      {tab === 'units' && <td className="px-3.5 py-2.5 font-mono">{r.short_code}</td>}
                      {tab === 'tax_rates' && <td className="px-3.5 py-2.5 font-bold">{r.percent}%</td>}

                      {(tab === 'categories' || tab === 'brands') && (
                        <td className="px-3.5 py-2.5">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              Inactive
                            </span>
                          )}
                        </td>
                      )}

                      <td className="px-3.5 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              if (tab === 'categories') startEditCategory(r);
                              else if (tab === 'brands') startEditBrand(r);
                              else if (tab === 'units') {
                                setUnitForm(r);
                                setIsEditing(true);
                              } else if (tab === 'tax_rates') {
                                setTaxForm(r);
                                setIsEditing(true);
                              }
                            }}
                            title="Edit"
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {(tab === 'categories' || tab === 'brands') && (
                            <button
                              onClick={() => {
                                if (tab === 'categories') toggleCategoryStatus(r);
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
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Drawer / Box */}
        <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 self-start">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-500" />
              {isEditing ? `Edit ${tab}` : `Add New ${tab}`}
            </h3>
            {isEditing && (
              <button
                onClick={resetForms}
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
            {/* Category Form */}
            {tab === 'categories' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Category Name *
                  </label>
                  <input
                    required
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    placeholder="e.g. Smart Phones or Screen Protectors"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Parent Category (Optional - select for Subcategory)
                  </label>
                  <select
                    value={catForm.parent_id}
                    onChange={(e) => setCatForm({ ...catForm, parent_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- None (This is a Main Category) --</option>
                    {categoriesList
                      .filter((c) => !c.parent_id && c.id !== catForm.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    value={catForm.is_active}
                    onChange={(e) => setCatForm({ ...catForm, is_active: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive (Deactivated)</option>
                  </select>
                </div>
              </>
            )}

            {/* Brand Form */}
            {tab === 'brands' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Brand Name *
                  </label>
                  <input
                    required
                    value={brandForm.name}
                    onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                    placeholder="e.g. Apple, Samsung, Godrej"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    value={brandForm.is_active}
                    onChange={(e) => setBrandForm({ ...brandForm, is_active: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive (Deactivated)</option>
                  </select>
                </div>
              </>
            )}

            {/* Units Form */}
            {tab === 'units' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Unit Name *
                  </label>
                  <input
                    required
                    value={unitForm.name}
                    onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                    placeholder="e.g. Piece, Box, Kilogram"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Short Code *
                  </label>
                  <input
                    required
                    value={unitForm.short_code}
                    onChange={(e) => setUnitForm({ ...unitForm, short_code: e.target.value })}
                    placeholder="e.g. pcs, box, kg"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* Tax Rates Form */}
            {tab === 'tax_rates' && (
              <>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Tax Name *
                  </label>
                  <input
                    required
                    value={taxForm.name}
                    onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                    placeholder="e.g. GST 18%, Exempt"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                    Percentage (%) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={taxForm.percent}
                    onChange={(e) => setTaxForm({ ...taxForm, percent: e.target.value })}
                    placeholder="e.g. 18"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 transition-colors shadow-sm"
              >
                {isEditing ? 'Save Changes' : 'Save'}
              </button>
              <button
                type="button"
                onClick={resetForms}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
