import i18n from '../i18n';

/** Builds a minimal printable receipt window — used for both a freshly
 * created online invoice and an offline sale that hasn't synced yet. */
export function openReceiptWindow(invoice, settings) {
  const t = i18n.t.bind(i18n);
  const currency = settings?.currency_symbol || '₹';
  const rows = (invoice.items || [])
    .map(
      (it) => `
      <tr>
        <td>${it.product_name_snapshot || it.product_name}</td>
        <td style="text-align:right">${it.qty}</td>
        <td style="text-align:right">${currency}${Number(it.unit_price).toFixed(2)}</td>
        <td style="text-align:right">${currency}${Number(it.line_total || it.unit_price * it.qty).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const sloganHtml = invoice.slogan
    ? `<div style="text-align:center; font-style: italic; margin: 8px 0; font-size: 11px;">"${invoice.slogan}"</div><hr />`
    : '';

  const html = `
    <html>
    <head>
      <title>${invoice.invoice_no}</title>
      <style>
        body { font-family: monospace; width: 320px; margin: 0 auto; padding: 12px; }
        h2 { text-align: center; margin: 0 0 4px; }
        .center { text-align: center; font-size: 12px; }
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
      <div>${t('receipt.invoice_label')}: ${invoice.invoice_no} ${invoice.source === 'offline' ? `(${t('receipt.offline_pending')})` : ''}</div>
      <div>${t('common.date')}: ${new Date(invoice.created_at || Date.now()).toLocaleString()}</div>
      ${invoice.customer_name ? `<div>${t('pos.customer')}: ${invoice.customer_name}</div>` : ''}
      <hr />
      <table>
        <thead><tr><th style="text-align:left">${t('receipt.item')}</th><th>${t('pos.qty')}</th><th>${t('pos.price')}</th><th>${t('common.total')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr />
      <table class="totals">
        <tr><td>${t('pos.subtotal')}</td><td style="text-align:right">${currency}${Number(invoice.subtotal).toFixed(2)}</td></tr>
        <tr><td>${t('pos.discount')}</td><td style="text-align:right">${currency}${Number(invoice.discount_amount || 0).toFixed(2)}</td></tr>
        <tr><td>${t('pos.tax')}</td><td style="text-align:right">${currency}${Number(invoice.tax_amount || 0).toFixed(2)}</td></tr>
        <tr><td>${t('pos.grand_total')}</td><td style="text-align:right">${currency}${Number(invoice.grand_total).toFixed(2)}</td></tr>
      </table>
      <hr />
      ${sloganHtml}
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
