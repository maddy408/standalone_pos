import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import {
  Truck,
  Search,
  Plus,
  Edit2,
  FileText,
  X,
  Phone,
  Mail,
  AlertCircle,
  ShoppingBag,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
} from 'lucide-react';

const BLANK = { id: null, name: '', phone: '', email: '', address: '', gstin: '', opening_balance: '' };

export default function Suppliers() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(BLANK);
  const [isEditing, setIsEditing] = useState(false);
  const [details, setDetails] = useState(null);
  const [errors, setErrors] = useState({});

  const currency = settings?.currency_symbol || '₹';

  const load = () => {
    api.get('/suppliers', { params: { search: search || undefined } })
      .then(({ data }) => setSuppliers(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])))
      .catch((err) => {
        console.error(err);
        setSuppliers([]);
      });
  };

  const deleteSupplier = async (s) => {
    if (!confirm(`Are you sure you want to delete supplier "${s.name}"?`)) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete supplier');
    }
  };

  const toggleStatus = async (s) => {
    const nextStatus = s.is_active === 0 ? 1 : 0;
    try {
      await api.put(`/suppliers/${s.id}`, { is_active: nextStatus });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  useEffect(() => {
    load();
  }, [search]);

  // Validation
  const validate = () => {
    const errs = {};
    if (!form.name.trim()) {
      errs.name = 'Supplier name is required';
    }
    if (form.phone && !/^[0-9]{10}$/.test(form.phone.trim())) {
      errs.phone = 'Phone number must be exactly 10 digits';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Invalid email address format (e.g. supplier@gmail.com)';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...form,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      address: form.address?.trim() || null,
      gstin: form.gstin?.trim() || null,
      opening_balance: form.opening_balance === '' ? 0 : Number(form.opening_balance),
    };

    try {
      if (form.id) {
        await api.put(`/suppliers/${form.id}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }
      setForm(BLANK);
      setIsEditing(false);
      setErrors({});
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save supplier');
    }
  };

  const startEdit = (s) => {
    setForm({
      id: s.id,
      name: s.name || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      gstin: s.gstin || '',
      opening_balance: s.opening_balance !== undefined && s.opening_balance !== null ? String(s.opening_balance) : '',
    });
    setIsEditing(true);
    setErrors({});
  };

  const viewDetails = async (s) => {
    const { data } = await api.get(`/suppliers/${s.id}`);
    setDetails(data);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Internal Navigation Tabs */}
      <div className="lg:col-span-3 flex items-center gap-2 pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
        <Link
          to="/purchases"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Purchases</span>
        </Link>
        <Link
          to="/suppliers"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Suppliers</span>
        </Link>
      </div>
      {/* Suppliers Table */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
              {t('suppliers.title')}
            </h1>
            <p className="text-xs text-[#5A6B82]">Manage vendors, purchase logs & accounts payable</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#5A6B82] dark:text-[#94A3B8] absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] text-xs focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
              <tr>
                <th className="px-3.5 py-2.5">{t('common.name')}</th>
                <th className="px-3.5 py-2.5">Contact</th>
                <th className="px-3.5 py-2.5 text-right">{t('suppliers.balance')}</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
              {suppliers.map((s) => {
                const bal = Math.max(0, Number(s.balance || 0));
                return (
                  <tr key={s.id} className="hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium">
                      <div className="flex items-center gap-2">
                        <span className={s.is_active === 0 ? 'line-through text-[#5A6B82]' : ''}>{s.name}</span>
                        {s.is_active === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                            Inactive
                          </span>
                        )}
                      </div>
                      {s.address && <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] truncate max-w-xs">{s.address}</div>}
                    </td>
                    <td className="px-3.5 py-2.5 space-y-0.5">
                      {s.phone && (
                        <div className="flex items-center gap-1.5 text-[#5A6B82] dark:text-[#94A3B8]">
                          <Phone className="w-3 h-3 text-[#5A6B82] dark:text-[#94A3B8]" />
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1.5 text-[#5A6B82]">
                          <Mail className="w-3 h-3 text-[#5A6B82] dark:text-[#94A3B8]" />
                          <span className="truncate max-w-xs">{s.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold">
                      <span className={bal > 0 ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/50' : 'text-[#5A6B82] dark:text-[#94A3B8]'}>
                        {formatCurrency(bal, currency)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => viewDetails(s)}
                          title="View Details & Ledger"
                          className="p-1.5 text-[#0A4174] dark:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => startEdit(s)}
                          title="Edit Supplier"
                          className="p-1.5 text-[#0A4174] hover:text-[#062E52] dark:text-[#4A8CD2] dark:hover:text-[#6BA3E0] hover:bg-[#E2EDF8] dark:bg-[#1A2A3D] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleStatus(s)}
                          title={s.is_active === 0 ? 'Click to Activate' : 'Click to Deactivate'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            s.is_active === 0
                              ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                        >
                          {s.is_active === 0 ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => deleteSupplier(s)}
                          title="Delete Supplier"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[#5A6B82] dark:text-[#94A3B8]">
                    No suppliers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detailed Supplier View */}
        {details && (
          <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4 shadow-sm text-xs">
            <div className="mb-3 flex justify-between items-center pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
              <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
                Ledger History — {details.name}
              </h3>
              <button
                onClick={() => setDetails(null)}
                className="p-1 text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#5A6B82] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-2">Recent Purchases</h4>
                <ul className="space-y-1.5">
                  {(details.purchase_history || []).map((p) => (
                    <li key={p.id} className="flex justify-between p-2 rounded bg-[#F4F7FB] dark:bg-[#1A2A3D]/50">
                      <span>{p.purchase_no}</span>
                      <span className="font-semibold">{formatCurrency(p.grand_total, currency)}</span>
                    </li>
                  ))}
                  {(!details.purchase_history || details.purchase_history.length === 0) && (
                    <li className="text-[#5A6B82] dark:text-[#94A3B8] italic">No purchase history</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-[#1C2736] dark:text-[#94A3B8] mb-2">Recent Payments</h4>
                <ul className="space-y-1.5">
                  {(details.payment_history || []).map((p) => (
                    <li key={p.id} className="flex justify-between p-2 rounded bg-[#F4F7FB] dark:bg-[#1A2A3D]/50">
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(p.amount, currency)}</span>
                    </li>
                  ))}
                  {(!details.payment_history || details.payment_history.length === 0) && (
                    <li className="text-[#5A6B82] dark:text-[#94A3B8] italic">No payment history</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Supplier Form */}
      <div className="rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4 self-start">
        <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
            {isEditing ? 'Edit Supplier' : t('suppliers.add_supplier')}
          </h2>
          {isEditing && (
            <button
              onClick={() => {
                setForm(BLANK);
                setIsEditing(false);
                setErrors({});
              }}
              className="text-xs text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#5A6B82] flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              Supplier Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Apex Distributors"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.name ? 'border-red-500 focus:ring-red-500' : 'border-[#DCE5EF] dark:border-[#22354B] focus:ring-[#0A4174]'
              }`}
            />
            {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              Phone Number (10 Digits)
            </label>
            <input
              value={form.phone}
              maxLength={10}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
              placeholder="e.g. 9876543210"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-[#DCE5EF] dark:border-[#22354B] focus:ring-[#0A4174]'
              }`}
            />
            {errors.phone && <p className="mt-1 text-[11px] text-red-500">{errors.phone}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. contact@supplier.com"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-[#DCE5EF] dark:border-[#22354B] focus:ring-[#0A4174]'
              }`}
            />
            {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              GSTIN
            </label>
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              placeholder="e.g. 33AAAAA0000A1Z5"
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0A4174] uppercase"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              Opening Balance ({currency})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
              placeholder="0.00 (Previous balance owed to supplier)"
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0A4174] font-semibold"
            />
            <p className="mt-1 text-[10px] text-[#5A6B82]">Initial pending amount we owe to this supplier before using this POS.</p>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              Address
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Warehouse / Office address"
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold py-2 transition-colors shadow-sm"
            >
              {isEditing ? 'Update Supplier' : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(BLANK);
                setIsEditing(false);
                setErrors({});
              }}
              className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] px-4 py-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
