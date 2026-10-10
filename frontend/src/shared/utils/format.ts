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
      .map((row) => row.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(','))
      .join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const pdfEscape = (value: string) =>
  String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Minimal single-page PDF invoice (no external library). */
export function exportInvoicePdf(
  filename: string,
  invoice: {
    title?: string;
    reference: string;
    customer: string;
    email?: string;
    lines: { label: string; value: string }[];
    total: string;
    note?: string;
  },
) {
  const title = invoice.title || 'Skyline invoice';
  const rows = [
    title,
    `Reference: ${invoice.reference}`,
    `Customer: ${invoice.customer}`,
    ...(invoice.email ? [`Email: ${invoice.email}`] : []),
    `Date: ${date(today)}`,
    '',
    ...invoice.lines.map((line) => `${line.label}: ${line.value}`),
    '',
    `Total: ${invoice.total}`,
    invoice.note || 'Demo payment — no money charged.',
  ];
  const contentLines = ['BT', '/F1 14 Tf', '50 780 Td', '16 TL'];
  rows.forEach((row, index) => {
    if (index === 0) contentLines.push(`/F1 18 Tf (${pdfEscape(row)}) Tj`, 'T*', '/F1 12 Tf');
    else contentLines.push(`(${pdfEscape(row)}) Tj`, 'T*');
  });
  contentLines.push('ET');
  const stream = contentLines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
