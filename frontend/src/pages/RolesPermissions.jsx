import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { ShieldCheck, UserCheck } from 'lucide-react';

const ROLES = ['manager', 'cashier']; // admin always has everything, not editable

export default function RolesPermissions() {
  const { t, i18n } = useTranslation();
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix] = useState({ admin: [], manager: [], cashier: [] });
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [overrides, setOverrides] = useState([]);

  const label = (p) => (i18n.language === 'ta' && p.label_ta ? p.label_ta : p.label_en);

  const load = () => {
    api.get('/permissions').then(({ data }) => setPermissions(data));
    api.get('/role-permissions').then(({ data }) => setMatrix(data));
    api.get('/users').then(({ data }) => setUsers(data));
  };
  useEffect(() => {
    load();
  }, []);

  const toggleRolePerm = async (role, code, currentlyAllowed) => {
    await api.put('/role-permissions', { role, permission_code: code, allowed: !currentlyAllowed });
    setMatrix((m) => ({
      ...m,
      [role]: currentlyAllowed ? m[role].filter((c) => c !== code) : [...m[role], code],
    }));
  };

  const loadOverrides = (userId) => {
    setSelectedUserId(userId);
    if (!userId) {
      setOverrides([]);
      return;
    }
    api.get(`/users/${userId}/permissions`).then(({ data }) => setOverrides(data));
  };

  const overrideState = (code) => overrides.find((o) => o.permission_code === code)?.allowed;

  const cycleOverride = async (code) => {
    const current = overrideState(code);
    // Cycle: no override -> granted -> revoked -> no override
    const next = current === undefined ? 1 : current === 1 ? 0 : null;
    await api.put(`/users/${selectedUserId}/permissions`, { permission_code: code, allowed: next });
    setOverrides((prev) => {
      const without = prev.filter((o) => o.permission_code !== code);
      return next === null ? without : [...without, { permission_code: code, allowed: next }];
    });
  };

  const selectedUser = users.find((u) => u.id === Number(selectedUserId));
  const categories = [...new Set(permissions.map((p) => p.category))];

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-xl font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#0A4174] dark:text-[#4A8CD2]" />
          {t('roles_permissions.title')}
        </h1>
        <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">
          Role-based access matrix and individual granular user overrides
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">{t('roles_permissions.default_matrix')}</h2>
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-[#E2EDF8]/60 dark:bg-[#1A2A3D] text-left text-[#5A6B82] dark:text-[#94A3B8] font-semibold">
              <th className="px-3.5 py-2.5">{t('roles_permissions.permission')}</th>
              <th className="px-3.5 py-2.5 text-center">{t('roles_permissions.admin')}</th>
              <th className="px-3.5 py-2.5 text-center">{t('roles_permissions.manager')}</th>
              <th className="px-3.5 py-2.5 text-center">{t('roles_permissions.cashier')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <Fragment key={cat}>
                <tr className="bg-[#F4F7FB] dark:bg-[#1A2A3D]/50">
                  <td colSpan={4} className="px-3.5 py-1.5 text-[11px] font-black uppercase text-[#0A4174] dark:text-[#4A8CD2] tracking-wider">{cat}</td>
                </tr>
                {permissions
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <tr key={p.code} className="border-t border-[#DCE5EF] dark:border-[#22354B] hover:bg-[#F4F7FB]/50 dark:hover:bg-[#1A2A3D]/30">
                      <td className="px-3.5 py-2 text-[#1C2736] dark:text-[#F1F5F9] font-medium">{label(p)}</td>
                      <td className="px-3.5 py-2 text-center">
                        <input type="checkbox" checked readOnly disabled className="accent-[#0A4174] opacity-50 cursor-not-allowed" />
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-3.5 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={matrix[role]?.includes(p.code) || false}
                            onChange={() => toggleRolePerm(role, p.code, matrix[role]?.includes(p.code))}
                            className="accent-[#0A4174] w-4 h-4 cursor-pointer rounded"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#1C2736] dark:text-[#F1F5F9]">{t('roles_permissions.per_user_overrides')}</h2>
          <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">Custom override per individual staff account</p>
        </div>
        <select
          value={selectedUserId}
          onChange={(e) => loadOverrides(e.target.value)}
          className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB] dark:bg-[#0B131E] text-[#1C2736] dark:text-[#F1F5F9] px-3.5 py-2 text-xs font-semibold focus:ring-1 focus:ring-[#0A4174] focus:outline-none"
        >
          <option value="">{t('roles_permissions.select_user')}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
          ))}
        </select>

        {selectedUser && (
          <>
            <p className="text-xs text-[#5A6B82] dark:text-[#94A3B8]">
              {t('roles_permissions.cycle_hint', { role: selectedUser.role })}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {permissions.map((p) => {
                const state = overrideState(p.code);
                const roleDefault = matrix[selectedUser.role]?.includes(p.code);
                const stateLabel =
                  state === 1 ? t('roles_permissions.granted') :
                  state === 0 ? t('roles_permissions.denied') :
                  roleDefault ? t('roles_permissions.allowed_default') : t('roles_permissions.not_allowed_default');
                const color =
                  state === 1 ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30' :
                  state === 0 ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30' :
                  'border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/60 dark:bg-[#0B131E]';
                return (
                  <button
                    key={p.code}
                    onClick={() => cycleOverride(p.code)}
                    className={`rounded-xl border p-3 text-left text-xs transition-colors ${color}`}
                  >
                    <div className="font-bold text-[#1C2736] dark:text-[#F1F5F9]">{label(p)}</div>
                    <div className="text-[11px] text-[#5A6B82] dark:text-[#94A3B8] mt-0.5">{stateLabel}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
