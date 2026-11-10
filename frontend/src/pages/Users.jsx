import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../config/api';
import { Settings, ArrowLeft } from 'lucide-react';
import {
  UserCheck,
  UserPlus,
  Edit2,
  PowerOff,
  Power,
  ShieldCheck,
  X,
  Eye,
  EyeOff
} from 'lucide-react';

const BLANK = { id: null, username: '', password: '', full_name: '', role: 'cashier', is_active: 1 };

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    setShowPassword(false);
    setError('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Settings Navigation Tabs & Back to Master Settings */}
      <div className="lg:col-span-3 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#DCE5EF] dark:border-[#22354B]">
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>General Settings</span>
          </Link>
          <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-xs flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Users & Roles</span>
          </span>
        </div>

        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#0A4174] dark:text-[#4A8CD2] bg-[#E2EDF8] dark:bg-[#1A2A3D] hover:bg-[#C5D8ED] dark:hover:bg-[#22354B] transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Master Settings</span>
        </Link>
      </div>
      {/* Users List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
              {t('users.title')}
            </h1>
            <p className="text-xs text-[#5A6B82]">Manage cashier, manager & admin credentials</p>
          </div>
          <Link
            to="/users/roles"
            className="text-xs font-semibold text-[#0A4174] hover:text-[#062E52] dark:text-[#4A8CD2] dark:hover:text-[#6BA3E0] flex items-center gap-1.5 bg-[#E2EDF8] dark:bg-[#1A2A3D] px-3 py-1.5 rounded-lg border border-[#DCE5EF] dark:border-[#22354B]"
          >
            <ShieldCheck className="w-4 h-4" />
            {t('users.manage_roles_link')}
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left font-semibold text-[#5A6B82] dark:text-[#94A3B8]">
              <tr>
                <th className="px-3.5 py-2.5">{t('users.username')}</th>
                <th className="px-3.5 py-2.5">{t('common.name')}</th>
                <th className="px-3.5 py-2.5">{t('users.role')}</th>
                <th className="px-3.5 py-2.5">{t('common.status')}</th>
                <th className="px-3.5 py-2.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE5EF] dark:divide-[#22354B]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/40 transition-colors">
                  <td className="px-3.5 py-2.5 font-medium">{u.username}</td>
                  <td className="px-3.5 py-2.5">{u.full_name}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="capitalize font-semibold text-[#1C2736] dark:text-[#94A3B8] bg-[#E2EDF8] dark:bg-[#1A2A3D] px-2 py-0.5 rounded">
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
                      <span className="inline-flex items-center gap-1 text-[#5A6B82] dark:text-[#94A3B8] font-medium bg-[#E2EDF8] dark:bg-[#1A2A3D] px-2 py-0.5 rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#5A6B82]"></span>
                        {t('common.inactive')}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => startEdit(u)}
                        title="Edit User"
                        className="p-1.5 text-[#0A4174] hover:text-[#062E52] dark:text-[#4A8CD2] dark:hover:text-[#6BA3E0] hover:bg-[#E2EDF8] dark:bg-[#1A2A3D] dark:hover:bg-[#1A2A3D] rounded-lg transition-colors"
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
      <div className="rounded-xl bg-white dark:bg-[#121E2C] p-5 shadow-sm border border-[#DCE5EF] dark:border-[#22354B] space-y-4 self-start">
        <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#0A4174] dark:text-[#4A8CD2]" />
            {isEditing ? t('users.edit_user') : t('users.add_user')}
          </h2>
          {isEditing && (
            <button
              onClick={() => {
                setForm(BLANK);
                setIsEditing(false);
                setError('');
              }}
              className="text-xs text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#5A6B82] flex items-center gap-1"
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
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              {t('users.username')}
            </label>
            <input
              disabled={!!form.id}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 disabled:opacity-60 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              {t('common.name')}
            </label>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
                {t('auth.password')}
              </label>
              {form.id && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  (Type to update password, or leave blank to keep current)
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                placeholder={form.id ? '••••••••  (Enter new password to change)' : 'Enter password'}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent pl-3 pr-10 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A6B82] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] p-1 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
              {t('users.role')}
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
            >
              <option value="cashier">{t('users.role_cashier')}</option>
              <option value="manager">{t('users.role_manager')}</option>
              <option value="admin">{t('users.role_admin')}</option>
            </select>
          </div>

          {form.id && (
            <div>
              <label className="mb-1 block font-semibold text-[#1C2736] dark:text-[#94A3B8]">
                Account Status
              </label>
              <select
                value={form.is_active ? 1 : 0}
                onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-3 py-2 focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive (Deactivated)</option>
              </select>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] font-bold py-2 transition-colors shadow-sm"
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
              className="rounded-lg border border-[#DCE5EF] dark:border-[#22354B] px-4 py-2 hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D]"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
