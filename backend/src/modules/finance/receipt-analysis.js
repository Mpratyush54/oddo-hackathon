import { z } from 'zod';
import { dateToday } from '../../shared/records.js';

// Accept Indian/Western thousands separators, but never silently ignore other text or multiple decimal points.
export function parseReceiptAmount(text) {
  if (typeof text !== 'string') return undefined;
  let value = text.trim();
  for (const prefix of ['INR', 'Rs.', 'Rs', '₹'])
    if (value.startsWith(prefix)) value = value.slice(prefix.length).trim();
  value = value.replaceAll(' ', '');
  const groups = value.split('.')[0].split(',');
  if (groups.length > 1) {
    const tail = groups.slice(1);
    const western = tail.every((group) => group.length === 3);
    const indian =
      tail.at(-1).length === 3 && tail.slice(0, -1).every((group) => group.length === 2);
    if (groups[0].length < 1 || groups[0].length > 3 || (!western && !indian)) return undefined;
  }
  value = value.replaceAll(',', '');
  const parts = value.split('.');
  const digits = (part) => part.length > 0 && [...part].every((char) => char >= '0' && char <= '9');
  if (
    parts.length > 2 ||
    !digits(parts[0]) ||
    (parts.length === 2 && (!digits(parts[1]) || parts[1].length > 2))
  )
    return undefined;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : undefined;
}

function invoiceDate(text) {
  if (!text) return undefined;
  const value = text.trim();
  if (z.iso.date().safeParse(value).success) return value;
  const parts = value.replaceAll('/', '-').replaceAll('.', '-').split('-');
  if (
    parts.length === 3 &&
    parts[2].length === 4 &&
    parts.every((part) => [...part].every((char) => char >= '0' && char <= '9'))
  ) {
    const iso = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    if (z.iso.date().safeParse(iso).success) return iso;
  }
  // Month names are unambiguous; do not guess unfamiliar numeric date formats.
  if ([...value.toLowerCase()].some((char) => char >= 'a' && char <= 'z')) {
    const milliseconds = Date.parse(value);
    if (Number.isFinite(milliseconds)) return new Date(milliseconds).toISOString().slice(0, 10);
  }
}

export function analyzeReceipt(documents, claimedAmount, partial = false) {
  const issues = [];
  const groups = new Map();
  for (const document of documents) {
    const key = document.ExpenseIndex || 1;
    groups.set(key, [...(groups.get(key) || []), ...(document.SummaryFields || [])]);
  }
  if (groups.size !== 1) issues.push('Upload one receipt per expense request.');
  const fields = [...groups.values()].flat();
  const field = (name) =>
    fields
      .filter((value) => value.Type?.Text === name)
      .sort((a, b) => (b.ValueDetection?.Confidence || 0) - (a.ValueDetection?.Confidence || 0))[0];
  const text = (name) => field(name)?.ValueDetection?.Text?.trim();
  const totalField = field('TOTAL');
  const total = parseReceiptAmount(text('TOTAL'));
  const confidence = totalField?.ValueDetection?.Confidence || 0;
  if (total === undefined) issues.push('The receipt total could not be read.');
  else if (total !== claimedAmount)
    issues.push('The receipt total does not match the claimed amount.');
  if (confidence < 95 || (totalField?.Type?.Confidence || 0) < 90)
    issues.push('The receipt total needs a clearer scan or manual review.');
  const vendor = text('VENDOR_NAME');
  if (!vendor || (field('VENDOR_NAME')?.ValueDetection?.Confidence || 0) < 85)
    issues.push('The vendor could not be read confidently.');
  const dateText = text('INVOICE_RECEIPT_DATE'),
    date = invoiceDate(dateText);
  if (!date || (field('INVOICE_RECEIPT_DATE')?.ValueDetection?.Confidence || 0) < 85)
    issues.push('The receipt date needs manual review.');
  else if (date > dateToday()) issues.push('The receipt date is in the future.');
  const currency = totalField?.Currency?.Code;
  if (currency && currency !== 'INR') issues.push('The receipt currency is not INR.');
  const subtotal = parseReceiptAmount(text('SUBTOTAL'));
  if (subtotal !== undefined && total !== undefined) {
    const extras = ['TAX', 'TIP', 'SHIPPING_HANDLING_CHARGE'].map(
      (name) => parseReceiptAmount(text(name)) || 0,
    );
    const discount = parseReceiptAmount(text('DISCOUNT')) || 0;
    if (Math.abs(subtotal + extras.reduce((sum, value) => sum + value, 0) - discount - total) > 2)
      issues.push('Subtotal, tax and other charges do not match the total.');
  }
  if (partial) issues.push('OCR did not complete for every page.');
  return {
    issues: [...new Set(issues)],
    extracted: {
      total,
      vendor: vendor?.slice(0, 250),
      dateText: dateText?.slice(0, 100),
      invoiceNumber: text('INVOICE_RECEIPT_ID')?.slice(0, 100),
      currency,
      totalConfidence: confidence,
    },
  };
}
