import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme/ThemeProvider';
import { changeLanguage } from '../i18n';
import SyncStatusBadge from './SyncStatusBadge';

const NAV_ITEMS = [
  { to: '/', key: 'dashboard' },
  { to: '/pos', key: 'pos', perm: 'pos.access' },
  { to: '/products', key: 'products', perm: 'products.view' },
  { to: '/invoices', key: 'invoices', perm: 'pos.access' },
  { to: '/customers', key: 'customers', perm: 'customers.manage' },
  { to: '/suppliers', key: 'suppliers', perm: 'suppliers.manage' },
  { to: '/purchases', key: 'purchases', perm: 'purchases.manage' },
  { to: '/inventory', key: 'inventory', perm: 'inventory.view' },
  { to: '/expenses', key: 'expenses', perm: 'expenses.manage' },
  { to: '/income', key: 'income', perm: 'income.manage' },
  { to: '/reports', key: 'reports', perm: 'reports.view' },
  { to: '/users', key: 'users', perm: 'users.manage' },
  { to: '/audit-log', key: 'audit_log', perm: 'users.manage' },
  { to: '/settings', key: 'settings', perm: 'settings.manage' },
];

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const visibleNav = NAV_ITEMS.filter((item) => !item.perm || can(item.perm));

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <aside className="w-56 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="px-4 py-4 text-lg font-bold text-brand-600 dark:text-brand-400">{t('app_name')}</div>
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-sm">
          <div className="font-medium">{user?.full_name}</div>
          <div className="text-xs text-slate-500">{user?.role}</div>
          <button onClick={logout} className="mt-2 text-xs text-red-600 hover:underline">
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2">
          <SyncStatusBadge />
          <div className="flex items-center gap-2">
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
            >
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
            </select>
            <button
              onClick={toggleTheme}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-sm"
              title="Toggle theme"
            >
              {theme === 'dark' ? '🌙' : '☀️'}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
