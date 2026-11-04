import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';

const REPORT_TABS = [
  'sales', 'purchases', 'profit_loss', 'inventory', 'stock_adjustments',
  'expenses', 'income', 'tax', 'customers', 'suppliers', 'payments',
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
};

export default function Reports() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [tab, setTab] = useState('sales');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const currency = settings?.currency_symbol || '₹';

  const needsDateRange = !['inventory', 'customers', 'suppliers'].includes(tab);
  // Reports that break figures down per product must stay scoped to the
  // shop's active business type, same as the Products/POS/Inventory
  // screens — whole-business financial reports (profit/loss, expenses,
  // income, customers, suppliers, payments) deliberately stay unscoped
  // since an invoice/expense/payment isn't itself tied to one business type.
  const PRODUCT_SCOPED_TABS = ['sales', 'inventory', 'stock_adjustments', 'tax'];

  const load = () => {
    setLoading(true);
    const params = needsDateRange ? { from, to } : {};
    if (PRODUCT_SCOPED_TABS.includes(tab) && settings?.business_type) {
      params.business_type = settings.business_type;
    }
    api
      .get(`/reports/${API_PATH[tab] || tab}`, { params })
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, settings?.business_type]);

  const fmt = (n) => `${currency}${Number(n || 0).toFixed(2)}`;
  const c = (key) => t(`reports.cols.${key}`);

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold">{t('reports.title')}</h1>

      <div className="mb-3 flex flex-wrap gap-1">
        {REPORT_TABS.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === key ? 'bg-brand-600 text-white' : 'border border-slate-300 dark:border-slate-600'
            }`}
          >
            {t(`reports.tabs.${key}`)}
          </button>
        ))}
      </div>

      {needsDateRange && (
        <div className="mb-3 flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm" />
          <span className="text-sm">{t('reports.to')}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm" />
          <button onClick={load} className="rounded-md bg-brand-600 px-3 py-1 text-white text-sm">{t('reports.apply')}</button>
        </div>
      )}

      {loading && <div className="text-sm text-slate-400">{t('common.loading')}</div>}

      {!loading && data && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 overflow-x-auto">
          {tab === 'sales' && (
            <>
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label={t('reports.stats.invoices')} value={data.totals.invoice_count} />
                <Stat label={t('reports.stats.subtotal')} value={fmt(data.totals.subtotal)} />
                <Stat label={t('reports.stats.tax')} value={fmt(data.totals.tax)} />
                <Stat label={t('reports.stats.grand_total')} value={fmt(data.totals.grand_total)} />
              </div>
              <h3 className="mb-1 font-medium text-sm">{t('reports.by_day')}</h3>
              <Table
                emptyText={t('reports.no_data')}
                rows={data.by_day}
                cols={[
                  ['day', c('date')],
                  ['invoice_count', c('invoices')],
                  ['total', c('total'), fmt],
                ]}
              />
              <h3 className="mb-1 mt-4 font-medium text-sm">{t('reports.by_product')}</h3>
              <Table
                emptyText={t('reports.no_data')}
                rows={data.by_product}
                cols={[
                  ['product_name', c('product')],
                  ['qty_sold', c('qty_sold')],
                  ['total', c('total'), fmt],
                ]}
              />
            </>
          )}

          {tab === 'purchases' && (
            <>
              <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label={t('reports.stats.purchases')} value={data.totals.purchase_count} />
                <Stat label={t('reports.stats.grand_total')} value={fmt(data.totals.grand_total)} />
                <Stat label={t('reports.stats.paid')} value={fmt(data.totals.paid_amount)} />
                <Stat label={t('reports.stats.balance')} value={fmt(data.totals.balance_amount)} />
              </div>
              <Table
                emptyText={t('reports.no_data')}
                rows={data.list}
                cols={[
                  ['purchase_no', c('purchase_no')],
                  ['supplier_name', c('supplier')],
                  ['grand_total', c('total'), fmt],
                  ['balance_amount', c('balance'), fmt],
                ]}
              />
            </>
          )}

          {tab === 'profit_loss' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Stat label={t('reports.stats.revenue')} value={fmt(data.revenue)} />
              <Stat label={t('reports.stats.cost_of_goods')} value={fmt(data.cost_of_goods)} />
              <Stat label={t('reports.stats.gross_profit')} value={fmt(data.gross_profit)} />
              <Stat label={t('reports.stats.other_income')} value={fmt(data.other_income)} />
              <Stat label={t('reports.stats.expenses')} value={fmt(data.expenses)} />
              <Stat label={t('reports.stats.net_profit')} value={fmt(data.net_profit)} highlight />
            </div>
          )}

          {tab === 'inventory' && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <Stat label={t('reports.stats.stock_value_cost')} value={fmt(data.total_value_at_cost)} />
                <Stat label={t('reports.stats.stock_value_price')} value={fmt(data.total_value_at_price)} />
              </div>
              <Table
                emptyText={t('reports.no_data')}
                rows={data.items}
                cols={[
                  ['name', c('product')],
                  ['business_type', c('type')],
                  ['stock_qty', c('stock')],
                  ['stock_value_at_cost', c('value_cost'), fmt],
                ]}
              />
            </>
          )}

          {tab === 'stock_adjustments' && (
            <Table
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['product_name', c('product')],
                ['qty_change', c('qty_change')],
                ['notes', c('reason')],
                ['user_name', c('by')],
                ['created_at', c('date')],
              ]}
            />
          )}

          {(tab === 'expenses' || tab === 'income') && (
            <Table
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['category_name', c('category')],
                ['count', c('count')],
                ['total', c('total'), fmt],
              ]}
            />
          )}

          {tab === 'tax' && (
            <Table
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['tax_name', c('tax_name')],
                ['percent', c('percent')],
                ['taxable_sales', c('taxable_sales'), fmt],
                ['tax_collected', c('tax_collected'), fmt],
              ]}
            />
          )}

          {tab === 'customers' && (
            <Table
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['name', c('customer')],
                ['phone', c('phone')],
                ['balance', c('outstanding'), fmt],
                ['lifetime_sales', c('lifetime_sales'), fmt],
              ]}
            />
          )}

          {tab === 'suppliers' && (
            <Table
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['name', c('supplier')],
                ['phone', c('phone')],
                ['balance', c('outstanding'), fmt],
                ['lifetime_purchases', c('lifetime_purchases'), fmt],
              ]}
            />
          )}

          {tab === 'payments' && (
            <Table
              emptyText={t('reports.no_data')}
              rows={data}
              cols={[
                ['method_name', c('method')],
                ['count', c('count')],
                ['total', c('total'), fmt],
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-md p-3 ${highlight ? 'bg-brand-50 dark:bg-brand-900/30' : 'bg-slate-50 dark:bg-slate-800'}`}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function Table({ rows, cols, emptyText }) {
  if (!rows || rows.length === 0) {
    return <div className="py-6 text-center text-sm text-slate-400">{emptyText}</div>;
  }
  return (
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50 dark:bg-slate-800 text-left">
        <tr>
          {cols.map(([key, label]) => (
            <th key={key} className="px-3 py-2">{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
            {cols.map(([key, _, formatter]) => (
              <td key={key} className="px-3 py-2">{formatter ? formatter(row[key]) : row[key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
