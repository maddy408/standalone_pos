import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme/ThemeProvider';
import { changeLanguage } from '../i18n';
import SyncStatusBadge from './SyncStatusBadge';
import PwaInstallPrompt from './PwaInstallPrompt';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  Tags,
  FileText,
  Users,
  Truck,
  ShoppingBag,
  Boxes,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  UserCheck,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [productMenuOpen, setProductMenuOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const canManageProducts = can('products.manage');

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand / Logo */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-md">
              UP
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-tight leading-tight">
                {t('app_name')}
              </div>
              <div className="text-[11px] text-amber-400 font-medium tracking-wide uppercase">
                Enterprise Suite
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin">
          <NavLink
            to="/"
            end
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span>{t('nav.dashboard')}</span>
          </NavLink>

          {can('pos.access') && (
            <NavLink
              to="/pos"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <ShoppingCart className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.pos')}</span>
            </NavLink>
          )}

          {/* Products with sub-items */}
          {can('products.view') && (
            <div className="space-y-0.5">
              <div
                onClick={() => setProductMenuOpen(!productMenuOpen)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer select-none transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 flex-shrink-0" />
                  <span>{t('nav.products')}</span>
                </div>
                {productMenuOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>

              {productMenuOpen && (
                <div className="ml-5 pl-3 border-l border-slate-700/60 space-y-0.5 my-1">
                  <NavLink
                    to="/products"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>All Products</span>
                  </NavLink>

                  {canManageProducts && (
                    <>
                      <NavLink
                        to="/master-data?tab=categories"
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                            isActive
                              ? 'bg-amber-500/20 text-amber-300 font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`
                        }
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Categories & Sub</span>
                      </NavLink>

                      <NavLink
                        to="/master-data?tab=brands"
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                            isActive
                              ? 'bg-amber-500/20 text-amber-300 font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`
                        }
                      >
                        <Tags className="w-3.5 h-3.5" />
                        <span>Brands Mapping</span>
                      </NavLink>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {can('pos.access') && (
            <NavLink
              to="/invoices"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.invoices')}</span>
            </NavLink>
          )}

          {can('customers.manage') && (
            <NavLink
              to="/customers"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.customers')}</span>
            </NavLink>
          )}

          {can('suppliers.manage') && (
            <NavLink
              to="/suppliers"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Truck className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.suppliers')}</span>
            </NavLink>
          )}

          {can('purchases.manage') && (
            <NavLink
              to="/purchases"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <ShoppingBag className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.purchases')}</span>
            </NavLink>
          )}

          {can('inventory.view') && (
            <NavLink
              to="/inventory"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Boxes className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.inventory')}</span>
            </NavLink>
          )}

          {can('expenses.manage') && (
            <NavLink
              to="/expenses"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <ArrowDownCircle className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.expenses')}</span>
            </NavLink>
          )}

          {can('income.manage') && (
            <NavLink
              to="/income"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <ArrowUpCircle className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.income')}</span>
            </NavLink>
          )}

          {can('reports.view') && (
            <NavLink
              to="/reports"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <BarChart3 className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.reports')}</span>
            </NavLink>
          )}

          {can('users.manage') && (
            <NavLink
              to="/users"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <UserCheck className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.users')}</span>
            </NavLink>
          )}

          {can('settings.manage') && (
            <NavLink
              to="/settings"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span>{t('nav.settings')}</span>
            </NavLink>
          )}
        </nav>

        {/* User Card */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">{user?.full_name}</div>
            <div className="text-[10px] text-amber-400 capitalize font-medium">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            title={t('nav.logout')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-3 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <SyncStatusBadge />
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="en">English (EN)</option>
              <option value="ta">தமிழ் (TA)</option>
            </select>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </header>

        {/* Page View Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100/70 dark:bg-slate-950 pb-20">
          <Outlet />
        </main>
      </div>

      {/* Install PWA Prompt Banner */}
      <PwaInstallPrompt />
    </div>
  );
}
