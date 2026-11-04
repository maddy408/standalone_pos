import { useEffect, useState } from 'react';
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
  AlertCircle
} from 'lucide-react';

const BLANK = { id: null, name: '', phone: '', email: '', address: '', gstin: '' };

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
      .then(({ data }) => setSuppliers(data))
      .catch((err) => console.error(err));
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
      {/* Suppliers Table */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#7652B5] dark:text-[#A98ADB]" />
              {t('suppliers.title')}
            </h1>
            <p className="text-xs text-[#716B7C]">Manage vendors, purchase logs & accounts payable</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#716B7C] dark:text-[#B8B0C4] absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] text-xs focus:ring-1 focus:ring-[#7652B5] focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-[#F7F5FC] dark:bg-[#2B2536] text-left font-semibold text-[#716B7C] dark:text-[#B8B0C4]">
              <tr>
                <th className="px-3.5 py-2.5">{t('common.name')}</th>
                <th className="px-3.5 py-2.5">Contact</th>
                <th className="px-3.5 py-2.5 text-right">{t('suppliers.balance')}</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E3EF] dark:divide-[#393244]">
              {suppliers.map((s) => {
                const bal = Number(s.balance || 0);
                return (
                  <tr key={s.id} className="hover:bg-[#F7F5FC]/50 dark:hover:bg-[#2B2536]/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium">
                      <div>{s.name}</div>
                      {s.address && <div className="text-[10px] text-[#716B7C] dark:text-[#B8B0C4] truncate max-w-xs">{s.address}</div>}
                    </td>
                    <td className="px-3.5 py-2.5 space-y-0.5">
                      {s.phone && (
                        <div className="flex items-center gap-1.5 text-[#716B7C] dark:text-[#B8B0C4]">
                          <Phone className="w-3 h-3 text-[#716B7C] dark:text-[#B8B0C4]" />
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1.5 text-[#716B7C]">
                          <Mail className="w-3 h-3 text-[#716B7C] dark:text-[#B8B0C4]" />
                          <span className="truncate max-w-xs">{s.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold">
                      <span className={bal > 0 ? 'text-[#7652B5] dark:text-[#A98ADB] bg-[#EDE7F7] dark:bg-[#2B2536] px-2 py-0.5 rounded' : 'text-[#716B7C] dark:text-[#B8B0C4]'}>
                        {formatCurrency(bal, currency)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          title="Edit Supplier"
                          className="p-1.5 text-[#7652B5] hover:text-[#5B3B91] dark:text-[#A98ADB] dark:hover:text-[#C0A5EA] hover:bg-[#EDE7F7] dark:bg-[#2B2536] dark:hover:bg-[#2B2536] rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => viewDetails(s)}
                          title="Purchase History"
                          className="p-1.5 text-[#716B7C] hover:text-[#282431] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] rounded-lg transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[#716B7C] dark:text-[#B8B0C4]">
                    No suppliers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detailed Supplier View */}
        {details && (
          <div className="rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] p-4 shadow-sm text-xs">
            <div className="mb-3 flex justify-between items-center pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
              <h3 className="font-bold text-sm text-[#282431] dark:text-[#F5F2F9] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
                Ledger History — {details.name}
              </h3>
              <button
                onClick={() => setDetails(null)}
                className="p-1 text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#716B7C] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-[#282431] dark:text-[#B8B0C4] mb-2">Recent Purchases</h4>
                <ul className="space-y-1.5">
                  {(details.purchase_history || []).map((p) => (
                    <li key={p.id} className="flex justify-between p-2 rounded bg-[#F7F5FC] dark:bg-[#2B2536]/50">
                      <span>{p.purchase_no}</span>
                      <span className="font-semibold">{formatCurrency(p.grand_total, currency)}</span>
                    </li>
                  ))}
                  {(!details.purchase_history || details.purchase_history.length === 0) && (
                    <li className="text-[#716B7C] dark:text-[#B8B0C4] italic">No purchase history</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-[#282431] dark:text-[#B8B0C4] mb-2">Recent Payments</h4>
                <ul className="space-y-1.5">
                  {(details.payment_history || []).map((p) => (
                    <li key={p.id} className="flex justify-between p-2 rounded bg-[#F7F5FC] dark:bg-[#2B2536]/50">
                      <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(p.amount, currency)}</span>
                    </li>
                  ))}
                  {(!details.payment_history || details.payment_history.length === 0) && (
                    <li className="text-[#716B7C] dark:text-[#B8B0C4] italic">No payment history</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Supplier Form */}
      <div className="rounded-xl bg-white dark:bg-[#211D2A] p-5 shadow-sm border border-[#E8E3EF] dark:border-[#393244] space-y-4 self-start">
        <div className="flex items-center justify-between pb-2 border-b border-[#E8E3EF] dark:border-[#393244]">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#7652B5] dark:text-[#A98ADB]" />
            {isEditing ? 'Edit Supplier' : t('suppliers.add_supplier')}
          </h2>
          {isEditing && (
            <button
              onClick={() => {
                setForm(BLANK);
                setIsEditing(false);
                setErrors({});
              }}
              className="text-xs text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#716B7C] flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#B8B0C4]">
              Supplier Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Apex Distributors"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.name ? 'border-red-500 focus:ring-red-500' : 'border-[#E8E3EF] dark:border-[#393244] focus:ring-[#7652B5]'
              }`}
            />
            {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#B8B0C4]">
              Phone Number (10 Digits)
            </label>
            <input
              value={form.phone}
              maxLength={10}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
              placeholder="e.g. 9876543210"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-[#E8E3EF] dark:border-[#393244] focus:ring-[#7652B5]'
              }`}
            />
            {errors.phone && <p className="mt-1 text-[11px] text-red-500">{errors.phone}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#B8B0C4]">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. contact@supplier.com"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-[#E8E3EF] dark:border-[#393244] focus:ring-[#7652B5]'
              }`}
            />
            {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#B8B0C4]">
              GSTIN
            </label>
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              placeholder="e.g. 33AAAAA0000A1Z5"
              className="w-full rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#7652B5] uppercase"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#282431] dark:text-[#B8B0C4]">
              Address
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Warehouse / Office address"
              className="w-full rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#7652B5]"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] text-white dark:text-[#17151D] font-bold py-2 transition-colors shadow-sm"
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
              className="rounded-lg border border-[#E8E3EF] dark:border-[#393244] px-4 py-2 hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536]"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
