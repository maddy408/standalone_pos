import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';

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
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('roles_permissions.title')}</h1>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 font-semibold">{t('roles_permissions.default_matrix')}</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-3 py-2">{t('roles_permissions.permission')}</th>
              <th className="px-3 py-2 text-center">{t('roles_permissions.admin')}</th>
              <th className="px-3 py-2 text-center">{t('roles_permissions.manager')}</th>
              <th className="px-3 py-2 text-center">{t('roles_permissions.cashier')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <Fragment key={cat}>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <td colSpan={4} className="px-3 py-1 text-xs font-semibold uppercase text-slate-400">{cat}</td>
                </tr>
                {permissions
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <tr key={p.code} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2">{label(p)}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked readOnly disabled className="opacity-50" />
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={matrix[role]?.includes(p.code) || false}
                            onChange={() => toggleRolePerm(role, p.code, matrix[role]?.includes(p.code))}
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

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="mb-3 font-semibold">{t('roles_permissions.per_user_overrides')}</h2>
        <select
          value={selectedUserId}
          onChange={(e) => loadOverrides(e.target.value)}
          className="mb-3 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
        >
          <option value="">{t('roles_permissions.select_user')}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
          ))}
        </select>

        {selectedUser && (
          <>
            <p className="mb-3 text-xs text-slate-400">
              {t('roles_permissions.cycle_hint', { role: selectedUser.role })}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {permissions.map((p) => {
                const state = overrideState(p.code);
                const roleDefault = matrix[selectedUser.role]?.includes(p.code);
                const stateLabel =
                  state === 1 ? t('roles_permissions.granted') :
                  state === 0 ? t('roles_permissions.denied') :
                  roleDefault ? t('roles_permissions.allowed_default') : t('roles_permissions.not_allowed_default');
                const color =
                  state === 1 ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' :
                  state === 0 ? 'border-red-400 bg-red-50 dark:bg-red-900/20' :
                  'border-slate-200 dark:border-slate-700';
                return (
                  <button
                    key={p.code}
                    onClick={() => cycleOverride(p.code)}
                    className={`rounded-md border px-3 py-1.5 text-left text-xs ${color}`}
                  >
                    <div className="font-medium">{label(p)}</div>
                    <div className="text-slate-400">{stateLabel}</div>
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
