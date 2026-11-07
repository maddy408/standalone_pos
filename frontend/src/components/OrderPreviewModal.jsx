import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/currency';
import { Printer, Share2, X, Check } from 'lucide-react';
import { useState } from 'react';

export default function OrderPreviewModal({ order, settings, onClose }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [paperSize, setPaperSize] = useState('thermal'); // 'thermal' | 'a4' | 'a5'
  const currency = settings?.currency_symbol || '₹';

  if (!order) return null;

  const items = order.items || [];
  const subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || it.unit_price || 0), 0);
  const gst = items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.rate || it.unit_price || 0) * (Number(it.tax_percent || 0) / 100),
    0
  );
  const estimatedTotal = Number(order.estimated_total ?? order.grand_total ?? (subtotal + gst));

  const handlePrint = () => {
    const printContent = document.getElementById('printable-order-template');
    if (!printContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    let pageCss = '@page { margin: 0; size: 80mm auto; } body { font-family: monospace; width: 300px; margin: 0 auto; padding: 12px; }';
    if (paperSize === 'a4') {
      pageCss = '@page { margin: 15mm; size: A4 portrait; } body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; font-size: 14px; } h2 { font-size: 24px; } table { font-size: 13px; }';
    } else if (paperSize === 'a5') {
      pageCss = '@page { margin: 10mm; size: A5 landscape; } body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: 100%; max-width: 580px; margin: 0 auto; padding: 15px; font-size: 12px; } h2 { font-size: 20px; } table { font-size: 11px; }';
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${order.order_no || 'Order Slip'}</title>
          <style>
            ${pageCss}
            h2 { text-align: center; margin: 0 0 4px; font-weight: bold; }
            .center { text-align: center; }
            .warn { text-align: center; font-weight: bold; font-size: 11px; margin: 6px 0; color: #b45309; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { padding: 4px 2px; }
            .totals td { font-weight: bold; }
            hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  };

  const generateOrderText = () => {
    const lineItems = items
      .map((it) => {
        const rate = Number(it.rate || it.unit_price || 0);
        const qty = Number(it.qty || 0);
        const lineTot = Number(it.line_total ?? (qty * rate * (1 + Number(it.tax_percent || 0) / 100)));
        return `${it.product_name} x ${qty} = ${formatCurrency(lineTot, currency)}`;
      })
      .join('\n');

    return `📋 *Order Pre-Booking: ${order.order_no}*\n` +
      `*${settings?.company_name || 'Universal POS'}*\n` +
      `--------------------------------\n` +
      `Customer: ${order.customer_name || 'Walk-in'}\n` +
      `Status: ${order.status || 'Created'}\n` +
      `Date: ${new Date(order.created_at || Date.now()).toLocaleString()}\n` +
      (order.van_order_no ? `Van Stock: ${order.van_order_no}\n` : '') +
      `--------------------------------\n` +
      `${lineItems}\n` +
      `--------------------------------\n` +
      `Subtotal: ${formatCurrency(subtotal, currency)}\n` +
      (gst > 0 ? `Tax: ${formatCurrency(gst, currency)}\n` : '') +
      `*Estimated Total: ${formatCurrency(estimatedTotal, currency)}*\n` +
      `--------------------------------\n` +
      `*NOTE: This is an order pre-booking confirmation slip, not a tax invoice.*`;
  };

  const handleShare = async () => {
    const text = generateOrderText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order Slip ${order.order_no}`,
          text: text,
        });
        return;
      } catch (err) {
        // Fallback
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="water-glass-card max-w-sm w-full p-5 rounded-3xl relative shadow-2xl space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EF] dark:border-[#22354B]">
          <div>
            <h3 className="font-bold text-sm text-[#1C2736] dark:text-[#F1F5F9]">
              Order Slip Preview
            </h3>
            <span className="text-[10px] text-[#5A6B82] dark:text-[#94A3B8]">
              Format: {paperSize.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[#DCE5EF] dark:border-[#22354B] p-0.5 bg-[#F4F7FB] dark:bg-[#0B131E] text-[10px]">
              {['thermal', 'a4', 'a5'].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPaperSize(size)}
                  className={`px-2 py-0.5 rounded capitalize font-bold transition-all ${
                    paperSize === size
                      ? 'bg-[#0A4174] text-white dark:bg-[#4A8CD2] dark:text-[#0B131E] shadow-2xs'
                      : 'text-[#5A6B82] hover:text-[#1C2736]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-[#5A6B82] hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Template View */}
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <div
            id="printable-order-template"
            className="bg-white text-black p-5 rounded-xl border border-slate-200 font-mono text-xs shadow-inner"
          >
            <h2 className="text-center font-bold text-base mb-1 tracking-tight">
              {settings?.company_name || 'My Business'}
            </h2>
            {settings?.company_address && (
              <div className="text-center text-[11px] text-neutral-600">
                {settings.company_address}
              </div>
            )}
            {settings?.company_phone && (
              <div className="text-center text-[11px] text-neutral-600">
                {settings.company_phone}
              </div>
            )}

            <hr className="my-2 border-t border-dashed border-black" />

            <div className="space-y-0.5 text-[11px]">
              <div>
                <strong>Order #:</strong> {order.order_no}
              </div>
              <div>
                <strong>Date:</strong> {new Date(order.created_at || Date.now()).toLocaleString()}
              </div>
              <div>
                <strong>Customer:</strong> {order.customer_name || 'Walk-in'}
              </div>
              <div>
                <strong>Status:</strong> <span className="capitalize">{order.status || 'Created'}</span>
              </div>
              {order.van_order_no && (
                <div>
                  <strong>Van Stock:</strong> {order.van_order_no}
                </div>
              )}
            </div>

            <hr className="my-2 border-t border-dashed border-black" />
            <div className="text-center font-bold text-[10px] text-amber-700 uppercase tracking-wide">
              *** ORDER PRE-BOOKING SLIP (NOT AN INVOICE) ***
            </div>
            <hr className="my-2 border-t border-dashed border-black" />

            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-dashed border-black">
                  <th className="text-left py-1">Item</th>
                  <th className="text-right py-1">Qty</th>
                  <th className="text-right py-1">Rate</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-neutral-300">
                {items.map((it, idx) => {
                  const rate = Number(it.rate || it.unit_price || 0);
                  const qty = Number(it.qty || 0);
                  const lineTot = Number(it.line_total ?? (qty * rate * (1 + Number(it.tax_percent || 0) / 100)));
                  return (
                    <tr key={idx}>
                      <td className="py-1 pr-1 max-w-[120px] truncate">{it.product_name}</td>
                      <td className="text-right py-1">{qty}</td>
                      <td className="text-right py-1">{formatCurrency(rate, currency)}</td>
                      <td className="text-right py-1 font-bold">{formatCurrency(lineTot, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <hr className="my-2 border-t border-dashed border-black" />

            <table className="w-full text-[11px] font-semibold">
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td className="text-right">{formatCurrency(subtotal, currency)}</td>
                </tr>
                {gst > 0 && (
                  <tr>
                    <td>Tax</td>
                    <td className="text-right">{formatCurrency(gst, currency)}</td>
                  </tr>
                )}
                <tr className="text-sm font-black border-t border-dashed border-black pt-1">
                  <td className="pt-1">Estimated Total</td>
                  <td className="text-right pt-1">{formatCurrency(estimatedTotal, currency)}</td>
                </tr>
              </tbody>
            </table>

            {order.notes && (
              <>
                <hr className="my-2 border-t border-dashed border-black" />
                <div className="text-[11px]">
                  <strong>Notes:</strong> {order.notes}
                </div>
              </>
            )}

            <hr className="my-2 border-t border-dashed border-black" />
            <div className="text-center text-[11px] font-medium pt-0.5">
              Thank you for ordering with us!
            </div>
          </div>
        </div>

        {/* Action Buttons: Print, Share, Close */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-luminous-blue py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{t('common.print')}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="py-2.5 rounded-xl border border-[#DCE5EF] dark:border-[#22354B] bg-white dark:bg-[#1A2A3D] text-[#0A4174] dark:text-[#4A8CD2] hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl text-xs font-semibold text-[#5A6B82] hover:text-[#1C2736] dark:hover:text-[#F1F5F9] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
