import i18n from '../i18n';
import { formatCurrency } from '../utils/currency';

/** Non-fiscal "Order / Pre-Booking" slip — mirrors receipt.js's print-window
 * approach but is explicitly NOT an invoice (nothing here has been billed). */
export function openOrderSlipWindow(order, settings) {
  const t = i18n.t.bind(i18n);
  const currency = settings?.currency_symbol || '₹';
  const items = order.items || [];

  const rows = items
    .map((it) => {
      const lineTotal = Number(it.qty) * Number(it.rate) * (1 + Number(it.tax_percent || 0) / 100);
      return `
      <tr>
        <td>${it.product_name}</td>
        <td style="text-align:right">${it.qty}</td>
        <td style="text-align:right">${formatCurrency(it.rate, currency)}</td>
        <td style="text-align:right">${formatCurrency(lineTotal, currency)}</td>
      </tr>`;
    })
    .join('');

  const subtotal = items.reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
  const gst = items.reduce((s, it) => s + Number(it.qty) * Number(it.rate) * (Number(it.tax_percent || 0) / 100), 0);

  const html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>${order.order_no}</title>
      <style>
        body { font-family: monospace; width: 320px; margin: 0 auto; padding: 12px; }
        h2 { text-align: center; margin: 0 0 4px; }
        .center { text-align: center; font-size: 12px; }
        .warn { text-align: center; font-weight: bold; font-size: 11px; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        td, th { padding: 2px 0; }
        .totals td { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #000; }
      </style>
    </head>
    <body>
      <h2>${settings?.company_name || 'My Business'}</h2>
      <div class="center">${settings?.company_address || ''}</div>
      <div class="center">${settings?.company_phone || ''}</div>
      <hr />
      <div>${t('orders.order_no')}: ${order.order_no}</div>
      <div>${t('common.date')}: ${new Date(order.created_at).toLocaleString()}</div>
      <div>${t('orders.customer')}: ${order.customer_name}</div>
      <div>${t('common.status')}: ${order.status}</div>
      <hr />
      <div class="warn">${t('orders.not_an_invoice')}</div>
      <hr />
      <table>
        <thead><tr><th style="text-align:left">${t('receipt.item')}</th><th>${t('pos.qty')}</th><th>${t('pos.price')}</th><th>${t('common.total')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr />
      <table class="totals">
        <tr><td>${t('pos.subtotal')}</td><td style="text-align:right">${formatCurrency(subtotal, currency)}</td></tr>
        <tr><td>${t('pos.tax')}</td><td style="text-align:right">${formatCurrency(gst, currency)}</td></tr>
        <tr><td>${t('orders.estimated_total')}</td><td style="text-align:right">${formatCurrency(subtotal + gst, currency)}</td></tr>
      </table>
      <hr />
      ${order.notes ? `<div>${t('common.notes')}: ${order.notes}</div><hr />` : ''}
      <div class="center">${t('receipt.thank_you')}</div>
      <script>window.onload = () => { window.print(); };</script>
    </body>
    </html>`;

  const win = window.open('', '_blank', 'width=400,height=600');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
