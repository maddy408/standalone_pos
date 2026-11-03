import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';

const BLANK = { id: null, name: '', phone: '', email: '', address: '' };

export default function Suppliers() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [details, setDetails] = useState(null);

  const load = () => api.get('/suppliers').then(({ data }) => setSuppliers(data));
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (form.id) await api.put(`/suppliers/${form.id}`, form);
    else await api.post('/suppliers', form);
    setForm(BLANK);
    load();
  };

  const viewDetails = async (s) => {
    const { data } = await api.get(`/suppliers/${s.id}`);
    setDetails(data);
  };

  const currency = settings?.currency_symbol || '₹';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h1 className="mb-3 text-xl font-bold">{t('suppliers.title')}</h1>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left">
              <tr>
                <th className="px-3 py-2">{t('common.name')}</th>
                <th className="px-3 py-2">{t('common.phone')}</th>
                <th className="px-3 py-2 text-right">{t('suppliers.balance')}</th>
                <th className="px-3 py-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2">{s.phone}</td>
                  <td className={`px-3 py-2 text-right ${Number(s.balance) > 0 ? 'text-amber-600 font-semibold' : ''}`}>
                    {currency}{Number(s.balance).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    <button onClick={() => setForm(s)} className="text-brand-600 hover:underline">{t('common.edit')}</button>
                    <button onClick={() => viewDetails(s)} className="text-slate-500 hover:underline">{t('suppliers.purchase_history')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {details && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="mb-2 flex justify-between">
              <h3 className="font-semibold">{details.name}</h3>
              <button onClick={() => setDetails(null)} className="text-xs">{t('common.close')}</button>
            </div>
            <h4 className="text-sm font-medium mb-1">{t('suppliers.purchase_history')}</h4>
            <ul className="mb-3 text-sm space-y-1">
              {details.purchase_history.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.purchase_no}</span>
                  <span>{currency}{Number(p.grand_total).toFixed(2)}</span>
                </li>
              ))}
              {details.purchase_history.length === 0 && <li className="text-slate-400">{t('common.no_data')}</li>}
            </ul>
            <h4 className="text-sm font-medium mb-1">{t('suppliers.payment_history')}</h4>
            <ul className="text-sm space-y-1">
              {details.payment_history.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  <span>{currency}{Number(p.amount).toFixed(2)}</span>
                </li>
              ))}
              {details.payment_history.length === 0 && <li className="text-slate-400">{t('common.no_data')}</li>}
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3 self-start">
        <h2 className="font-semibold">{t('suppliers.add_supplier')}</h2>
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
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-white text-sm">{t('common.save')}</button>
          <button type="button" onClick={() => setForm(BLANK)} className="rounded-md border px-4 py-2 text-sm">{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}
