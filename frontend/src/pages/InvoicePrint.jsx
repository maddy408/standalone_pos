import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../config/api';

export default function InvoicePrint() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/invoices/${id}/print`).then(({ data }) => setData(data));
  }, [id]);

  if (!data) return <div className="p-6">{t('common.loading')}</div>;
  const { invoice, settings } = data;
  const currency = settings?.currency_symbol || '₹';

  return (
    <div className="mx-auto max-w-sm bg-white p-4 font-mono text-sm text-black">
      <h2 className="text-center text-lg font-bold">{settings.company_name}</h2>
      <div className="text-center text-xs">{settings.company_address}</div>
      <hr className="my-2 border-dashed" />
      <div>{t('receipt.invoice_label')}: {invoice.invoice_no}</div>
      <div>{t('common.date')}: {new Date(invoice.created_at).toLocaleString()}</div>
      {invoice.customer_name && <div>{t('pos.customer')}: {invoice.customer_name}</div>}
      <hr className="my-2 border-dashed" />
      <table className="w-full text-xs">
        <thead>
          <tr><th className="text-left">{t('receipt.item')}</th><th>{t('pos.qty')}</th><th>{t('pos.price')}</th><th>{t('common.total')}</th></tr>
        </thead>
        <tbody>
          {invoice.items.map((it) => (
            <tr key={it.id}>
              <td>{it.product_name_snapshot}</td>
              <td className="text-right">{it.qty}</td>
              <td className="text-right">{currency}{Number(it.unit_price).toFixed(2)}</td>
              <td className="text-right">{currency}{Number(it.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-2 border-dashed" />
      <div className="flex justify-between font-bold"><span>{t('pos.grand_total')}</span><span>{currency}{Number(invoice.grand_total).toFixed(2)}</span></div>
      <button onClick={() => window.print()} className="mt-4 w-full rounded bg-brand-600 py-2 text-white">{t('common.print')}</button>
    </div>
  );
}
