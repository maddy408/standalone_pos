import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
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
  ShieldCheck,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
} from 'lucide-react';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout, can } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef(null);

  const canManageProducts = can('products.manage');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setProductDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine active route for Products
  const isAllProductsActive = location.pathname === '/products';
  const isCategoriesActive =
    location.pathname === '/master-data' &&
    (location.search.includes('tab=categories') || !location.search.includes('tab='));
  const isBrandsActive =
    location.pathname === '/master-data' && location.search.includes('tab=brands');
  const isProductsActive = isAllProductsActive || isCategoriesActive || isBrandsActive;

  const navItemClass = ({ isActive }) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all flex-shrink-0 whitespace-nowrap ${
      isActive
        ? 'bg-[#7652B5] text-white shadow-sm dark:bg-[#A98ADB] dark:text-[#17151D] font-bold'
        : 'text-[#716B7C] dark:text-[#B8B0C4] hover:bg-[#EDE7F7] hover:text-[#282431] dark:hover:bg-[#2B2536] dark:hover:text-[#F5F2F9]'
    }`;

  return (
    <div className="flex flex-col h-screen bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] overflow-hidden font-sans">
      {/* Top Single Header with Horizontal Navigation */}
      <header className="h-14 border-b border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] px-4 flex items-center justify-between gap-3 w-full max-w-full overflow-hidden flex-shrink-0 z-30 shadow-sm">
        {/* Brand / Logo + Sync Now option */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#7652B5] dark:bg-[#A98ADB] text-white dark:text-[#17151D] flex items-center justify-center font-black text-sm shadow-sm">
              UP
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9] tracking-tight leading-none">
                {t('app_name')}
              </span>
            </div>
          </Link>

          {/* Sync Status Badge with "Sync Now" */}
          <div className="flex-shrink-0">
            <SyncStatusBadge />
          </div>
        </div>

        {/* Navigation Menu (Immediately after Sync Now, strictly single row, only this area scrolls) */}
        <nav className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-thin px-1 py-1">
          <NavLink to="/" end className={navItemClass}>
            <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.dashboard')}</span>
          </NavLink>

          {can('pos.access') && (
            <NavLink to="/pos" className={navItemClass}>
              <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.pos')}</span>
            </NavLink>
          )}

          {/* Products Menu (Direct NavLink without downward dropdown arrow) */}
          {can('products.view') && (
            <div className="relative flex-shrink-0" ref={productDropdownRef} onMouseEnter={() => setProductDropdownOpen(true)} onMouseLeave={() => setProductDropdownOpen(false)}>
              <NavLink
                to="/products"
                className={navItemClass}
              >
                <Package className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t('nav.products')}</span>
              </NavLink>

              {/* Products Submenu Dropdown (opens on hover, no downward chevron arrow button) */}
              {productDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl bg-white dark:bg-[#211D2A] border border-[#E8E3EF] dark:border-[#393244] shadow-xl py-1 z-50 text-xs">
                  {/* 1. All Products */}
                  <Link
                    to="/products"
                    onClick={() => setProductDropdownOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                      isAllProductsActive
                        ? 'bg-[#EDE7F7] text-[#7652B5] font-bold dark:bg-[#2B2536] dark:text-[#A98ADB]'
                        : 'text-[#716B7C] dark:text-[#B8B0C4] hover:bg-[#F7F5FC] dark:hover:bg-[#2B2536] hover:text-[#282431] dark:hover:text-[#F5F2F9]'
                    }`}
                  >
                    <Package className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>All Products</span>
                  </Link>

                  {canManageProducts && (
                    <>
                      {/* 2. Categories & Sub */}
                      <Link
                        to="/master-data?tab=categories"
                        onClick={() => setProductDropdownOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                          isCategoriesActive
                            ? 'bg-[#EDE7F7] text-[#7652B5] font-bold dark:bg-[#2B2536] dark:text-[#A98ADB]'
                            : 'text-[#716B7C] dark:text-[#B8B0C4] hover:bg-[#F7F5FC] dark:hover:bg-[#2B2536] hover:text-[#282431] dark:hover:text-[#F5F2F9]'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Categories & Sub</span>
                      </Link>

                      {/* 3. Brands Mapping */}
                      <Link
                        to="/master-data?tab=brands"
                        onClick={() => setProductDropdownOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                          isBrandsActive
                            ? 'bg-[#EDE7F7] text-[#7652B5] font-bold dark:bg-[#2B2536] dark:text-[#A98ADB]'
                            : 'text-[#716B7C] dark:text-[#B8B0C4] hover:bg-[#F7F5FC] dark:hover:bg-[#2B2536] hover:text-[#282431] dark:hover:text-[#F5F2F9]'
                        }`}
                      >
                        <Tags className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Brands Mapping</span>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {can('pos.access') && (
            <NavLink to="/invoices" className={navItemClass}>
              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.invoices')}</span>
            </NavLink>
          )}

          {can('customers.manage') && (
            <NavLink to="/customers" className={navItemClass}>
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.customers')}</span>
            </NavLink>
          )}

          {can('suppliers.manage') && (
            <NavLink to="/suppliers" className={navItemClass}>
              <Truck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.suppliers')}</span>
            </NavLink>
          )}

          {can('purchases.manage') && (
            <NavLink to="/purchases" className={navItemClass}>
              <ShoppingBag className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.purchases')}</span>
            </NavLink>
          )}

          {can('inventory.view') && (
            <NavLink to="/inventory" className={navItemClass}>
              <Boxes className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.inventory')}</span>
            </NavLink>
          )}

          {can('expenses.manage') && (
            <NavLink to="/expenses" className={navItemClass}>
              <ArrowDownCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.expenses')}</span>
            </NavLink>
          )}

          {can('income.manage') && (
            <NavLink to="/income" className={navItemClass}>
              <ArrowUpCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.income')}</span>
            </NavLink>
          )}

          {can('reports.view') && (
            <NavLink to="/reports" className={navItemClass}>
              <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.reports')}</span>
            </NavLink>
          )}

          {can('users.manage') && (
            <NavLink to="/users" className={navItemClass}>
              <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.users')}</span>
            </NavLink>
          )}

          {can('users.manage') && (
            <NavLink to="/audit-log" className={navItemClass}>
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.audit_log')}</span>
            </NavLink>
          )}

          {can('settings.manage') && (
            <NavLink to="/settings" className={navItemClass}>
              <Settings className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.settings')}</span>
            </NavLink>
          )}
        </nav>

        {/* Right Header Controls: Administrator Profile, Language, Theme, Logout */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Administrator Profile */}
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-[#282431] dark:text-[#F5F2F9] leading-tight truncate max-w-[120px]">
              {user?.full_name || 'Administrator'}
            </span>
            <span className="text-[10px] text-[#7652B5] dark:text-[#A98ADB] capitalize font-semibold leading-tight">
              {user?.role || 'admin'}
            </span>
          </div>

          {/* Language Selector */}
          <select
            value={i18n.language}
            onChange={(e) => changeLanguage(e.target.value)}
            className="rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7652B5]/30 focus:border-[#7652B5]"
          >
            <option value="en">English (EN)</option>
            <option value="ta">தமிழ் (TA)</option>
          </select>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#7652B5] dark:text-[#A98ADB] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#A98ADB]" />
            ) : (
              <Moon className="w-4 h-4 text-[#7652B5]" />
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            title={t('nav.logout')}
            className="p-1.5 rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#716B7C] dark:text-[#B8B0C4] hover:text-red-500 hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Page View Body */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F7F5FC] dark:bg-[#17151D]">
        <Outlet />
      </main>

      {/* Install PWA Prompt Banner */}
      <PwaInstallPrompt />
    </div>
  );
}
