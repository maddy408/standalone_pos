import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../config/api';
import {
  UserCheck,
  UserPlus,
  Edit2,
  PowerOff,
  Power,
  ShieldCheck,
  X
} from 'lucide-react';

const BLANK = { id: null, username: '', password: '', full_name: '', role: 'cashier', is_active: 1 };

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [isEditing, setIsEditing] = useState(false);
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
      setIsEditing(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    }
  };

  const toggleStatus = async (user) => {
    const nextStatus = user.is_active ? 0 : 1;
    const confirmMsg = nextStatus === 0 ? 'Are you sure you want to deactivate this user?' : 'Are you sure you want to reactivate this user?';
    if (!confirm(confirmMsg)) return;

    try {
      await api.put(`/users/${user.id}`, {
        full_name: user.full_name,
        role: user.role,
        is_active: nextStatus,
      });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const startEdit = (u) => {
    setForm({
      id: u.id,
      username: u.username,
      password: '',
      full_name: u.full_name,
      role: u.role,
      is_active: u.is_active,
    });
    setIsEditing(true);
    setError('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Users List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              {t('users.title')}
            </h1>
            <p className="text-xs text-slate-500">Manage cashier, manager & admin credentials</p>
          </div>
          <Link
            to="/users/roles"
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800"
          >
            <ShieldCheck className="w-4 h-4" />
            {t('users.manage_roles_link')}
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3.5 py-2.5">{t('users.username')}</th>
                <th className="px-3.5 py-2.5">{t('common.name')}</th>
                <th className="px-3.5 py-2.5">{t('users.role')}</th>
                <th className="px-3.5 py-2.5">{t('common.status')}</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-3.5 py-2.5 font-medium">{u.username}</td>
                  <td className="px-3.5 py-2.5">{u.full_name}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="capitalize font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {t('common.active')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        {t('common.inactive')}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => startEdit(u)}
                        title="Edit User"
                        className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleStatus(u)}
                        title={u.is_active ? 'Deactivate User' : 'Reactivate User'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.is_active
                            ? 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                            : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        {u.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Form */}
      <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 self-start">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-500" />
            {isEditing ? t('users.edit_user') : t('users.add_user')}
          </h2>
          {isEditing && (
            <button
              onClick={() => {
                setForm(BLANK);
                setIsEditing(false);
                setError('');
              }}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-600 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              {t('users.username')}
            </label>
            <input
              disabled={!!form.id}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 disabled:opacity-60 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              {t('common.name')}
            </label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              {t('auth.password')} {form.id && <span className="text-[10px] text-slate-400 font-normal">({t('users.leave_blank_password')})</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
              {t('users.role')}
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
            >
              <option value="cashier">{t('users.role_cashier')}</option>
              <option value="manager">{t('users.role_manager')}</option>
              <option value="admin">{t('users.role_admin')}</option>
            </select>
          </div>

          {form.id && (
            <div>
              <label className="mb-1 block font-semibold text-slate-700 dark:text-slate-300">
                Account Status
              </label>
              <select
                value={form.is_active ? 1 : 0}
                onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive (Deactivated)</option>
              </select>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 transition-colors shadow-sm"
            >
              {form.id ? 'Save Changes' : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(BLANK);
                setIsEditing(false);
                setError('');
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
