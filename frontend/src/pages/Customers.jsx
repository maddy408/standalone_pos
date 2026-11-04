import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import {
  Users,
  Search,
  Plus,
  Edit2,
  CreditCard,
  X,
  Phone,
  Mail,
  MapPin,
  FileCheck,
  AlertCircle
} from 'lucide-react';

const BLANK = {
  id: null,
  name: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
  credit_limit: '',
  opening_balance: '',
};

export default function Customers() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(BLANK);
  const [isEditing, setIsEditing] = useState(false);
  const [paying, setPaying] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [errors, setErrors] = useState({});

  const currency = settings?.currency_symbol || '₹';

  const load = () => {
    api.get('/customers', { params: { search: search || undefined } })
      .then(({ data }) => setCustomers(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    load();
  }, [search]);

  // Validation
  const validate = () => {
    const errs = {};
    if (!form.name.trim()) {
      errs.name = 'Customer name is required';
    }
    if (form.phone && !/^[0-9]{10}$/.test(form.phone.trim())) {
      errs.phone = 'Phone number must be exactly 10 digits';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Invalid email address format (e.g. name@gmail.com)';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...form,
      credit_limit: form.credit_limit === '' ? 0 : Number(form.credit_limit),
      opening_balance: form.opening_balance === '' ? 0 : Number(form.opening_balance),
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      address: form.address?.trim() || null,
      gstin: form.gstin?.trim() || null,
    };

    try {
      if (form.id) {
        await api.put(`/customers/${form.id}`, payload);
      } else {
        await api.post('/customers', payload);
      }
      setForm(BLANK);
      setIsEditing(false);
      setErrors({});
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save customer');
    }
  };

  const startEdit = (c) => {
    setForm({
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      gstin: c.gstin || '',
      credit_limit: c.credit_limit ? String(Number(c.credit_limit)) : '',
      opening_balance: c.opening_balance ? String(Number(c.opening_balance)) : '',
    });
    setIsEditing(true);
    setErrors({});
  };

  const recordPayment = async () => {
    if (!paying || !payAmount) return;
    try {
      await api.post(`/customers/${paying.id}/payments`, {
        amount: Number(payAmount),
        payment_method_id: 1,
      });
      setPaying(null);
      setPayAmount('');
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Payment failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Customer List Section */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              {t('customers.title')}
            </h1>
            <p className="text-xs text-slate-500">Manage directory, opening balances & receivables</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3.5 py-2.5">{t('common.name')}</th>
                <th className="px-3.5 py-2.5">Contact Info</th>
                <th className="px-3.5 py-2.5 text-right">Credit Limit</th>
                <th className="px-3.5 py-2.5 text-right">{t('customers.balance')}</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {customers.map((c) => {
                const bal = Number(c.balance || 0);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium">
                      <div>{c.name}</div>
                      {c.address && <div className="text-[10px] text-slate-400 truncate max-w-xs">{c.address}</div>}
                    </td>
                    <td className="px-3.5 py-2.5 space-y-0.5">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-xs">{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-medium text-slate-600 dark:text-slate-400">
                      {currency}{Number(c.credit_limit || 0).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold">
                      <span className={bal > 0 ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded' : 'text-slate-600 dark:text-slate-400'}>
                        {currency}{bal.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => startEdit(c)}
                          title="Edit Customer"
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {bal > 0 && (
                          <button
                            onClick={() => setPaying(c)}
                            title="Collect Payment"
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                    No customers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Form (Add/Edit) */}
      <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 self-start">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-500" />
            {isEditing ? 'Edit Customer' : t('customers.add_customer')}
          </h2>
          {isEditing && (
            <button
              onClick={() => {
                setForm(BLANK);
                setIsEditing(false);
                setErrors({});
              }}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              Customer Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Rahul Sharma"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.name ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-amber-500'
              }`}
            />
            {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              Phone Number (10 Digits)
            </label>
            <input
              value={form.phone}
              maxLength={10}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
              placeholder="e.g. 9876543210"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-amber-500'
              }`}
            />
            {errors.phone && <p className="mt-1 text-[11px] text-red-500">{errors.phone}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. customer@gmail.com"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-amber-500'
              }`}
            />
            {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              Address
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Door No, Street, City"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                Opening Balance
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.opening_balance}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, opening_balance: val === '' ? '' : val.replace(/^0+(?=\d)/, '') });
                }}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                Credit Limit
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.credit_limit}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, credit_limit: val === '' ? '' : val.replace(/^0+(?=\d)/, '') });
                }}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 transition-colors shadow-sm"
            >
              {isEditing ? 'Update Customer' : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(BLANK);
                setIsEditing(false);
                setErrors({});
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Record Payment Modal */}
      {paying && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="mb-1 font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              Collect Payment — {paying.name}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Outstanding Due: <span className="font-bold text-amber-600">{currency}{Number(paying.balance).toFixed(2)}</span>
            </p>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Enter received amount"
              className="mb-4 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
            <div className="flex gap-2 text-xs">
              <button
                onClick={recordPayment}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold py-2 text-white shadow-sm transition-colors"
              >
                Record Payment
              </button>
              <button
                onClick={() => setPaying(null)}
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
