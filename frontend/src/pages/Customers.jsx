import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';

const BLANK = { id: null, name: '', phone: '', email: '', address: '', credit_limit: 0 };

export default function Customers() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [paying, setPaying] = useState(null);
  const [payAmount, setPayAmount] = useState('');

  const load = () => api.get('/customers').then(({ data }) => setCustomers(data));
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (form.id) await api.put(`/customers/${form.id}`, form);
    else await api.post('/customers', form);
    setForm(BLANK);
    load();
  };

  const recordPayment = async () => {
    if (!paying || !payAmount) return;
    await api.post(`/customers/${paying.id}/payments`, { amount: Number(payAmount), payment_method_id: 1 });
    setPaying(null);
    setPayAmount('');
    load();
  };

  const currency = settings?.currency_symbol || '₹';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h1 className="mb-3 text-xl font-bold">{t('customers.title')}</h1>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left">
              <tr>
                <th className="px-3 py-2">{t('common.name')}</th>
                <th className="px-3 py-2">{t('common.phone')}</th>
                <th className="px-3 py-2 text-right">{t('customers.balance')}</th>
                <th className="px-3 py-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.phone}</td>
                  <td className={`px-3 py-2 text-right ${Number(c.balance) > 0 ? 'text-amber-600 font-semibold' : ''}`}>
                    {currency}{Number(c.balance).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button onClick={() => setForm(c)} className="text-brand-600 hover:underline">{t('common.edit')}</button>
                    {Number(c.balance) > 0 && (
                      <button onClick={() => setPaying(c)} className="text-emerald-600 hover:underline">{t('customers.record_payment')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={submit} className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3 self-start">
        <h2 className="font-semibold">{t('customers.add_customer')}</h2>
        {['name', 'phone', 'email', 'address'].map((f) => (
          <div key={f}>
            <label className="mb-1 block text-sm font-medium">{t(`common.${f}`)}</label>
            <input
              value={form[f] || ''}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
            />
          </div>
        ))}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('customers.credit_limit')}</label>
          <input
            type="number"
            value={form.credit_limit || 0}
            onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-white text-sm">{t('common.save')}</button>
          <button type="button" onClick={() => setForm(BLANK)} className="rounded-md border px-4 py-2 text-sm">{t('common.cancel')}</button>
        </div>
      </form>

      {paying && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-80 rounded-xl bg-white dark:bg-slate-900 p-4">
            <h3 className="mb-2 font-semibold">{t('customers.record_payment')} — {paying.name}</h3>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={t('common.amount')}
              className="mb-3 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
            />
            <div className="flex gap-2">
              <button onClick={recordPayment} className="flex-1 rounded-md bg-brand-600 py-2 text-white text-sm">{t('common.save')}</button>
              <button onClick={() => setPaying(null)} className="flex-1 rounded-md border py-2 text-sm">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
