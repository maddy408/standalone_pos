/**
 * Currency Formatting Utility for Universal POS
 * Ensures correct symbol display (₹) and consistent formatting (e.g. ₹1,820.00, ₹100.00, ₹0.00).
 */

export function getCurrencySymbol(settingsOrSymbol) {
  let sym = typeof settingsOrSymbol === 'string'
    ? settingsOrSymbol
    : settingsOrSymbol?.currency_symbol;

  if (!sym || sym.includes('â') || sym.includes('‚') || sym === 'â‚¹' || sym.includes('?')) {
    return '₹';
  }
  return sym;
}

export function formatCurrency(amount, settingsOrSymbol) {
  const symbol = getCurrencySymbol(settingsOrSymbol);
  const num = Number(amount || 0);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formattedNumber = absNum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}${symbol}${formattedNumber}`;
}

export default formatCurrency;

