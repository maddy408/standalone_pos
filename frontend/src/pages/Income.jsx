import { useEffect, useState } from 'react';
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
      <div className="lg:col-span-2">
        <h1 className="mb-3 text-xl font-bold">{t('income.title')}</h1>
        <div className="overflow-x-auto rounded-xl border border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A]">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F7F5FC] dark:bg-[#2B2536] text-left">
              <tr><th className="px-3 py-2">{t('common.date')}</th><th className="px-3 py-2">{t('common.category')}</th><th className="px-3 py-2">{t('common.notes')}</th><th className="px-3 py-2 text-right">{t('common.amount')}</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#E8E3EF] dark:border-[#393244]">
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
      <form onSubmit={submit} className="rounded-xl bg-white dark:bg-[#211D2A] p-4 shadow-sm border border-[#E8E3EF] dark:border-[#393244] space-y-3 self-start">
        <h2 className="font-semibold">{t('income.add_income')}</h2>
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full rounded-md border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2">
          <option value="">{t('common.category')}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-md border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2" />
        <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={t('common.amount')} className="w-full rounded-md border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2" />
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('common.notes')} className="w-full rounded-md border border-[#E8E3EF] dark:border-[#393244] bg-transparent px-3 py-2" />
        <button type="submit" className="w-full rounded-md bg-[#7652B5] hover:bg-[#5B3B91] dark:bg-[#A98ADB] dark:hover:bg-[#C0A5EA] text-white dark:text-[#17151D] py-2 text-white text-sm">{t('common.save')}</button>
      </form>
    </div>
  );
}
