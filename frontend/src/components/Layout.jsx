import { useState, useEffect } from 'react';
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
  ClipboardList,
  Truck,
  Users,
  ShoppingBag,
  Boxes,
  ArrowDownCircle,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  User as UserIcon,
} from 'lucide-react';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const { user, logout, can } = useAuth();
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

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

  // Mobile Drawer Navigation Item
  const drawerItemClass = (isActive) =>
    `flex items-center justify-between p-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] ${
      isActive
        ? 'bg-[#0A4174] text-white shadow-md font-bold dark:bg-[#4A8CD2] dark:text-[#0B131E]'
        : 'text-[#1C2736] dark:text-[#F1F5F9] hover:bg-[#E2EDF8]/60 dark:hover:bg-[#1A2A3D]/70'
    }`;

  // Mobile Bottom Navigation Tab Class
  const bottomTabClass = ({ isActive }) =>
    `flex-1 py-1.5 flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-all relative ${
      isActive
        ? 'text-[#0A4174] dark:text-[#4A8CD2]'
        : 'text-[#5A6B82] dark:text-[#94A3B8] opacity-75'
    }`;

  return (
    <div className="flex flex-col h-screen text-[#1C2736] dark:text-[#F1F5F9] overflow-hidden font-sans">
      {/* First Row – Top Application Header with Water Glass effect */}
      <header className="h-14 water-glass-header px-3 sm:px-6 md:px-8 flex items-center justify-between gap-2.5 w-full flex-shrink-0 z-30 pt-safe">
        {/* Left: Mobile Hamburger + Brand / Logo + Sync Status */}
        <div className="flex items-center gap-2 sm:gap-3.5 flex-shrink-0">
          {/* Mobile Drawer Trigger Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden w-8 h-8 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white/80 dark:bg-[#121E2C]/80 text-[#0A4174] dark:text-[#4A8CD2] flex items-center justify-center active:scale-95 shadow-2xs"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 hover:opacity-95 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0A4174] to-[#062E52] dark:from-[#4A8CD2] dark:to-[#0A4174] text-white dark:text-[#0B131E] flex items-center justify-center font-black text-xs shadow-md">
              UP
            </div>
            <span className="text-sm font-black text-[#1C2736] dark:text-[#F1F5F9] tracking-tight leading-none">
              {t('app_name')}
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden sm:block h-4 w-px bg-[#DCE5EF] dark:bg-[#22354B] mx-0.5" />

          {/* Sync Status Badge */}
          <div className="flex-shrink-0">
            <SyncStatusBadge />
          </div>
        </div>

        {/* Right: Office name & Administrator details, Language selector, Theme toggle, Logout */}
        <div className="flex items-center gap-2 sm:gap-3.5 flex-shrink-0">
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
              <option value="en">EN</option>
              <option value="ta">தமிழ்</option>
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

      {/* Second Row – Main Desktop Navigation Navbar (Water Glass Nav) */}
      <nav className="hidden md:flex h-11 water-glass-header px-4 sm:px-6 md:px-8 items-center justify-between gap-1 w-full flex-shrink-0 z-20 overflow-x-auto scrollbar-none">
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

        {/* 4b. Orders & Pre-Bookings / Van Sales */}
        {(can('orders.view') || can('van_sales.view')) && (
          <NavLink to="/orders" className={navItemClass}>
            <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.orders')}</span>
          </NavLink>
        )}

        {/* 5. Customers & Collection */}
        {can('customers.manage') && (
          <Link
            to="/customers"
            className={customNavItemClass(isCustomersActive)}
          >
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Customers & Credit</span>
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
      <main className={`flex-1 transition-colors duration-300 ${location.pathname === '/pos' ? 'overflow-hidden p-1 sm:p-2' : 'overflow-y-auto p-2 sm:p-4 md:p-6 pb-2 md:pb-6'}`}>
        <Outlet />
      </main>

      {/* ======================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (APP NATIVE DOCK)          */}
      {/* ======================================================== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 water-glass-header border-t border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-around px-2 z-30 pb-safe shadow-lg">
        <NavLink to="/" end className={bottomTabClass}>
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E]' : ''}`}>
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <span className="leading-none">{t('nav.dashboard')}</span>
            </>
          )}
        </NavLink>

        {can('pos.access') && (
          <NavLink to="/pos" className={bottomTabClass}>
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E]' : ''}`}>
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <span className="leading-none">{t('nav.pos')}</span>
              </>
            )}
          </NavLink>
        )}

        {can('pos.access') && (
          <NavLink to="/invoices" className={bottomTabClass}>
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E]' : ''}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <span className="leading-none">{t('nav.invoices')}</span>
              </>
            )}
          </NavLink>
        )}

        {can('products.view') && (
          <NavLink to="/products" className={bottomTabClass}>
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E]' : ''}`}>
                  <Package className="w-4 h-4" />
                </div>
                <span className="leading-none">{t('nav.products')}</span>
              </>
            )}
          </NavLink>
        )}

        {/* Mobile More / Drawer Button */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex-1 py-1.5 flex flex-col items-center justify-center gap-1 text-[10px] font-bold text-[#5A6B82] dark:text-[#94A3B8] opacity-75 active:opacity-100"
        >
          <div className="p-1 rounded-xl">
            <Menu className="w-4 h-4" />
          </div>
          <span className="leading-none">More</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* MOBILE DRAWER (SLIDE-OVER MENU)                         */}
      {/* ======================================================== */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop with Blur */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative w-4/5 max-w-xs bg-white dark:bg-[#0B131E] h-full shadow-2xl flex flex-col z-10 border-r border-[#DCE5EF] dark:border-[#22354B]">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#DCE5EF] dark:border-[#22354B] flex items-center justify-between bg-[#F4F7FB]/70 dark:bg-[#121E2C]/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] flex items-center justify-center font-black text-sm shadow-md">
                  UP
                </div>
                <div>
                  <div className="font-extrabold text-sm text-[#1C2736] dark:text-[#F1F5F9] leading-tight">
                    {t('app_name')}
                  </div>
                  <div className="text-[11px] text-[#5A6B82] dark:text-[#94A3B8]">
                    {user?.full_name || 'Administrator'} ({user?.role || 'admin'})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 rounded-xl water-glass-pill flex items-center justify-center text-[#5A6B82] dark:text-[#94A3B8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Nav Links List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-none">
              <Link
                to="/"
                onClick={() => setMobileDrawerOpen(false)}
                className={drawerItemClass(location.pathname === '/')}
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                  <span>{t('nav.dashboard')}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </Link>

              {can('pos.access') && (
                <Link
                  to="/pos"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(location.pathname === '/pos')}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-4 h-4 flex-shrink-0" />
                    <span>{t('nav.pos')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {can('products.view') && (
                <Link
                  to="/products"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(isProductsActive)}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 flex-shrink-0" />
                    <span>{t('nav.products')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {can('pos.access') && (
                <Link
                  to="/invoices"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(location.pathname.startsWith('/invoices'))}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <span>{t('nav.invoices')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {(can('orders.view') || can('van_sales.view')) && (
                <Link
                  to="/orders"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(location.pathname.startsWith('/orders'))}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-4 h-4 flex-shrink-0" />
                    <span>{t('nav.orders')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {can('customers.manage') && (
                <Link
                  to="/customers"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(isCustomersActive)}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>Customers & Credit</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {(can('purchases.manage') || can('suppliers.manage')) && (
                <Link
                  to="/purchases"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(isPurchaseSupplierActive)}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="w-4 h-4 flex-shrink-0" />
                    <span>Purchase & Supplier</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {can('inventory.view') && (
                <Link
                  to="/inventory"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(location.pathname.startsWith('/inventory'))}
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="w-4 h-4 flex-shrink-0" />
                    <span>{t('nav.inventory')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {(can('expenses.manage') || can('income.manage')) && (
                <Link
                  to="/expenses"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(isFinanceActive)}
                >
                  <div className="flex items-center gap-3">
                    <ArrowDownCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Expenses & Income</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {can('reports.view') && (
                <Link
                  to="/reports"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(location.pathname.startsWith('/reports'))}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 flex-shrink-0" />
                    <span>{t('nav.reports')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}

              {can('settings.manage') && (
                <Link
                  to="/settings"
                  onClick={() => setMobileDrawerOpen(false)}
                  className={drawerItemClass(location.pathname.startsWith('/settings'))}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 flex-shrink-0" />
                    <span>{t('nav.settings')}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </Link>
              )}
            </div>

            {/* Drawer Bottom Actions: User info + Logout */}
            <div className="p-3 border-t border-[#DCE5EF] dark:border-[#22354B] bg-[#F4F7FB]/50 dark:bg-[#121E2C]/50 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 font-bold text-xs hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install PWA Prompt Banner */}
      <PwaInstallPrompt />
    </div>
  );
}
