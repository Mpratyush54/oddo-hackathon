export const today = '2026-10-10';

export const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

export const date = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Date(value + (value.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(
    'en-GB',
    options || { day: 'numeric', month: 'short', year: 'numeric' },
  );

export const uid = (prefix = 'ID') => `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export function exportCSV(name: string, rows: (string | number | boolean)[][]) {
  const content =
    '\uFEFF' +
    rows
      .map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
