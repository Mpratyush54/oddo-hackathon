import { cloudMode } from '../api/client';

export const today = cloudMode
  ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  : '2026-10-10';

export const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

/** ASCII money for Helvetica PDFs (avoids broken ₹ glyphs). */
export const moneyPdf = (value: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;

const pdfEscape = (value: string) =>
  String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Helvetica Type1 only supports WinAnsi; strip/replace unsupported glyphs. */
const pdfText = (value: string) =>
  pdfEscape(
    String(value)
      .replace(/₹/g, 'Rs. ')
      .replace(/[—–−]/g, '-')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/…/g, '...')
      .replace(/·/g, '-')
      .replace(/[^\x20-\x7E]/g, ''),
  );

const pdfTextCmd = (x: number, y: number, size: number, text: string, font = 'F1') =>
  `BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`;

export type InvoiceLineItem = {
  description: string;
  detail?: string;
  quantity?: number | string;
  amount: string;
};

/** Single-page PDF invoice with layout (no external library). */
export function exportInvoicePdf(
  filename: string,
  invoice: {
    brand?: string;
    title?: string;
    reference: string;
    customer: string;
    email?: string;
    date?: string;
    items?: InvoiceLineItem[];
    /** Legacy key/value rows shown under the items table. */
    lines?: { label: string; value: string }[];
    total: string;
    note?: string;
  },
) {
  const brand = invoice.brand || 'Skyline';
  const docTitle = invoice.title?.toLowerCase().includes('ticket')
    ? 'TICKET INVOICE'
    : 'TAX INVOICE';
  const issued = invoice.date || date(today);
  const note = (invoice.note || 'Demo payment - no money charged.').replace(/[—–]/g, '-');
  const total = String(invoice.total).replace(/₹/g, 'Rs. ');

  let items = invoice.items || [];
  if (!items.length && invoice.lines?.length) {
    const byLabel = Object.fromEntries(
      invoice.lines.map((line) => [line.label.toLowerCase(), line.value]),
    );
    const description = byLabel.item || byLabel.description || 'Order item';
    const detail = [
      byLabel.size && `Size: ${byLabel.size}`,
      byLabel.quantity && `Qty: ${byLabel.quantity}`,
    ]
      .filter(Boolean)
      .join('  |  ');
    items = [
      {
        description,
        detail: detail || undefined,
        quantity: byLabel.quantity || '1',
        amount: total,
      },
    ];
  }
  if (!items.length) {
    items = [{ description: 'Order', quantity: '1', amount: total }];
  }

  const meta = (invoice.lines || []).filter(
    (line) =>
      !['item', 'description', 'size', 'quantity', 'qty', 'payment'].includes(
        line.label.toLowerCase(),
      ),
  );

  const ops: string[] = [];
  // Header band
  ops.push('0.145 0.255 0.196 rg', '36 732 540 36 re', 'f');
  ops.push('1 1 1 rg');
  ops.push(pdfTextCmd(48, 744, 16, brand.toUpperCase(), 'F2'));
  ops.push(pdfTextCmd(420, 746, 11, docTitle, 'F2'));

  // Accent rule
  ops.push('0.145 0.255 0.196 rg', '36 724 540 1.5 re', 'f');

  // Bill to
  ops.push('0.35 0.4 0.36 rg');
  ops.push(pdfTextCmd(48, 698, 9, 'BILL TO'));
  ops.push('0.12 0.16 0.14 rg');
  ops.push(pdfTextCmd(48, 682, 12, invoice.customer, 'F2'));
  if (invoice.email) ops.push(pdfTextCmd(48, 666, 10, invoice.email));

  // Invoice meta (right)
  ops.push('0.35 0.4 0.36 rg');
  ops.push(pdfTextCmd(360, 698, 9, 'INVOICE DETAILS'));
  ops.push('0.12 0.16 0.14 rg');
  ops.push(pdfTextCmd(360, 682, 10, `No.  ${invoice.reference}`, 'F2'));
  ops.push(pdfTextCmd(360, 666, 10, `Date ${issued}`));

  // Table header
  const tableTop = 620;
  ops.push('0.93 0.95 0.92 rg', `36 ${tableTop - 4} 540 22 re`, 'f');
  ops.push('0.12 0.16 0.14 rg');
  ops.push(pdfTextCmd(48, tableTop + 2, 9, 'DESCRIPTION', 'F2'));
  ops.push(pdfTextCmd(360, tableTop + 2, 9, 'QTY', 'F2'));
  ops.push(pdfTextCmd(480, tableTop + 2, 9, 'AMOUNT', 'F2'));

  let y = tableTop - 28;
  items.forEach((item, index) => {
    if (index > 0) {
      ops.push('0.88 0.9 0.87 RG', '0.5 w', `36 ${y + 18} m`, `576 ${y + 18} l`, 'S');
    }
    ops.push('0.12 0.16 0.14 rg');
    ops.push(pdfTextCmd(48, y, 11, item.description, 'F2'));
    if (item.detail) {
      ops.push('0.4 0.45 0.4 rg');
      ops.push(pdfTextCmd(48, y - 14, 9, item.detail));
    }
    ops.push('0.12 0.16 0.14 rg');
    ops.push(pdfTextCmd(360, y, 11, String(item.quantity ?? 1)));
    ops.push(pdfTextCmd(460, y, 11, String(item.amount).replace(/₹/g, 'Rs. ')));
    y -= item.detail ? 40 : 28;
  });

  // Divider under items
  ops.push('0.145 0.255 0.196 RG', '1 w', `36 ${y + 10} m`, `576 ${y + 10} l`, 'S');

  // Extra meta rows (status, promo, etc.)
  if (meta.length) {
    y -= 8;
    meta.forEach((row) => {
      ops.push('0.4 0.45 0.4 rg');
      ops.push(pdfTextCmd(48, y, 9, `${row.label}`));
      ops.push('0.12 0.16 0.14 rg');
      ops.push(pdfTextCmd(140, y, 9, row.value));
      y -= 16;
    });
  }

  // Total box
  y -= 12;
  ops.push('0.93 0.95 0.92 rg', `340 ${y - 10} 236 34 re`, 'f');
  ops.push('0.12 0.16 0.14 rg');
  ops.push(pdfTextCmd(352, y + 4, 10, 'TOTAL DUE', 'F2'));
  ops.push(pdfTextCmd(460, y + 4, 13, total, 'F2'));

  // Payment / note
  y -= 40;
  ops.push('0.35 0.4 0.36 rg');
  ops.push(pdfTextCmd(48, y, 9, 'PAYMENT'));
  ops.push('0.12 0.16 0.14 rg');
  ops.push(pdfTextCmd(48, y - 16, 10, note));

  // Footer
  ops.push('0.88 0.9 0.87 RG', '0.5 w', '36 72 m', '576 72 l', 'S');
  ops.push('0.45 0.5 0.45 rg');
  ops.push(pdfTextCmd(48, 52, 8, `${brand} campus commerce  |  Generated for your records`));
  ops.push(pdfTextCmd(48, 38, 8, 'This is a computer-generated invoice. No signature required.'));

  const stream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
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
