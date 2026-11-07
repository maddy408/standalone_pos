/** Lightweight client-side CSV export + print-window helpers for report
 * tables — no server endpoint or extra dependency needed. `cols` follows
 * the same [key, label, formatter?] shape used by Reports.jsx's <Table>. */

function csvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTableCsv(filename, cols, rows) {
  const header = cols.map(([, label]) => csvCell(label)).join(',');
  const lines = (rows || []).map((row) =>
    cols.map(([key, , formatter]) => csvCell(formatter ? formatter(row[key]) : row[key])).join(',')
  );
  const csv = '﻿' + [header, ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printTable(title, cols, rows, subtitle) {
  const headerRow = cols.map(([, label]) => `<th>${label}</th>`).join('');
  const bodyRows = (rows || [])
    .map(
      (row) =>
        `<tr>${cols.map(([key, , formatter]) => `<td>${formatter ? formatter(row[key]) : row[key] ?? ''}</td>`).join('')}</tr>`
    )
    .join('');

  const html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        h2 { margin: 0 0 2px; }
        .subtitle { color: #5A6B82; font-size: 12px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #DCE5EF; padding: 6px 8px; text-align: left; }
        th { background: #F4F7FB; }
      </style>
    </head>
    <body>
      <h2>${title}</h2>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
      <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <script>window.onload = () => { window.print(); };</script>
    </body>
    </html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
