import { z } from 'zod';
import { id, recordKeys, hash256, instant } from './primitives.js';
import { clubPartition } from './club.schema.js';
export const receiptCheckSchema = z.strictObject({
  ...recordKeys,
  pk: clubPartition,
  sk: id.startsWith('RECEIPT#'),
  id,
  clubId: id,
  userId: id,
  sourceKey: id,
  receiptKey: id,
  claimedAmount: z.number().int().positive(),
  status: z.enum(['Uploading', 'Processing', 'Ready', 'NeedsReview', 'Failed', 'Consumed']),
  version: z.number().int().nonnegative(),
  createdAt: instant,
  contentHash: hash256.optional(),
  invoiceFingerprint: hash256.optional(),
  jobId: id.optional(),
  issues: z.array(z.string().max(250)).max(30),
  extracted: z
    .strictObject({
      total: z.number().int().nonnegative().optional(),
      vendor: z.string().max(250).optional(),
      dateText: z.string().max(100).optional(),
      invoiceNumber: z.string().max(100).optional(),
      currency: z.string().max(20).optional(),
      totalConfidence: z.number().min(0).max(100).optional(),
    })
    .optional(),
  clearedBy: id.optional(),
  clearedAt: instant.optional(),
  clearanceReason: z.string().max(500).optional(),
  transactionId: id.optional(),
  consumedAt: instant.optional(),
});
export const receiptUseSchema = z.strictObject({
  ...recordKeys,
  pk: clubPartition,
  sk: id.startsWith('RECEIPT_USE#'),
  receiptId: id,
  transactionId: id,
  createdAt: instant,
});
export const ocrQuotaSchema = z.strictObject({
  schemaVersion: z.literal(1).optional(),
  pk: z.literal('OCR_QUOTA#AZURE_F0'),
  sk: z.string().refine((value) => z.iso.date().safeParse(value + '-01').success),
  version: z.number().int().nonnegative(),
  reservedPages: z.number().int().min(0).max(400),
});
