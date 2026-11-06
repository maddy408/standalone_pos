import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/currency';
import { Printer, Share2, X, Check, Copy } from 'lucide-react';
import { useState } from 'react';

/**
 * InvoicePreviewModal
 * Displays the exact thermal receipt print template in a clean preview modal with:
 * - Print action (triggers window.print or iframe print)
 * - Share action (WhatsApp / Web Share API / Copy text)
 * - Close action
 */
export default function InvoicePreviewModal({ invoice, settings, onClose }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [paperSize, setPaperSize] = useState('thermal'); // 'thermal' | 'a4' | 'a5'
  const currency = settings?.currency_symbol || '₹';

  if (!invoice) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-receipt-template');
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
          <title>${invoice.invoice_no || 'Receipt'}</title>
          <style>
            ${pageCss}
            h2 { text-align: center; margin: 0 0 4px; font-weight: bold; }
            .center { text-align: center; }
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

  const generateReceiptText = () => {
    const lineItems = (invoice.items || [])
      .map((it) => `${it.product_name_snapshot || it.product_name} x ${it.qty} = ${formatCurrency(it.line_total || it.unit_price * it.qty, currency)}`)
      .join('\n');

    return `🧾 *${settings?.company_name || 'Universal POS'}*\n` +
      `${settings?.company_address || ''}\n` +
      `--------------------------------\n` +
      `Invoice: ${invoice.invoice_no}\n` +
      `Date: ${new Date(invoice.created_at || Date.now()).toLocaleString()}\n` +
      `Customer: ${invoice.customer_name || 'Walk-in Customer'}\n` +
      `--------------------------------\n` +
      `${lineItems}\n` +
      `--------------------------------\n` +
      `Subtotal: ${formatCurrency(invoice.subtotal, currency)}\n` +
      (invoice.discount_amount ? `Discount: -${formatCurrency(invoice.discount_amount, currency)}\n` : '') +
      (invoice.tax_amount ? `Tax: ${formatCurrency(invoice.tax_amount, currency)}\n` : '') +
      `*Grand Total: ${formatCurrency(invoice.grand_total, currency)}*\n` +
      `--------------------------------\n` +
      `Thank you for shopping with us!`;
  };

  const handleShare = async () => {
    const text = generateReceiptText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${invoice.invoice_no}`,
          text: text,
        });
        return;
      } catch (err) {
        // Fallback to clipboard if share was cancelled or failed
      }
    }

    // Try WhatsApp web share or copy text
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
              Invoice Preview
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

        {/* Exact Printable Thermal Receipt View */}
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <div
            id="printable-receipt-template"
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
                {t('receipt.invoice_label')}: {invoice.invoice_no}{' '}
                {invoice.source === 'offline' ? `(${t('receipt.offline_pending')})` : ''}
              </div>
              <div>
                {t('common.date')}: {new Date(invoice.created_at || Date.now()).toLocaleString()}
              </div>
              {invoice.customer_name && (
                <div>
                  {t('pos.customer')}: {invoice.customer_name}
                </div>
              )}
            </div>

            <hr className="my-2 border-t border-dashed border-black" />

            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-dashed border-black">
                  <th className="text-left py-1">{t('receipt.item')}</th>
                  <th className="text-right py-1">{t('pos.qty')}</th>
                  <th className="text-right py-1">{t('pos.price')}</th>
                  <th className="text-right py-1">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-neutral-300">
                {(invoice.items || []).map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-1 pr-1 max-w-[120px] truncate">
                      {it.product_name_snapshot || it.product_name}
                    </td>
                    <td className="text-right py-1">{it.qty}</td>
                    <td className="text-right py-1">{formatCurrency(it.unit_price, currency)}</td>
                    <td className="text-right py-1 font-bold">
                      {formatCurrency(it.line_total || it.unit_price * it.qty, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <hr className="my-2 border-t border-dashed border-black" />

            <table className="w-full text-[11px] font-semibold">
              <tbody>
                <tr>
                  <td>{t('pos.subtotal')}</td>
                  <td className="text-right">{formatCurrency(invoice.subtotal, currency)}</td>
                </tr>
                {Number(invoice.discount_amount || 0) > 0 && (
                  <tr>
                    <td>{t('pos.discount')}</td>
                    <td className="text-right">-{formatCurrency(invoice.discount_amount, currency)}</td>
                  </tr>
                )}
                {Number(invoice.tax_amount || 0) > 0 && (
                  <tr>
                    <td>{t('pos.tax')}</td>
                    <td className="text-right">{formatCurrency(invoice.tax_amount, currency)}</td>
                  </tr>
                )}
                <tr className="text-sm font-black border-t border-dashed border-black pt-1">
                  <td className="pt-1">{t('pos.grand_total')}</td>
                  <td className="text-right pt-1">{formatCurrency(invoice.grand_total, currency)}</td>
                </tr>
              </tbody>
            </table>

            {invoice.slogan && (
              <>
                <hr className="my-2 border-t border-dashed border-black" />
                <div className="text-center italic text-[11px]">"{invoice.slogan}"</div>
              </>
            )}

            <hr className="my-2 border-t border-dashed border-black" />
            <div className="text-center text-[11px] font-medium pt-0.5">
              {t('receipt.thank_you')}
            </div>
          </div>
        </div>

        {/* Action Buttons: Print, Share, Close */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="btn-luminous-blue py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{t('common.print')}</span>
            </button>

            {/* Share Button */}
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

          {/* Close Button */}
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
