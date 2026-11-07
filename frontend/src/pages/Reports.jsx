import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency } from '../utils/currency';
import { exportTableCsv, printTable } from '../utils/reportExport';
import { FileSpreadsheet, Printer, Search } from 'lucide-react';

const REPORT_TABS = [
  'sales', 'sales_reports', 'purchases', 'profit_loss', 'inventory', 'stock_adjustments',
  'expenses', 'income', 'tax', 'tax_register', 'credit_outstanding', 'customers', 'suppliers', 'payments',
];

function firstOfMonth() {
  return new Date().toISOString().slice(0, 8) + '01';
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

const API_PATH = {
  profit_loss: 'profit-loss',
  stock_adjustments: 'stock-adjustments',
  tax_register: 'tax-register',
  credit_outstanding: 'credit-outstanding',
};

// Columns summed in each table's footer totals row — curated per tab, same
// spirit as KC Agency's NUMERIC_REPORT_KEYS (never auto-detected, so a phone
// number or id column can never be silently "totaled").
const SALES_WISE_TOTAL_KEYS = ['bills', 'items', 'quantity', 'gross_sales', 'discount', 'gst', 'net_sales', 'paid_amount', 'credit_amount'];

export default function Reports() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [tab, setTab] = useState('sales');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const currency = settings?.currency_symbol || '₹';

  const needsDateRange = !['inventory', 'customers', 'suppliers', 'credit_outstanding', 'sales_reports'].includes(tab);
  // Reports that break figures down per product must stay scoped to the
  // shop's active business type, same as the Products/POS/Inventory
  // screens — whole-business financial reports (profit/loss, expenses,
  // income, customers, suppliers, payments) deliberately stay unscoped
  // since an invoice/expense/payment isn't itself tied to one business type.
  const PRODUCT_SCOPED_TABS = ['sales', 'inventory', 'stock_adjustments', 'tax'];

  const load = () => {
    if (tab === 'sales_reports') return; // self-managed by SalesReportsSection
    setLoading(true);
    const params = needsDateRange ? { from, to } : {};
    if (PRODUCT_SCOPED_TABS.includes(tab) && settings?.business_type) {
      params.business_type = settings.business_type;
    }
    const path = `/reports/${API_PATH[tab] || tab}`;
    api
      .get(path, { params })
      .then(async ({ data }) => {
        if (
          settings?.business_type &&
          (!data || (Array.isArray(data) && data.length === 0) || (data.rows && data.rows.length === 0))
        ) {
          try {
            const fallbackParams = needsDateRange ? { from, to } : {};
            const resAll = await api.get(path, { params: fallbackParams });
            if (resAll.data) {
              setData(resAll.data);
              return;
            }
          } catch {}
        }
        setData(data);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, settings?.business_type]);

  const fmt = (n) => formatCurrency(n, currency);
  const c = (key) => t(`reports.cols.${key}`);

  const handleTabChange = (nextTab) => {
    setData(null);
    setTab(nextTab);
  };

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">{t('reports.title')}</h1>

      <div className="mb-3 flex flex-wrap gap-1">
        {REPORT_TABS.map((key) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === key ? 'bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E]' : 'border border-[#DCE5EF] dark:border-[#22354B]'
            }`}
          >
            {t(`reports.tabs.${key}`)}
          </button>
        ))}
      </div>

      {needsDateRange && (
        <div className="mb-3 flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-sm" />
          <span className="text-sm">{t('reports.to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-sm" />
          <button onClick={load} className="rounded-md bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] px-4 py-1.5 font-bold text-xs shadow-sm">{t('reports.apply')}</button>
        </div>
      )}

      {tab === 'sales_reports' && <SalesReportsSection currency={currency} />}

      {tab !== 'sales_reports' && loading && <div className="text-sm text-[#5A6B82] dark:text-[#94A3B8]">{t('common.loading')}</div>}

      {tab !== 'sales_reports' && !loading && data && (
        <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4 overflow-x-auto">
          {tab === 'sales' && (
            <>
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label={t('reports.stats.invoices')} value={data.totals?.invoice_count ?? 0} />
                <Stat label={t('reports.stats.subtotal')} value={fmt(data.totals?.subtotal ?? 0)} />
                <Stat label={t('reports.stats.tax')} value={fmt(data.totals?.tax ?? 0)} />
                <Stat label={t('reports.stats.grand_total')} value={fmt(data.totals?.grand_total ?? 0)} />
              </div>
              <Table
                title={t('reports.by_day')}
                filenameBase="sales_by_day"
                emptyText={t('reports.no_data')}
                rows={data.by_day || []}
                cols={[
                  ['day', c('date')],
                  ['invoice_count', c('invoices')],
                  ['total', c('total'), fmt],
                ]}
                totalKeys={['invoice_count', 'total']}
              />
            </>
          )}

          {tab === 'purchases' && (
            <>
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label={t('reports.stats.purchases')} value={data.totals?.purchase_count ?? 0} />
                <Stat label={t('reports.stats.grand_total')} value={fmt(data.totals?.grand_total ?? 0)} />
                <Stat label={t('reports.stats.paid')} value={fmt(data.totals?.paid_amount ?? 0)} />
                <Stat label={t('reports.stats.balance')} value={fmt(data.totals?.balance_amount ?? 0)} />
              </div>
              <Table
                title={t('reports.tabs.purchases')}
                filenameBase="purchases"
                emptyText={t('reports.no_data')}
                rows={data.list || []}
                cols={[
                  ['purchase_no', c('purchase_no')],
                  ['supplier_name', c('supplier')],
                  ['grand_total', c('total'), fmt],
                  ['balance_amount', c('balance'), fmt],
                ]}
                totalKeys={['grand_total', 'balance_amount']}
              />
            </>
          )}

          {tab === 'profit_loss' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat label={t('reports.stats.revenue')} value={fmt(data.revenue ?? 0)} />
              <Stat label={t('reports.stats.cost_of_goods')} value={fmt(data.cost_of_goods ?? 0)} />
              <Stat label={t('reports.stats.gross_profit')} value={fmt(data.gross_profit ?? 0)} />
              <Stat label={t('reports.stats.other_income')} value={fmt(data.other_income ?? 0)} />
              <Stat label={t('reports.stats.expenses')} value={fmt(data.expenses ?? 0)} />
              <Stat label={t('reports.stats.net_profit')} value={fmt(data.net_profit ?? 0)} highlight />
            </div>
          )}

          {tab === 'inventory' && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <Stat label={t('reports.stats.stock_value_cost')} value={fmt(data.total_value_at_cost ?? 0)} />
                <Stat label={t('reports.stats.stock_value_price')} value={fmt(data.total_value_at_price ?? 0)} />
              </div>
              <Table
                title={t('reports.tabs.inventory')}
                filenameBase="inventory"
                emptyText={t('reports.no_data')}
                rows={data.items || []}
                cols={[
                  ['name', c('product')],
                  ['business_type', c('type')],
                  ['stock_qty', c('stock')],
                  ['stock_value_at_cost', c('value_cost'), fmt],
                ]}
                totalKeys={['stock_qty', 'stock_value_at_cost']}
              />
            </>
          )}

          {tab === 'stock_adjustments' && (
            <Table
              title={t('reports.tabs.stock_adjustments')}
              filenameBase="stock_adjustments"
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['product_name', c('product')],
                ['qty_change', c('qty_change')],
                ['notes', c('reason')],
                ['user_name', c('by')],
                ['created_at', c('date')],
              ]}
              totalKeys={['qty_change']}
            />
          )}

          {(tab === 'expenses' || tab === 'income') && (
            <Table
              title={t(`reports.tabs.${tab}`)}
              filenameBase={tab}
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['category_name', c('category')],
                ['count', c('count')],
                ['total', c('total'), fmt],
              ]}
              totalKeys={['count', 'total']}
            />
          )}

          {tab === 'tax' && (
            <Table
              title={t('reports.tabs.tax')}
              filenameBase="tax"
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['tax_name', c('tax_name')],
                ['percent', c('percent')],
                ['taxable_sales', c('taxable_sales'), fmt],
                ['tax_collected', c('tax_collected'), fmt],
              ]}
              totalKeys={['taxable_sales', 'tax_collected']}
            />
          )}

          {tab === 'tax_register' && (
            <Table
              title={t('reports.tabs.tax_register')}
              subtitle={`${from} ${t('reports.to')} ${to}`}
              filenameBase="tax_register"
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['invoice_no', c('invoice_no')],
                ['created_at', c('date')],
                ['customer_name', c('customer')],
                ['taxable_value', c('taxable_value'), fmt],
                ['tax_amount', c('tax_collected'), fmt],
                ['grand_total', c('total'), fmt],
                ['status', c('status')],
              ]}
              totalKeys={['taxable_value', 'tax_amount', 'grand_total']}
            />
          )}

          {tab === 'credit_outstanding' && (
            <Table
              title={t('reports.tabs.credit_outstanding')}
              filenameBase="credit_outstanding"
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['customer_name', c('customer')],
                ['phone', c('phone')],
                ['credit_limit', c('credit_limit'), fmt],
                ['total_outstanding', c('outstanding'), fmt],
                ['days_overdue', c('days_overdue')],
                ['over_limit', c('over_limit')],
              ]}
              totalKeys={['total_outstanding']}
            />
          )}

          {tab === 'customers' && (
            <Table
              title={t('reports.tabs.customers')}
              filenameBase="customers"
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['name', c('customer')],
                ['phone', c('phone')],
                ['balance', c('outstanding'), fmt],
                ['lifetime_sales', c('lifetime_sales'), fmt],
              ]}
              totalKeys={['balance', 'lifetime_sales']}
            />
          )}

          {tab === 'suppliers' && (
            <Table
              title={t('reports.tabs.suppliers')}
              filenameBase="suppliers"
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['name', c('supplier')],
                ['phone', c('phone')],
                ['balance', c('outstanding'), fmt],
                ['lifetime_purchases', c('lifetime_purchases'), fmt],
              ]}
              totalKeys={['balance', 'lifetime_purchases']}
            />
          )}

          {tab === 'payments' && (
            <Table
              title={t('reports.tabs.payments')}
              filenameBase="payments"
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['method_name', c('method')],
                ['count', c('count')],
                ['total', c('total'), fmt],
              ]}
              totalKeys={['count', 'total']}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sales Reports — a nested tab bar of 7 "X-wise sales" breakdowns, following
// KC Agency's SalesReportsSection flow: its own date range (defaults to
// today, not month-start), an optional search box on a couple of sub-tabs,
// and the same selectable/exportable Table used everywhere else on this page.
// Universal POS has no branches, so "Business Type Wise" substitutes for
// KC's "Branch Wise" (business_type is this app's only partition axis).
// ---------------------------------------------------------------------------

const SALES_REPORTS = [
  { key: 'business_type', api: 'sales-by-business-type' },
  { key: 'customer', api: 'sales-by-customer', searchable: ['customer_name'] },
  { key: 'supplier', api: 'sales-by-supplier' },
  { key: 'brand', api: 'sales-by-brand' },
  { key: 'category', api: 'sales-by-category' },
  { key: 'brand_category', api: 'sales-by-brand-category' },
  { key: 'item', api: 'sales-by-item', searchable: ['item_name', 'sku', 'barcode'] },
];

function SalesReportsSection({ currency }) {
  const { t } = useTranslation();
  const [sub, setSub] = useState('business_type');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const config = SALES_REPORTS.find((s) => s.key === sub);
  const fmt = (n) => formatCurrency(n, currency);
  const c = (key) => t(`reports.cols.${key}`);

  const load = () => {
    setLoading(true);
    api
      .get(`/reports/${config.api}`, { params: { from, to } })
      .then(({ data }) => setRows(data))
      .catch(() => setRows(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setSearch('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  const resetDates = () => {
    setFrom(today());
    setTo(today());
  };

  const filteredRows = useMemo(() => {
    if (!config?.searchable || !Array.isArray(rows)) return rows;
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => config.searchable.some((k) => String(r[k] ?? '').toLowerCase().includes(term)));
  }, [rows, search, config]);

  const colsFor = (key) => {
    switch (key) {
      case 'business_type':
        return [
          ['business_type', c('business_type')],
          ['bills', c('bills')],
          ['items', c('items')],
          ['quantity', c('quantity')],
          ['gross_sales', c('gross_sales'), fmt],
          ['discount', c('discount'), fmt],
          ['gst', c('gst')],
          ['net_sales', c('net_sales'), fmt],
          ['paid_amount', c('paid')],
          ['credit_amount', c('credit'), fmt],
        ];
      case 'customer':
        return [
          ['customer_code', c('code')],
          ['customer_name', c('customer')],
          ['bills', c('bills')],
          ['items', c('items')],
          ['quantity', c('quantity')],
          ['gross_sales', c('gross_sales'), fmt],
          ['discount', c('discount'), fmt],
          ['gst', c('gst')],
          ['net_sales', c('net_sales'), fmt],
          ['paid_amount', c('paid')],
          ['credit_amount', c('credit'), fmt],
        ];
      case 'supplier':
        return [
          ['supplier_name', c('supplier')],
          ['items_sold', c('items_sold')],
          ['quantity', c('quantity')],
          ['gross_sales', c('gross_sales'), fmt],
          ['discount', c('discount'), fmt],
          ['gst', c('gst')],
          ['net_sales', c('net_sales'), fmt],
        ];
      case 'brand':
        return [
          ['brand_name', c('brand')],
          ['items_sold', c('items_sold')],
          ['quantity', c('quantity')],
          ['gross_sales', c('gross_sales'), fmt],
          ['discount', c('discount'), fmt],
          ['gst', c('gst')],
          ['net_sales', c('net_sales'), fmt],
        ];
      case 'brand_category':
        return [
          ['brand_name', c('brand')],
          ['category_name', c('category')],
          ['items_sold', c('items_sold')],
          ['quantity', c('quantity')],
          ['gross_sales', c('gross_sales'), fmt],
          ['discount', c('discount'), fmt],
          ['gst', c('gst')],
          ['net_sales', c('net_sales'), fmt],
        ];
      case 'item':
        return [
          ['item_name', c('item')],
          ['sku', c('sku')],
          ['barcode', c('barcode')],
          ['brand_name', c('brand')],
          ['category_name', c('category')],
          ['supplier_name', c('supplier')],
          ['quantity', c('quantity')],
          ['gross_sales', c('gross_sales'), fmt],
          ['discount', c('discount'), fmt],
          ['gst', c('gst')],
          ['net_sales', c('net_sales'), fmt],
        ];
      default:
        return [];
    }
  };

  const categoryCols = [
    ['category_name', c('category')],
    ['items_sold', c('items_sold')],
    ['quantity', c('quantity')],
    ['gross_sales', c('gross_sales'), fmt],
    ['discount', c('discount'), fmt],
    ['gst', c('gst')],
    ['net_sales', c('net_sales'), fmt],
  ];
  const subcategoryCols = [
    ['subcategory_name', c('subcategory')],
    ['parent_category_name', c('main_category')],
    ['items_sold', c('items_sold')],
    ['quantity', c('quantity')],
    ['gross_sales', c('gross_sales'), fmt],
    ['discount', c('discount'), fmt],
    ['gst', c('gst')],
    ['net_sales', c('net_sales'), fmt],
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {SALES_REPORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              sub === s.key ? 'bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E]' : 'border border-[#DCE5EF] dark:border-[#22354B]'
            }`}
          >
            {t(`reports.sales_reports_tabs.${s.key}`)}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-sm" />
        <span className="text-sm">{t('reports.to')}</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent px-2 py-1 text-sm" />
        <button onClick={load} className="rounded-md bg-[#0A4174] hover:bg-[#062E52] dark:bg-[#4A8CD2] dark:hover:bg-[#6BA3E0] text-white dark:text-[#0B131E] px-4 py-1.5 font-bold text-xs shadow-sm">{t('reports.apply')}</button>
        <button onClick={resetDates} className="text-xs font-bold text-[#5A6B82] dark:text-[#94A3B8] hover:underline">{t('reports.reset')}</button>

        {config?.searchable && (
          <div className="relative ml-auto w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A6B82]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('reports.search_placeholder')}
              className="w-full pl-8 pr-2 py-1.5 rounded-md border border-[#DCE5EF] dark:border-[#22354B] bg-transparent text-xs"
            />
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-[#5A6B82] dark:text-[#94A3B8]">{t('common.loading')}</div>}

      {!loading && rows && (
        <div className="rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#121E2C] p-4 overflow-x-auto">
          {sub === 'category' ? (
            <>
              <Table
                title={t('reports.sales_reports_tabs.category')}
                subtitle={`${from} ${t('reports.to')} ${to}`}
                filenameBase="category_wise_sales"
                emptyText={t('reports.no_data')}
                rows={rows.by_category || []}
                cols={categoryCols}
                totalKeys={SALES_WISE_TOTAL_KEYS}
              />
              <h3 className="mb-1 mt-5 font-semibold text-sm text-[#0A4174] dark:text-[#4A8CD2]">{t('reports.sales_reports_tabs.subcategory')}</h3>
              <Table
                title={t('reports.sales_reports_tabs.subcategory')}
                subtitle={`${from} ${t('reports.to')} ${to}`}
                filenameBase="subcategory_wise_sales"
                emptyText={t('reports.no_data')}
                rows={rows.by_subcategory || []}
                cols={subcategoryCols}
                totalKeys={SALES_WISE_TOTAL_KEYS}
              />
            </>
          ) : (
            <Table
              title={t(`reports.sales_reports_tabs.${sub}`)}
              subtitle={`${from} ${t('reports.to')} ${to}`}
              filenameBase={`${sub}_wise_sales`}
              emptyText={t('reports.no_data')}
              rows={filteredRows || []}
              cols={colsFor(sub)}
              totalKeys={SALES_WISE_TOTAL_KEYS}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-md p-3 ${highlight ? 'bg-[#E2EDF8] dark:bg-[#1A2A3D]' : 'bg-[#F4F7FB] dark:bg-[#1A2A3D]'}`}>
      <div className="text-xs text-[#5A6B82] dark:text-[#94A3B8]">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

/** Report table with KC Agency-style row-selection: tick rows to export/print
 * just those; otherwise Export/Print act on the full (filtered) data set. */
function Table({ rows, cols, emptyText, title, filenameBase, subtitle, totalKeys = [] }) {
  const { t } = useTranslation();
  const safeRows = Array.isArray(rows)
    ? rows
    : rows && typeof rows === 'object' && Array.isArray(rows.rows)
    ? rows.rows
    : rows && typeof rows === 'object' && Array.isArray(rows.list)
    ? rows.list
    : rows && typeof rows === 'object' && Array.isArray(rows.items)
    ? rows.items
    : [];

  const [selected, setSelected] = useState(() => new Set());
  useEffect(() => setSelected(new Set()), [safeRows]);

  if (!safeRows || safeRows.length === 0) {
    return <div className="py-6 text-center text-sm text-[#5A6B82] dark:text-[#94A3B8]">{emptyText}</div>;
  }

  const allSelected = selected.size > 0 && selected.size === safeRows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(safeRows.map((_, i) => i)));
  const toggleRow = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const exportRows = selected.size > 0 ? safeRows.filter((_, i) => selected.has(i)) : safeRows;
  const activeTotalKeys = totalKeys.filter((k) => cols.some(([key]) => key === k));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        {selected.size > 0 ? (
          <div className="text-xs text-[#0A4174] dark:text-[#4A8CD2] font-semibold">
            {t('reports.selected_banner', { count: selected.size })}{' '}
            <button onClick={() => setSelected(new Set())} className="underline hover:no-underline">{t('reports.clear_selection')}</button>
          </div>
        ) : (
          <div />
        )}
        {filenameBase && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportTableCsv(filenameBase, cols, exportRows)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                selected.size > 0
                  ? 'bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] border-transparent'
                  : 'border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> {t('reports.export_excel')}{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
            <button
              onClick={() => printTable(title, cols, exportRows, subtitle)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                selected.size > 0
                  ? 'bg-[#0A4174] dark:bg-[#4A8CD2] text-white dark:text-[#0B131E] border-transparent'
                  : 'border-[#DCE5EF] dark:border-[#22354B] text-[#5A6B82] dark:text-[#94A3B8] hover:text-[#0A4174] dark:hover:text-[#4A8CD2]'
              }`}
            >
              <Printer className="w-3.5 h-3.5" /> {t('common.print')}{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
        )}
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-[#F4F7FB] dark:bg-[#1A2A3D] text-left">
          <tr>
            <th className="px-2 py-2 w-8">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[#0A4174]" />
            </th>
            {cols.map(([key, label]) => (
              <th key={key} className="px-3 py-2">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeRows.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-[#DCE5EF] dark:border-[#22354B] ${selected.has(i) ? 'bg-[#E2EDF8]/60 dark:bg-[#1A2A3D]/60' : ''}`}
            >
              <td className="px-2 py-2">
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)} className="accent-[#0A4174]" />
              </td>
              {cols.map(([key, _, formatter]) => (
                <td key={key} className="px-3 py-2">{formatter ? formatter(row[key]) : row[key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {activeTotalKeys.length > 0 && (() => {
          const labelColIdx = cols.findIndex(([key]) => !activeTotalKeys.includes(key));
          return (
            <tfoot>
              <tr className="border-t-2 border-[#DCE5EF] dark:border-[#22354B] font-bold bg-[#F4F7FB] dark:bg-[#1A2A3D]">
                <td className="px-2 py-2" />
                {cols.map(([key, , formatter], idx) => {
                  if (activeTotalKeys.includes(key)) {
                    const sum = exportRows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
                    return <td key={key} className="px-3 py-2">{formatter ? formatter(sum) : sum}</td>;
                  }
                  return (
                    <td key={key} className="px-3 py-2">
                      {idx === labelColIdx ? (selected.size > 0 ? t('reports.total_selected', { count: selected.size }) : t('reports.grand_total')) : ''}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          );
        })()}
      </table>
    </div>
  );
}
