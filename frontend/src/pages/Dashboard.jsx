import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { useSettings } from '../hooks/useSettings';

function Stat({ label, value, note }) {
  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {note && <div className="mt-0.5 text-xs text-emerald-600">{note}</div>}
    </div>
  );
}

/** A negative balance means the party owes us a refund/credit rather than
 * us owing them — show the magnitude with a "credit" note instead of a
 * confusing negative currency amount. */
function balanceDisplay(amount, currency, t) {
  const n = Number(amount ?? 0);
  if (n < 0) {
    return { value: `${currency}${Math.abs(n).toFixed(2)}`, note: t('dashboard.credit_due') };
  }
  return { value: `${currency}${n.toFixed(2)}`, note: null };
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api
      .get('/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary(null));
  }, []);

  const currency = settings?.currency_symbol || '₹';
  const receivable = balanceDisplay(summary?.outstanding_from_customers, currency, t);
  const payable = balanceDisplay(summary?.outstanding_to_suppliers, currency, t);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t('dashboard.title')}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label={t('dashboard.today_sales')} value={`${currency}${(summary?.today_sales_total ?? 0).toFixed(2)}`} />
        <Stat label={t('dashboard.today_invoices')} value={summary?.today_invoice_count ?? 0} />
        <Stat label={t('dashboard.low_stock_items')} value={summary?.low_stock_count ?? 0} />
        <Stat label={t('dashboard.outstanding_from_customers')} value={receivable.value} note={receivable.note} />
        <Stat label={t('dashboard.outstanding_to_suppliers')} value={payable.value} note={payable.note} />
        <Stat label={t('dashboard.total_products')} value={summary?.product_count ?? 0} />
      </div>
    </div>
  );
}
