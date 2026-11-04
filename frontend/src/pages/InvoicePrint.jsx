import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../config/api';
import { formatCurrency } from '../utils/currency';
import { Printer } from 'lucide-react';

export default function InvoicePrint() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/invoices/${id}/print`).then(({ data }) => setData(data));
  }, [id]);

  if (!data) return <div className="p-8 text-center text-sm font-medium text-[#716B7C] dark:text-[#B8B0C4]">{t('common.loading')}</div>;
  const { invoice, settings } = data;
  const currency = settings?.currency_symbol || '₹';

  return (
    <div className="min-h-screen bg-[#F7F5FC] dark:bg-[#17151D] py-10 px-4 font-sans">
      <div className="mx-auto max-w-sm bg-white p-6 rounded-2xl shadow-lg border border-[#E8E3EF] font-mono text-sm text-[#282431]">
        <h2 className="text-center text-lg font-bold tracking-tight">{settings.company_name}</h2>
        <div className="text-center text-xs text-[#716B7C]">{settings.company_address}</div>
        <hr className="my-3 border-dashed border-[#E8E3EF]" />
        <div className="text-xs text-[#716B7C]">{t('receipt.invoice_label')}: <span className="font-bold text-[#282431]">{invoice.invoice_no}</span></div>
        <div className="text-xs text-[#716B7C]">{t('common.date')}: {new Date(invoice.created_at).toLocaleString()}</div>
        {invoice.customer_name && <div className="text-xs text-[#716B7C]">{t('pos.customer')}: <span className="font-semibold text-[#282431]">{invoice.customer_name}</span></div>}
        <hr className="my-3 border-dashed border-[#E8E3EF]" />
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#E8E3EF] pb-1"><th className="text-left py-1">{t('receipt.item')}</th><th className="py-1">{t('pos.qty')}</th><th className="text-right py-1">{t('pos.price')}</th><th className="text-right py-1">{t('common.total')}</th></tr>
          </thead>
          <tbody className="divide-y divide-[#E8E3EF]/50">
            {invoice.items.map((it) => (
              <tr key={it.id}>
                <td className="py-1.5">{it.product_name_snapshot}</td>
                <td className="text-center py-1.5">{it.qty}</td>
                <td className="text-right py-1.5">{formatCurrency(it.unit_price, currency)}</td>
                <td className="text-right font-bold py-1.5">{formatCurrency(it.line_total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="my-3 border-dashed border-[#E8E3EF]" />
        <div className="flex justify-between font-black text-base pt-1">
          <span>{t('pos.grand_total')}</span>
          <span className="text-[#7652B5]">{formatCurrency(invoice.grand_total, currency)}</span>
        </div>
        <button
          onClick={() => window.print()}
          className="mt-6 w-full rounded-xl bg-[#7652B5] hover:bg-[#5B3B91] py-2.5 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors print:hidden"
        >
          <Printer className="w-4 h-4" />
          <span>{t('common.print')}</span>
        </button>
      </div>
    </div>
  );
}
