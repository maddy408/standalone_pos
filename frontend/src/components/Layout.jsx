import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useTheme } from '../theme/ThemeProvider';
import { changeLanguage } from '../i18n';
import SyncStatusBadge from './SyncStatusBadge';
import PwaInstallPrompt from './PwaInstallPrompt';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Users,
  ShoppingBag,
  Boxes,
  ArrowDownCircle,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout, can } = useAuth();
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Determine active route for Products
  const isProductsActive =
    location.pathname === '/products' ||
    location.pathname === '/master-data';

  // Active check for Customers & Collection
  const isCustomersActive =
    location.pathname.startsWith('/customers') ||
    location.pathname.startsWith('/collection') ||
    location.pathname.startsWith('/collections');

  // Active check for Purchase & Supplier
  const isPurchaseSupplierActive =
    location.pathname.startsWith('/purchases') ||
    location.pathname.startsWith('/suppliers');

  // Active check for Expenses & Income
  const isFinanceActive =
    location.pathname.startsWith('/expenses') ||
    location.pathname.startsWith('/income');

  const navItemClass = ({ isActive }) =>
    `h-8 px-2.5 xl:px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tracking-normal transition-all flex-shrink-0 whitespace-nowrap ${
      isActive
        ? 'bg-[#0A4174] text-white shadow-md font-bold dark:bg-[#4A8CD2] dark:text-[#0B131E]'
        : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8]/80 dark:hover:bg-[#1A2A3D]'
    }`;

  const customNavItemClass = (isActive) =>
    `h-8 px-2.5 xl:px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tracking-normal transition-all flex-shrink-0 whitespace-nowrap ${
      isActive
        ? 'bg-[#0A4174] text-white shadow-md font-bold dark:bg-[#4A8CD2] dark:text-[#0B131E]'
        : 'text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2] hover:bg-[#E2EDF8]/80 dark:hover:bg-[#1A2A3D]'
    }`;

  return (
    <div className="flex flex-col h-screen text-[#1C2736] dark:text-[#F1F5F9] overflow-hidden font-sans">
      {/* First Row – Top Application Header with Water Glass effect */}
      <header className="h-14 water-glass-header px-4 sm:px-6 md:px-8 flex items-center justify-between gap-4 w-full flex-shrink-0 z-30">
        {/* Left: Brand / Logo + Sync Status */}
        <div className="flex items-center gap-3 sm:gap-3.5 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-95 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0A4174] to-[#062E52] dark:from-[#4A8CD2] dark:to-[#0A4174] text-white dark:text-[#0B131E] flex items-center justify-center font-black text-xs shadow-md">
              UP
            </div>
            <span className="text-sm font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight leading-none block">
              {t('app_name')}
            </span>
          </Link>

          {/* Divider */}
          <div className="h-4 w-px bg-[#DCE5EF] dark:bg-[#22354B] mx-0.5" />

          {/* Sync Status Badge */}
          <div className="flex-shrink-0">
            <SyncStatusBadge />
          </div>
        </div>

        {/* Right: Office name & Administrator details, Language selector, Theme toggle, Logout */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-shrink-0">
          {/* Office name & Administrator details */}
          <div className="hidden sm:flex flex-col text-right justify-center">
            <span className="text-xs font-bold text-[#1C2736] dark:text-[#F1F5F9] leading-tight truncate max-w-[170px]">
              {user?.full_name || 'Administrator'}
            </span>
            <div className="flex items-center justify-end gap-1.5 leading-tight mt-0.5">
              {settings?.company_name && (
                <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8] font-medium truncate max-w-[120px]">
                  {settings.company_name}
                </span>
              )}
              {settings?.company_name && (
                <span className="text-[8px] text-[#0A4174] dark:text-[#4A8CD2]">•</span>
              )}
              <span className="text-[10px] text-[#0A4174] dark:text-[#4A8CD2] capitalize font-bold tracking-wide">
                {user?.role || 'admin'}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-6 w-px bg-[#DCE5EF] dark:bg-[#22354B]" />

          {/* Controls: Language, Theme, Logout */}
          <div className="flex items-center gap-1.5">
            {/* Language Selector */}
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="h-8 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white/70 dark:bg-[#121E2C]/70 text-[#1C2736] dark:text-[#F1F5F9] px-2 text-xs font-medium focus:outline-none transition-all cursor-pointer shadow-2xs"
            >
              <option value="en">English (EN)</option>
              <option value="ta">தமிழ் (TA)</option>
            </select>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white/70 dark:bg-[#121E2C]/70 text-[#0A4174] dark:text-[#4A8CD2] hover:bg-[#E2EDF8] dark:hover:bg-[#1A2A3D] flex items-center justify-center transition-all shadow-2xs"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-[#4A8CD2]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[#0A4174]" />
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={logout}
              title={t('nav.logout')}
              className="w-8 h-8 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white/70 dark:bg-[#121E2C]/70 text-[#5A6B82] dark:text-[#94A3B8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-all shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Second Row – Main Navigation Navbar (Water Glass Nav) */}
      <nav className="h-11 water-glass-header px-4 sm:px-6 md:px-8 flex items-center justify-between gap-1 w-full flex-shrink-0 z-20">
        {/* 1. Dashboard */}
        <NavLink to="/" end className={navItemClass}>
          <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('nav.dashboard')}</span>
        </NavLink>

        {/* 2. POS */}
        {can('pos.access') && (
          <NavLink to="/pos" className={navItemClass}>
            <ShoppingCart className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.pos')}</span>
          </NavLink>
        )}

        {/* 3. Products */}
        {can('products.view') && (
          <Link
            to="/products"
            className={customNavItemClass(isProductsActive)}
          >
            <Package className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.products')}</span>
          </Link>
        )}

        {/* 4. Invoices */}
        {can('pos.access') && (
          <NavLink to="/invoices" className={navItemClass}>
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.invoices')}</span>
          </NavLink>
        )}

        {/* 5. Customers & Collection */}
        {can('customers.manage') && (
          <Link
            to="/customers"
            className={customNavItemClass(isCustomersActive)}
          >
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Customers & Collection</span>
          </Link>
        )}

        {/* 6. Purchase & Supplier */}
        {(can('purchases.manage') || can('suppliers.manage')) && (
          <Link
            to="/purchases"
            className={customNavItemClass(isPurchaseSupplierActive)}
          >
            <ShoppingBag className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Purchase & Supplier</span>
          </Link>
        )}

        {/* 7. Inventory */}
        {can('inventory.view') && (
          <NavLink to="/inventory" className={navItemClass}>
            <Boxes className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.inventory')}</span>
          </NavLink>
        )}

        {/* 8. Expenses & Income */}
        {(can('expenses.manage') || can('income.manage')) && (
          <Link
            to="/expenses"
            className={customNavItemClass(isFinanceActive)}
          >
            <ArrowDownCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Expenses & Income</span>
          </Link>
        )}

        {/* 9. Reports */}
        {can('reports.view') && (
          <NavLink to="/reports" className={navItemClass}>
            <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.reports')}</span>
          </NavLink>
        )}

        {/* 10. Master Settings */}
        {can('settings.manage') && (
          <NavLink to="/settings" className={navItemClass}>
            <Settings className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.settings')}</span>
          </NavLink>
        )}
      </nav>

      {/* Main Page View Body */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 transition-colors duration-300">
        <Outlet />
      </main>

      {/* Install PWA Prompt Banner */}
      <PwaInstallPrompt />
    </div>
  );
}
