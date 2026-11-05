import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import { enqueueOutboxItem, newUuid } from '../db/db';
import { refreshPendingCount } from '../db/syncService';

export default function Income() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ category_id: '', amount: '', notes: '', date: new Date().toISOString().slice(0, 10) });

  const load = () => api.get('/income').then(({ data }) => setRows(data)).catch(() => {});
  useEffect(() => {
    load();
    api.get('/lookup/income-categories').then(({ data }) => setCategories(data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = { uuid: newUuid(), ...form, amount: Number(form.amount) };
    try {
      await api.post('/income', payload);
      load();
    } catch {
      await enqueueOutboxItem({ client_id: payload.uuid, type: 'income', payload });
      refreshPendingCount();
      setRows((r) => [{ ...payload, id: payload.uuid, category_name: categories.find((c) => c.id === Number(form.category_id))?.name }, ...r]);
    }
    setForm({ category_id: '', amount: '', notes: '', date: new Date().toISOString().slice(0, 10) });
  };

  const currency = settings?.currency_symbol || '₹';

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
      <div className="lg:col-span-2">
        <h1 className="mb-3 text-xl font-bold">{t('income.title')}</h1>
        <div className="overflow-x-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
              <tr><th className="px-3 py-2">{t('common.date')}</th><th className="px-3 py-2">{t('common.category')}</th><th className="px-3 py-2">{t('common.notes')}</th><th className="px-3 py-2 text-right">{t('common.amount')}</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#DCE5EF] dark:border-[#22354B]">
                  <td className="px-3 py-2">{r.income_date || r.date}</td>
                  <td className="px-3 py-2">{r.category_name}</td>
                  <td className="px-3 py-2">{r.notes}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form onSubmit={submit} className="rounded-xl bg-white dark:bg-[#121E2C] p-4 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-3 self-start">
        <h2 className="font-semibold">{t('income.add_income')}</h2>
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2">
          <option value="">{t('common.category')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2" />
        <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={t('common.amount')} className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2" />
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('common.notes')} className="w-full rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2" />
        <button type="submit" className="w-full rounded-md bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] py-2 text-white text-sm">{t('common.save')}</button>
      </form>
    </div>
  );
}
