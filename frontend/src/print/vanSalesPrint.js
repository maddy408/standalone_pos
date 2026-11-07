import i18n from '../i18n';
import { formatCurrency } from '../utils/currency';

function openPrintWindow(title, bodyHtml) {
  const html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; font-size: 13px; }
        h2 { margin: 0 0 4px; }
        .center { text-align: center; }
        .muted { color: #5A6B82; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #DCE5EF; padding: 5px 7px; text-align: left; }
        th { background: #F4F7FB; }
        td.num, th.num { text-align: right; }
        .totals td { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
        .sig { display: flex; justify-content: space-between; margin-top: 40px; }
      </style>
    </head>
    <body>
      ${bodyHtml}
      <script>window.onload = () => { window.print(); };</script>
    </body>
    </html>`;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export function printVanOrder(order, settings) {
  const t = i18n.t.bind(i18n);
  const currency = settings?.currency_symbol || '₹';
  const rows = (order.items || [])
    .map(
      (it) => `
      <tr>
        <td>${it.product_name}</td>
        <td class="num">${it.qty}</td>
        <td class="num">${formatCurrency(it.unit_price, currency)}</td>
        <td class="num">${formatCurrency(it.discount_amount, currency)}</td>
        <td class="num">${formatCurrency(it.tax_amount, currency)}</td>
        <td class="num">${formatCurrency(it.line_total, currency)}</td>
      </tr>`
    )
    .join('');

  openPrintWindow(order.order_no, `
    <div class="center">
      <h2>${settings?.company_name || 'My Business'}</h2>
      <div class="muted">${settings?.company_address || ''} ${settings?.company_phone || ''}</div>
    </div>
    <hr />
    <table>
      <tr><td><strong>${t('van_sales.order_no')}</strong>: ${order.order_no}</td><td><strong>${t('common.date')}</strong>: ${order.order_date}</td></tr>
      <tr><td><strong>${t('van_sales.vehicle')}</strong>: ${order.vehicle_name}</td><td><strong>${t('common.status')}</strong>: ${order.status}</td></tr>
    </table>
    <table>
      <thead><tr><th>${t('receipt.item')}</th><th class="num">${t('pos.qty')}</th><th class="num">${t('pos.price')}</th><th class="num">${t('pos.discount')}</th><th class="num">${t('pos.tax')}</th><th class="num">${t('common.total')}</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot class="totals">
        <tr><td colspan="5">${t('pos.subtotal')}</td><td class="num">${formatCurrency(order.subtotal, currency)}</td></tr>
        <tr><td colspan="5">${t('pos.discount')}</td><td class="num">${formatCurrency(order.discount_amount, currency)}</td></tr>
        <tr><td colspan="5">${t('pos.tax')}</td><td class="num">${formatCurrency(order.tax_amount, currency)}</td></tr>
        <tr><td colspan="5">${t('pos.grand_total')}</td><td class="num">${formatCurrency(order.grand_total, currency)}</td></tr>
        <tr><td colspan="5">${t('van_sales.paid_amount')}</td><td class="num">${formatCurrency(order.paid_amount, currency)}</td></tr>
      </tfoot>
    </table>
    ${order.notes ? `<p><strong>${t('common.notes')}</strong>: ${order.notes}</p>` : ''}
  `);
}

export function printDayReturn(dayReturn, settings) {
  const t = i18n.t.bind(i18n);
  const currency = settings?.currency_symbol || '₹';
  const rows = (dayReturn.items || [])
    .map(
      (it) => `
      <tr>
        <td>${it.product_name}</td>
        <td class="num">${it.loaded_qty}</td>
        <td class="num">${it.sold_qty}</td>
        <td class="num">${it.returned_qty}</td>
        <td class="num">${it.damaged_qty}</td>
        <td class="num">${it.missing_qty}</td>
      </tr>`
    )
    .join('');

  openPrintWindow(dayReturn.return_no, `
    <div class="center">
      <h2>${settings?.company_name || 'My Business'}</h2>
      <div class="muted">${t('van_sales.day_return')}</div>
    </div>
    <hr />
    <table>
      <tr><td><strong>${t('van_sales.return_no')}</strong>: ${dayReturn.return_no}</td><td><strong>${t('common.date')}</strong>: ${dayReturn.return_date}</td></tr>
      <tr><td><strong>${t('van_sales.vehicle')}</strong>: ${dayReturn.vehicle_name}</td><td><strong>${t('van_sales.order_no')}</strong>: ${dayReturn.order_no}</td></tr>
    </table>
    <table>
      <thead><tr><th>${t('receipt.item')}</th><th class="num">${t('van_sales.loaded_qty')}</th><th class="num">${t('van_sales.sold_qty')}</th><th class="num">${t('van_sales.returned_qty')}</th><th class="num">${t('van_sales.damaged_qty')}</th><th class="num">${t('van_sales.missing_qty')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr />
    <table>
      <tr class="totals"><td>${t('van_sales.total_sold_value')}</td><td class="num">${formatCurrency(dayReturn.total_sold_value, currency)}</td></tr>
      <tr><td>${t('van_sales.total_returned_value')}</td><td class="num">${formatCurrency(dayReturn.total_returned_value, currency)}</td></tr>
      <tr><td>${t('van_sales.total_damaged_value')}</td><td class="num">${formatCurrency(dayReturn.total_damaged_value, currency)}</td></tr>
      <tr><td>${t('van_sales.total_missing_value')}</td><td class="num">${formatCurrency(dayReturn.total_missing_value, currency)}</td></tr>
      <tr><td>${t('van_sales.amount_collected')}</td><td class="num">${formatCurrency(dayReturn.amount_collected, currency)}</td></tr>
      <tr><td>${t('van_sales.credit_amount')}</td><td class="num">${formatCurrency(dayReturn.credit_amount, currency)}</td></tr>
      <tr><td>${t('van_sales.other_adjustment')}</td><td class="num">${formatCurrency(dayReturn.other_adjustment, currency)}</td></tr>
      <tr class="totals"><td>${t('van_sales.outstanding_amount')}</td><td class="num">${formatCurrency(dayReturn.outstanding_amount, currency)}</td></tr>
    </table>
    ${dayReturn.notes ? `<p><strong>${t('common.notes')}</strong>: ${dayReturn.notes}</p>` : ''}
    <div class="sig">
      <div>${t('van_sales.prepared_by')}: ______________________</div>
      <div>${t('van_sales.approved_by')}: ______________________</div>
    </div>
  `);
}

export function printDayClosing(closing, settings) {
  const t = i18n.t.bind(i18n);
  const currency = settings?.currency_symbol || '₹';
  const rows = (closing.day_returns || [])
    .map(
      (r) => `
      <tr>
        <td>${r.order_no}</td>
        <td>${r.return_no}</td>
        <td class="num">${formatCurrency(r.total_sold_value, currency)}</td>
        <td class="num">${formatCurrency(r.amount_collected, currency)}</td>
        <td class="num">${formatCurrency(r.credit_amount, currency)}</td>
        <td class="num">${formatCurrency(r.outstanding_amount, currency)}</td>
      </tr>`
    )
    .join('');

  openPrintWindow(closing.closing_no, `
    <div class="center">
      <h2>${settings?.company_name || 'My Business'}</h2>
      <div class="muted">${t('van_sales.day_closing')}</div>
    </div>
    <hr />
    <table>
      <tr><td><strong>${t('van_sales.closing_no')}</strong>: ${closing.closing_no}</td><td><strong>${t('common.date')}</strong>: ${closing.closing_date}</td></tr>
      <tr><td><strong>${t('van_sales.vehicle')}</strong>: ${closing.vehicle_name}</td><td><strong>${t('common.status')}</strong>: ${closing.status}</td></tr>
    </table>
    <table>
      <thead><tr><th>${t('van_sales.order_no')}</th><th>${t('van_sales.return_no')}</th><th class="num">${t('van_sales.total_sold_value')}</th><th class="num">${t('van_sales.amount_collected')}</th><th class="num">${t('van_sales.credit_amount')}</th><th class="num">${t('van_sales.outstanding_amount')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr />
    <table class="totals">
      <tr><td>${t('van_sales.total_sold_value')}</td><td class="num">${formatCurrency(closing.total_sold_value, currency)}</td></tr>
      <tr><td>${t('van_sales.total_cash_collected')}</td><td class="num">${formatCurrency(closing.total_cash_collected, currency)}</td></tr>
      <tr><td>${t('van_sales.total_credit')}</td><td class="num">${formatCurrency(closing.total_credit, currency)}</td></tr>
      <tr><td>${t('van_sales.amount_difference')}</td><td class="num">${formatCurrency(closing.amount_difference, currency)}</td></tr>
    </table>
    ${closing.override_reason ? `<p><strong>${t('van_sales.override_reason')}</strong>: ${closing.override_reason}</p>` : ''}
  `);
}
