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
  Layers,
  Tags,
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
    `h-8 px-2.5 xl:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 tracking-normal transition-all flex-shrink-0 whitespace-nowrap ${
      isActive
        ? 'bg-[#7652B5] text-white shadow-xs font-bold dark:bg-[#A98ADB] dark:text-[#17151D]'
        : 'text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#7652B5] dark:hover:text-[#A98ADB] hover:bg-[#EDE7F7]/70 dark:hover:bg-[#2B2536]'
    }`;

  const customNavItemClass = (isActive) =>
    `h-8 px-2.5 xl:px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 tracking-normal transition-all flex-shrink-0 whitespace-nowrap ${
      isActive
        ? 'bg-[#7652B5] text-white shadow-xs font-bold dark:bg-[#A98ADB] dark:text-[#17151D]'
        : 'text-[#716B7C] dark:text-[#B8B0C4] hover:text-[#7652B5] dark:hover:text-[#A98ADB] hover:bg-[#EDE7F7]/70 dark:hover:bg-[#2B2536]'
    }`;

  return (
    <div className="flex flex-col h-screen bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] overflow-hidden font-sans">
      {/* First Row – Top Application Header */}
      <header className="h-14 border-b border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] px-4 sm:px-6 md:px-8 flex items-center justify-between gap-4 w-full flex-shrink-0 z-30 shadow-2xs">
        {/* Left: Brand / Logo + Sync Status */}
        <div className="flex items-center gap-3 sm:gap-3.5 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-95 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7652B5] to-[#5B3B91] dark:from-[#A98ADB] dark:to-[#7652B5] text-white dark:text-[#17151D] flex items-center justify-center font-black text-xs shadow-xs">
              UP
            </div>
            <span className="text-sm font-bold text-[#282431] dark:text-[#F5F2F9] tracking-tight leading-none block">
              {t('app_name')}
            </span>
          </Link>

          {/* Divider */}
          <div className="h-4 w-px bg-[#E8E3EF] dark:bg-[#393244] mx-0.5" />

          {/* Sync Status Badge */}
          <div className="flex-shrink-0">
            <SyncStatusBadge />
          </div>
        </div>

        {/* Right: Office name & Administrator details, Language selector, Theme toggle, Logout */}
        <div className="flex items-center gap-3 sm:gap-3.5 flex-shrink-0">
          {/* Office name & Administrator details */}
          <div className="hidden sm:flex flex-col text-right justify-center">
            <span className="text-xs font-bold text-[#282431] dark:text-[#F5F2F9] leading-tight truncate max-w-[170px]">
              {user?.full_name || 'Administrator'}
            </span>
            <div className="flex items-center justify-end gap-1.5 leading-tight mt-0.5">
              {settings?.company_name && (
                <span className="text-[10px] text-[#716B7C] dark:text-[#B8B0C4] font-medium truncate max-w-[120px]">
                  {settings.company_name}
                </span>
              )}
              {settings?.company_name && (
                <span className="text-[8px] text-[#A98ADB]">•</span>
              )}
              <span className="text-[10px] text-[#7652B5] dark:text-[#A98ADB] capitalize font-semibold tracking-wide">
                {user?.role || 'admin'}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-6 w-px bg-[#E8E3EF] dark:bg-[#393244]" />

          {/* Controls: Language, Theme, Logout */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <select
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="h-8 rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#282431] dark:text-[#F5F2F9] px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#7652B5]/40 focus:border-[#7652B5] transition-all cursor-pointer shadow-2xs"
            >
              <option value="en">English (EN)</option>
              <option value="ta">தமிழ் (TA)</option>
            </select>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#7652B5] dark:text-[#A98ADB] hover:bg-[#EDE7F7] dark:hover:bg-[#2B2536] flex items-center justify-center transition-all shadow-2xs"
              title="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-[#A98ADB]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[#7652B5]" />
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={logout}
              title={t('nav.logout')}
              className="w-8 h-8 rounded-lg border border-[#E8E3EF] dark:border-[#393244] bg-[#F7F5FC] dark:bg-[#17151D] text-[#716B7C] dark:text-[#B8B0C4] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-200 dark:hover:border-red-900/50 flex items-center justify-center transition-all shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Second Row – Main Navigation Navbar (Full Width Distributed) */}
      <nav className="h-11 border-b border-[#E8E3EF] dark:border-[#393244] bg-white dark:bg-[#211D2A] px-4 sm:px-6 md:px-8 flex items-center justify-between gap-1 w-full flex-shrink-0 z-20 shadow-xs">
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
          <div className="relative flex-shrink-0 flex items-center" ref={productDropdownRef} onMouseEnter={() => setProductDropdownOpen(true)} onMouseLeave={() => setProductDropdownOpen(false)}>
            <NavLink
              to="/products"
              className={navItemClass}
            >
              <Package className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('nav.products')}</span>
            </NavLink>

            {/* Products Submenu Dropdown (hover only) */}
            {productDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-white dark:bg-[#211D2A] border border-[#E8E3EF] dark:border-[#393244] shadow-xl py-1 z-50 text-xs">
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

        {/* 4. Invoices */}
        {can('pos.access') && (
          <NavLink to="/invoices" className={navItemClass}>
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('nav.invoices')}</span>
          </NavLink>
        )}

        {/* 5. Customers & Collection (Direct link to /customers, NO dropdown) */}
        {can('customers.manage') && (
          <Link
            to="/customers"
            className={customNavItemClass(isCustomersActive)}
          >
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Customers & Collection</span>
          </Link>
        )}

        {/* 6. Purchase & Supplier (Direct link to /purchases, NO dropdown) */}
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

        {/* 8. Expenses & Income (Direct link to /expenses, NO dropdown) */}
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
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F7F5FC] dark:bg-[#17151D]">
        <Outlet />
      </main>

      {/* Install PWA Prompt Banner */}
      <PwaInstallPrompt />
    </div>
  );
}
