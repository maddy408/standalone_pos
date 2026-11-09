import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
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
  AlertCircle,
  Wallet
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
    api.get('/customers')
      .then(({ data }) => setCustomers(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])))
      .catch((err) => {
        console.error(err);
        setCustomers([]);
      });
  };

  useEffect(() => {
    load();
  }, []);

  // Instant client-side search filter as a backup / real-time filter
  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customers) ? customers : [];
    if (!search.trim()) return list;
    const term = search.toLowerCase().trim();
    return list.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return name.includes(term) || phone.includes(term) || email.includes(term);
    });
  }, [customers, search]);

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
      {/* Internal Navigation Tabs */}
      <div className="lg:col-span-3 flex items-center gap-2 pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers</span>
        </Link>
        <Link
          to="/collections"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Collection</span>
        </Link>
      </div>
      {/* Customer List Section */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
              {t('customers.title')}
            </h1>
            <p className="text-xs text-[#5A6B82]">Manage directory, opening balances & receivables</p>
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
                <th className="px-3.5 py-2.5">Contact Info</th>
                <th className="px-3.5 py-2.5 text-right">Credit Limit</th>
                <th className="px-3.5 py-2.5 text-right">{t('customers.balance')}</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
              {filteredCustomers.map((c) => {
                const bal = Number(c.balance || 0);
                return (
                  <tr key={c.id} className="hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium">
                      <div>{c.name}</div>
                      {c.address && <div className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] truncate max-w-xs">{c.address}</div>}
                    </td>
                    <td className="px-3.5 py-2.5 space-y-0.5">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-[#5A6B82] dark:text-[#94A3B8]">
                          <Phone className="w-3 h-3 text-[#5A6B82] dark:text-[#94A3B8]" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-[#5A6B82]">
                          <Mail className="w-3 h-3 text-[#5A6B82] dark:text-[#94A3B8]" />
                          <span className="truncate max-w-xs">{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-medium text-[#5A6B82] dark:text-[#94A3B8]">
                      {formatCurrency(c.credit_limit || 0, currency)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold">
                      <span className={bal > 0 ? 'text-[#0A4174] dark:text-[#4A8CD2] bg-[#E2EDF8] dark:bg-[#1A2A3D] px-2 py-0.5 rounded' : 'text-[#5A6B82] dark:text-[#94A3B8]'}>
                        {formatCurrency(bal, currency)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => startEdit(c)}
                          title="Edit Customer"
                          className="p-1.5 text-[#0A4174] hover:text-[#062E52] dark:text-[#4A8CD2] dark:hover:text-[#6BA3E0] hover:bg-[#E2EDF8] dark:bg-[#1A2A3D] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
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
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[#5A6B82] dark:text-[#94A3B8]">
                    No customers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Form (Add/Edit) */}
      <div className="rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4 self-start">
        <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
            {isEditing ? 'Edit Customer' : t('customers.add_customer')}
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
              Customer Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Rahul Sharma"
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
              placeholder="e.g. customer@gmail.com"
              className={`w-full rounded-lg border bg-transparent px-3 py-2 focus:outline-none focus:ring-1 ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-[#DCE5EF] dark:border-[#22354B] focus:ring-[#0A4174]'
              }`}
            />
            {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              Address
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Door No, Street, City"
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
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
                className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
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
                className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0A4174]"
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold py-2 transition-colors shadow-sm"
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
              className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] px-4 py-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Record Payment Modal */}
      {paying && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-2xl border border-[#DCE5EF] dark:border-[#22354B]">
            <h3 className="mb-1 font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              Collect Payment — {paying.name}
            </h3>
            <p className="text-xs text-[#5A6B82] mb-3">
              Outstanding Due: <span className="font-bold text-[#0A4174] dark:text-[#4A8CD2]">{formatCurrency(paying.balance, currency)}</span>
            </p>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Enter received amount"
              className="mb-4 w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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
                className="flex-1 rounded-lg border border-[#DCE5EF] dark:border-[#22354B] py-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
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
