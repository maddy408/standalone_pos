import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { cacheProducts } from '../db/db';

const BLANK_FORM = {
  id: null,
  business_type: 'mobile',
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
  stock_qty: '',
  low_stock_threshold: '',
  track_serial: false,
  attributes: {},
  serials: [{ imei1: '', imei2: '', serial_no: '' }],
};

function AttributeField({ field, value, onChange }) {
  const label = field.label_en;
  if (field.field_type === 'select') {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium">
          {label} {field.is_required ? '*' : ''}
        </label>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
        >
          <option value="">--</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label_en}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.field_type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label} {field.is_required ? '*' : ''} {field.unit_suffix ? `(${field.unit_suffix})` : ''}
      </label>
      <input
        type={field.field_type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
      />
    </div>
  );
}

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

  const loadProducts = () => {
    api.get('/products', { params: { search: search || undefined } }).then(({ data }) => {
      setProducts(data);
      cacheProducts(data);
    });
  };

  useEffect(() => {
    loadProducts();
    api.get('/lookup/brands').then(({ data }) => setBrands(data));
    api.get('/lookup/units').then(({ data }) => setUnits(data));
    api.get('/lookup/tax-rates').then(({ data }) => setTaxRates(data));
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProducts, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    // Default the form's business type to the shop's configured type, but
    // only before the user has touched the form (id null, name empty) so
    // this never clobbers an in-progress edit once settings resolve late.
    if (settings?.business_type && !form.id && !form.name) {
      setForm((f) => ({ ...f, business_type: settings.business_type }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.business_type]);

  useEffect(() => {
    api.get('/categories', { params: { business_type: form.business_type } }).then(({ data }) => setCategories(data));
    api.get('/settings/attribute-fields', { params: { business_type: form.business_type } }).then(({ data }) => setAttributeFields(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.business_type]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setAttr = (key, value) => setForm((f) => ({ ...f, attributes: { ...f.attributes, [key]: value } }));

  const setSerialRow = (index, key, value) => {
    setForm((f) => {
      const serials = [...f.serials];
      serials[index] = { ...serials[index], [key]: value };
      return { ...f, serials };
    });
  };
  const addSerialRow = () => setForm((f) => ({ ...f, serials: [...f.serials, { imei1: '', imei2: '', serial_no: '' }] }));
  const removeSerialRow = (index) => setForm((f) => ({ ...f, serials: f.serials.filter((_, i) => i !== index) }));

  const [variants, setVariants] = useState([]);
  const [newVariant, setNewVariant] = useState({ variant_name: '', price_adjustment: '', stock_qty: '' });

  const addVariant = async () => {
    if (!form.id || !newVariant.variant_name.trim()) return;
    await api.post(`/products/${form.id}/variants`, {
      variant_name: newVariant.variant_name,
      price_adjustment: Number(newVariant.price_adjustment) || 0,
      stock_qty: Number(newVariant.stock_qty) || 0,
    });
    setNewVariant({ variant_name: '', price_adjustment: '', stock_qty: '' });
    const { data } = await api.get(`/products/${form.id}`);
    setVariants(data.variants || []);
  };

  const removeVariant = async (variantId) => {
    await api.delete(`/products/${form.id}/variants/${variantId}`);
    setVariants((v) => v.filter((x) => x.id !== variantId));
  };

  const startEdit = (p) => {
    setForm({
      ...BLANK_FORM,
      ...p,
      category_id: p.category_id || '',
      brand_id: p.brand_id || '',
      unit_id: p.unit_id || '',
      tax_rate_id: p.tax_rate_id || '',
      supplier_id: p.supplier_id || '',
      attributes: p.attributes || {},
      serials: [{ imei1: '', imei2: '', serial_no: '' }],
    });
    setVariants(p.variants || []);
  };

  const resetForm = () => {
    setForm({ ...BLANK_FORM, business_type: settings?.business_type || 'mobile' });
    setVariants([]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      category_id: form.category_id || null,
      brand_id: form.brand_id || null,
      unit_id: form.unit_id || null,
      tax_rate_id: form.tax_rate_id || null,
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
    await api.delete(`/products/${id}`);
    loadProducts();
  };

  const currency = settings?.currency_symbol || '₹';

  const showSerials = form?.business_type === 'mobile' && form?.track_serial;

  if (!form) return <div>{t('common.loading')}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('products.title')}</h1>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-1.5 text-sm"
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left">
              <tr>
                <th className="px-3 py-2">{t('common.name')}</th>
                <th className="px-3 py-2">{t('products.category')}</th>
                <th className="px-3 py-2 text-right">{t('products.selling_price')}</th>
                <th className="px-3 py-2 text-right">{t('products.stock_qty')}</th>
                <th className="px-3 py-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.business_type} · {p.barcode}</div>
                  </td>
                  <td className="px-3 py-2">{p.category_name}</td>
                  <td className="px-3 py-2 text-right">{currency}{Number(p.selling_price).toFixed(2)}</td>
                  <td className={`px-3 py-2 text-right ${Number(p.stock_qty) <= 0 ? 'text-red-500 font-semibold' : ''}`}>
                    {p.track_serial ? Number(p.stock_qty) : Number(p.stock_qty).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    {canManage ? (
                      <>
                        <button onClick={() => startEdit(p)} className="mr-2 text-brand-600 hover:underline">
                          {t('common.edit')}
                        </button>
                        <button onClick={() => remove(p.id)} className="text-red-500 hover:underline">
                          {t('common.delete')}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    {t('common.no_data')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && (
      <form onSubmit={submit} className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3 self-start">
        <h2 className="font-semibold">{form.id ? t('products.edit_product') : t('products.add_product')}</h2>
        {error && <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div>
          <label className="mb-1 block text-sm font-medium">{t('settings.business_type')}</label>
          <select
            value={form.business_type}
            onChange={(e) => set('business_type', e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          >
            <option value="mobile">{t('settings.mobile')}</option>
            <option value="furniture">{t('settings.furniture')}</option>
            <option value="food">{t('settings.food')}</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">{t('common.name')} *</label>
          <input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.category')}</label>
            <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2">
              <option value="">--</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.brand')}</label>
            <select value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2">
              <option value="">--</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.unit')}</label>
            <select value={form.unit_id} onChange={(e) => set('unit_id', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2">
              <option value="">--</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.tax')}</label>
            <select value={form.tax_rate_id} onChange={(e) => set('tax_rate_id', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2">
              <option value="">--</option>
              {taxRates.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.purchase_price')}</label>
            <input type="number" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.selling_price')}</label>
            <input type="number" value={form.selling_price} onChange={(e) => set('selling_price', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.mrp')}</label>
            <input type="number" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.barcode')}</label>
            <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.low_stock_threshold')}</label>
            <input type="number" value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
          </div>
        </div>

        {form.business_type === 'mobile' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.track_serial} onChange={(e) => set('track_serial', e.target.checked)} />
            {t('products.track_serial')}
          </label>
        )}

        {showSerials ? (
          <div className="space-y-2 rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-2">
            <div className="text-sm font-medium">{t('products.serials')}</div>
            {form.serials.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-1">
                <input placeholder={t('products.imei1')} value={s.imei1} onChange={(e) => setSerialRow(i, 'imei1', e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm" />
                <input placeholder={t('products.imei2')} value={s.imei2} onChange={(e) => setSerialRow(i, 'imei2', e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm" />
                <div className="flex gap-1">
                  <input placeholder={t('products.serial_no')} value={s.serial_no} onChange={(e) => setSerialRow(i, 'serial_no', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm" />
                  {form.serials.length > 1 && (
                    <button type="button" onClick={() => removeSerialRow(i)} className="text-red-500 text-xs">✕</button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addSerialRow} className="text-xs text-brand-600 hover:underline">
              {t('products.add_serial_row')}
            </button>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">{t('products.stock_qty')}</label>
            <input type="number" value={form.stock_qty} onChange={(e) => set('stock_qty', e.target.value)} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
          </div>
        )}

        {attributeFields.length > 0 && (
          <div className="space-y-2 rounded-md border border-slate-200 dark:border-slate-700 p-2">
            <div className="text-sm font-medium">{t('products.attributes')}</div>
            <div className="grid grid-cols-2 gap-2">
              {attributeFields.map((field) => (
                <AttributeField
                  key={field.field_key}
                  field={field}
                  value={form.attributes[field.field_key]}
                  onChange={(v) => setAttr(field.field_key, v)}
                />
              ))}
            </div>
          </div>
        )}

        {form.id && form.business_type !== 'mobile' && (
          <div className="space-y-2 rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-2">
            <div className="text-sm font-medium">Variants (e.g. Size, Spice Level, Dimensions)</div>
            {variants.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs">
                <span>{v.variant_name}</span>
                <span className="text-slate-400">
                  {Number(v.price_adjustment) !== 0 ? `${Number(v.price_adjustment) > 0 ? '+' : ''}${v.price_adjustment}` : ''} stock:{v.stock_qty}
                </span>
                <button type="button" onClick={() => removeVariant(v.id)} className="text-red-500">✕</button>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-1">
              <input
                placeholder="Name (e.g. Large / Extra Spicy)"
                value={newVariant.variant_name}
                onChange={(e) => setNewVariant({ ...newVariant, variant_name: e.target.value })}
                className="col-span-3 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs"
              />
              <input
                type="number"
                placeholder="Price +/-"
                value={newVariant.price_adjustment}
                onChange={(e) => setNewVariant({ ...newVariant, price_adjustment: e.target.value })}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs"
              />
              <input
                type="number"
                placeholder="Stock"
                value={newVariant.stock_qty}
                onChange={(e) => setNewVariant({ ...newVariant, stock_qty: e.target.value })}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs"
              />
              <button type="button" onClick={addVariant} className="rounded-md bg-brand-600 text-white text-xs py-1">
                {t('common.add')}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-white text-sm">
            {t('common.save')}
          </button>
          <button type="button" onClick={resetForm} className="rounded-md border px-4 py-2 text-sm">
            {t('common.cancel')}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
