import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, Search, Edit2, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import { enqueueOutboxItem, newUuid } from '../db/db';
import { refreshPendingCount } from '../db/syncService';

const BLANK_FORM = {
  id: null,
  category_id: '',
  amount: '',
  notes: '',
  date: new Date().toISOString().slice(0, 10),
};

export default function Income() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(BLANK_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.get('/income').then(({ data }) => setRows(data)).catch(() => {});
  useEffect(() => {
    load();
    api.get('/lookup/income-categories').then(({ data }) => setCategories(data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing && form.id) {
        // Updating existing income
        try {
          await api.put(`/income/${form.id}`, {
            category_id: Number(form.category_id),
            amount: Number(form.amount),
            notes: form.notes,
            date: form.date,
          });
        } catch {
          // If remote fails or offline, update locally in list
        }
        setRows((prev) =>
          prev.map((r) =>
            r.id === form.id
              ? {
                  ...r,
                  category_id: Number(form.category_id),
                  category_name: categories.find((c) => c.id === Number(form.category_id))?.name || r.category_name,
                  amount: Number(form.amount),
                  notes: form.notes,
                  income_date: form.date,
                  date: form.date,
                }
              : r
          )
        );
      } else {
        // Adding new income
        const payload = { uuid: newUuid(), ...form, amount: Number(form.amount) };
        try {
          await api.post('/income', payload);
        } catch {
          await enqueueOutboxItem({ client_id: payload.uuid, type: 'income', payload });
          refreshPendingCount();
          setRows((r) => [
            { ...payload, id: payload.uuid, category_name: categories.find((c) => c.id === Number(form.category_id))?.name },
            ...r,
          ]);
        }
      }
      load();
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (r) => {
    setForm({
      id: r.id,
      category_id: String(r.category_id || ''),
      amount: String(r.amount || ''),
      notes: r.notes || '',
      date: r.income_date || r.date || new Date().toISOString().slice(0, 10),
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm(BLANK_FORM);
    setIsEditing(false);
  };

  const deleteIncome = async (r) => {
    if (!window.confirm(`Are you sure you want to delete this income entry of ${formatCurrency(r.amount, currency)}?`)) {
      return;
    }
    try {
      await api.delete(`/income/${r.id}`);
      setRows((prev) => prev.filter((item) => item.id !== r.id));
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete income');
    }
  };

  const currency = settings?.currency_symbol || '₹';

  const filteredRows = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.category_name || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q) ||
      String(r.amount).includes(q)
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Internal Navigation Tabs */}
      <div className="lg:col-span-3 flex items-center gap-2 pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
        <Link
          to="/expenses"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
        >
          <ArrowDownCircle className="w-3.5 h-3.5" />
          <span>Expenses</span>
        </Link>
        <Link
          to="/income"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          <span>Income</span>
        </Link>
      </div>
      <div className="lg:col-span-2 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="text-xl font-bold">{t('income.title')}</h1>
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-[#5A6B82] absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search income..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] focus:outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
              <tr>
                <th className="px-3 py-2">{t('common.date')}</th>
                <th className="px-3 py-2">{t('common.category')}</th>
                <th className="px-3 py-2">{t('common.notes')}</th>
                <th className="px-3 py-2 text-right">{t('common.amount')}</th>
                <th className="px-3 py-2 text-center w-20">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className="border-t border-[#DCE5EF] dark:border-[#22354B] hover:bg-[#F8FAFC] dark:hover:bg-[#162334] transition-colors">
                  <td className="px-3 py-2">{r.income_date || r.date}</td>
                  <td className="px-3 py-2">{r.category_name}</td>
                  <td className="px-3 py-2">{r.notes || '-'}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatCurrency(r.amount, currency)}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => startEdit(r)}
                        className="p-1 rounded-md text-[#5A6B82] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
                        title="Edit income"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteIncome(r)}
                        className="p-1 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Delete income"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[#5A6B82] text-xs">
                    No income records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <form onSubmit={submit} className="rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-3 self-start">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">
            {isEditing ? 'Edit Income' : t('income.add_income')}
          </h2>
          {isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-[#5A6B82] hover:text-[#1C2736] flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
        </div>
        <select
          required
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-xs"
        >
          <option value="">{t('common.category')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          required
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-xs"
        />
        <input
          required
          type="number"
          step="any"
          value={form.amount}
          onChange={(e) => {
            const val = e.target.value;
            setForm({ ...form, amount: val === '' ? '' : val.replace(/^0+(?=\d)/, '') });
          }}
          placeholder={t('common.amount')}
          className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-xs font-bold"
        />
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder={t('common.notes')}
          className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 text-xs"
        />
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-md bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] py-2 text-xs font-bold transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving...' : isEditing ? 'Update Income' : t('common.save')}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 rounded-md border border-[#DCE5EF] dark:border-[#22354B] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
