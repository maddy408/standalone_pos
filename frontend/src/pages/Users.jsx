import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../config/api';

const BLANK = { id: null, username: '', password: '', full_name: '', role: 'cashier', is_active: true };

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');

  const load = () => api.get('/users').then(({ data }) => setUsers(data));
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) {
        await api.put(`/users/${form.id}`, form);
      } else {
        await api.post('/users', form);
      }
      setForm(BLANK);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    }
  };

  const deactivate = async (id) => {
    if (!confirm(t('users.deactivate_confirm'))) return;
    await api.delete(`/users/${id}`);
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('users.title')}</h1>
          <Link to="/users/roles" className="text-sm text-brand-600 hover:underline">
            {t('users.manage_roles_link')}
          </Link>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left">
              <tr>
                <th className="px-3 py-2">{t('users.username')}</th>
                <th className="px-3 py-2">{t('common.name')}</th>
                <th className="px-3 py-2">{t('users.role')}</th>
                <th className="px-3 py-2">{t('common.status')}</th>
                <th className="px-3 py-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2">{u.username}</td>
                  <td className="px-3 py-2">{u.full_name}</td>
                  <td className="px-3 py-2 capitalize">{u.role}</td>
                  <td className="px-3 py-2">{u.is_active ? t('common.active') : t('common.inactive')}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button onClick={() => setForm({ ...u, password: '' })} className="text-brand-600 hover:underline">{t('common.edit')}</button>
                    {u.is_active === 1 && (
                      <button onClick={() => deactivate(u.id)} className="text-red-500 hover:underline">{t('users.deactivate')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={submit} className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3 self-start">
        <h2 className="font-semibold">{form.id ? t('users.edit_user') : t('users.add_user')}</h2>
        {error && <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium">{t('users.username')}</label>
          <input disabled={!!form.id} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 disabled:opacity-60" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('common.name')}</label>
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('auth.password')} {form.id && t('users.leave_blank_password')}</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t('users.role')}</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2">
            <option value="admin">{t('users.role_admin')}</option>
            <option value="manager">{t('users.role_manager')}</option>
            <option value="cashier">{t('users.role_cashier')}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-white text-sm">{t('common.save')}</button>
          <button type="button" onClick={() => setForm(BLANK)} className="rounded-md border px-4 py-2 text-sm">{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  );
}
