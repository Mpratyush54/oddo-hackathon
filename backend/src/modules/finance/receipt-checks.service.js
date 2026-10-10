import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { HttpError, clubKey, timestamp } from '../../shared/records.js';
import { requireRole } from '../../shared/authorization.js';
import { parseRequest } from '../../shared/request-validation.js';
import {
  startReceiptCheckSchema,
  receiptClearanceSchema,
  receiptCheckIdSchema,
} from './receipt-checks.schemas.js';
import { analyzeReceipt } from './receipt-analysis.js';
import { AzureOcrService } from './azure-ocr.service.js';
import { createReceiptService } from './receipt.service.js';

const versioned = (item, version) => ({
  item,
  condition: '#version = :version',
  names: { '#version': 'version' },
  values: { ':version': version },
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
export class ReceiptChecksService {
  constructor({ env, repo, domain, s3, ocr, fetchImpl }) {
    Object.assign(this, {
      env,
      repo,
      domain,
      s3,
      ocr: ocr || new AzureOcrService({ env, repo, fetchImpl }),
    });
  }
  async owned(clubId, id, user) {
    parseRequest(receiptCheckIdSchema, id);
    await this.domain.load(clubId);
    const record = await this.repo.get(clubKey(clubId), 'RECEIPT#' + id);
    if (!record) throw new HttpError(404, 'Receipt check not found.');
    if (record.userId !== user.id)
      requireRole(await this.domain.roleFor(user, clubId), ['admin', 'treasurer']);
    return record;
  }
  view(record) {
    const {
      id,
      clubId,
      userId,
      status,
      claimedAmount,
      issues,
      extracted,
      clearedBy,
      clearedAt,
      clearanceReason,
      transactionId,
      createdAt,
    } = record;
    return {
      id,
      clubId,
      userId,
      status,
      claimedAmount,
      issues,
      extracted,
      clearedBy,
      clearedAt,
      clearanceReason,
      transactionId,
      createdAt,
      ...(status === 'Ready' ? { receiptKey: record.receiptKey } : {}),
    };
  }
  async start(clubId, input, user) {
    const { receiptKey, amount } = parseRequest(startReceiptCheckSchema, input);
    await this.domain.load(clubId);
    const id = parseRequest(receiptCheckIdSchema, receiptKey.split('/').at(-1));
    if (receiptKey !== `skyline-campus/${clubId}/${user.id}/${id}`)
      throw new HttpError(403, 'Invalid receipt owner.');
    const pk = clubKey(clubId),
      sk = 'RECEIPT#' + id;
    const existing = await this.repo.get(pk, sk);
    if (existing) {
      if (existing.userId !== user.id || existing.claimedAmount !== Math.round(amount * 100))
        throw new HttpError(409, 'The claimed amount changed. Upload and check a new receipt.');
      return this.view(existing);
    }
    await this.repo.limit('RECEIPT_OCR#' + user.id, 15, 86400);
    await createReceiptService({ env: this.env, s3: this.s3 }).checkReceipt(
      clubId,
      user,
      receiptKey,
    );
    let record = {
      pk,
      sk,
      id,
      clubId,
      userId: user.id,
      sourceKey: receiptKey,
      receiptKey: `skyline-campus/${clubId}/${user.id}/checked/${id}`,
      claimedAmount: Math.round(amount * 100),
      status: 'Uploading',
      version: 0,
      createdAt: timestamp(),
      issues: [],
    };
    if (!(await this.repo.put(record, true))) return this.start(clubId, input, user);
    try {
      const object = await this.s3.send(
        new GetObjectCommand({ Bucket: this.env.RECEIPTS_BUCKET, Key: receiptKey }),
      );
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      const type = object.ContentType;
      const valid =
        type === 'application/pdf'
          ? bytes.subarray(0, 5).toString() === '%PDF-'
          : type === 'image/jpeg'
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : type === 'image/png' &&
              bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (!valid || !bytes.length || bytes.length > 5 * 1024 * 1024)
        throw new HttpError(400, 'The uploaded file does not match a supported receipt format.');
      const contentHash = hash(bytes);
      // Freeze the checked bytes in a key that is never exposed in an upload URL.
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.env.RECEIPTS_BUCKET,
          Key: record.receiptKey,
          Body: bytes,
          ContentType: type,
          IfNoneMatch: '*',
        }),
      );
      record = { ...record, contentHash };
      const duplicate = (await this.repo.list(pk, 'RECEIPT#')).some(
        (other) =>
          other.id !== id &&
          (other.userId !== user.id || other.status === 'Consumed') &&
          other.contentHash === contentHash,
      );
      const jobId = await this.ocr.start({ bytes, contentType: type });
      const processing = {
        ...record,
        jobId,
        status: 'Processing',
        version: 1,
        issues: duplicate ? ['This receipt file has already been uploaded.'] : [],
      };
      if (!(await this.repo.atomic([versioned(processing, 0)])))
        throw new HttpError(409, 'Receipt processing state changed. Refresh its status.');
      return this.view(processing);
    } catch (error) {
      await this.repo.atomic([
        versioned(
          {
            ...record,
            status: 'Failed',
            version: 1,
            issues: [
              'Receipt checking failed. Upload a readable receipt and retry; submission remains blocked.',
            ],
          },
          0,
        ),
      ]);
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'Receipt OCR is unavailable. Your expense has not been submitted.');
    }
  }
  async status(clubId, id, user) {
    const record = await this.owned(clubId, id, user);
    if (record.status !== 'Processing') return this.view(record);
    let result;
    try {
      result = await this.ocr.result(record.jobId);
    } catch {
      throw new HttpError(503, 'Receipt OCR status is unavailable. Submission remains blocked.');
    }
    if (result.status === 'IN_PROGRESS') return this.view(record);
    const analysis =
      result.status === 'FAILED'
        ? { issues: ['OCR failed. Upload a clearer or unlocked receipt.'], extracted: {} }
        : analyzeReceipt(result.documents, record.claimedAmount, result.status !== 'SUCCEEDED');
    const invoiceFingerprint =
      analysis.extracted.vendor && analysis.extracted.invoiceNumber
        ? hash(
            JSON.stringify([
              analysis.extracted.vendor.trim().toLowerCase(),
              analysis.extracted.invoiceNumber.trim().toLowerCase(),
            ]),
          )
        : undefined;
    const prior = await this.repo.list(record.pk, 'RECEIPT#');
    const duplicate = prior.some(
      (other) =>
        other.id !== id &&
        (other.userId !== user.id || other.status === 'Consumed') &&
        ((other.contentHash && other.contentHash === record.contentHash) ||
          (invoiceFingerprint && other.invoiceFingerprint === invoiceFingerprint)),
    );
    const issues = [
      ...new Set([
        ...record.issues,
        ...analysis.issues,
        ...(duplicate ? ['A matching receipt or vendor invoice already exists.'] : []),
      ]),
    ];
    const updated = {
      ...record,
      invoiceFingerprint,
      ...analysis,
      issues,
      status: result.status === 'FAILED' ? 'Failed' : issues.length ? 'NeedsReview' : 'Ready',
      version: record.version + 1,
    };
    await this.repo.atomic([versioned(updated, record.version)]);
    return this.view(await this.repo.get(record.pk, record.sk));
  }
  async list(clubId, user) {
    requireRole(await this.domain.roleFor(user, clubId), ['admin', 'treasurer']);
    await this.domain.load(clubId);
    return {
      receipts: (await this.repo.list(clubKey(clubId), 'RECEIPT#'))
        .filter((record) => record.status === 'NeedsReview')
        .map((record) => this.view(record)),
    };
  }
  async clear(clubId, id, input, user) {
    const { reason } = parseRequest(receiptClearanceSchema, input);
    requireRole(await this.domain.roleFor(user, clubId), ['admin']);
    const record = await this.owned(clubId, id, user);
    if (record.userId === user.id)
      throw new HttpError(403, 'Another administrator must check your receipt.');
    if (record.status !== 'NeedsReview')
      throw new HttpError(409, 'Only flagged receipts can be cleared.');
    if (await this.repo.get(record.pk, 'RECEIPT_USE#' + record.contentHash))
      throw new HttpError(409, 'This receipt was already used for an expense.');
    const updated = {
      ...record,
      status: 'Ready',
      version: record.version + 1,
      clearedBy: user.id,
      clearedAt: timestamp(),
      clearanceReason: reason,
    };
    const audit = {
      pk: record.pk,
      sk: `AUDIT#${updated.clearedAt}#${id}`,
      id: id + '-clearance',
      actor: user.id,
      clubId,
      collegeId: 'skyline-campus',
      action: 'receipts.clear',
      entity: 'receipts',
      entityId: id,
      date: updated.clearedAt,
      detail: reason,
    };
    if (
      !(await this.repo.atomic([
        versioned(updated, record.version),
        { item: audit, condition: 'attribute_not_exists(pk)' },
      ]))
    )
      throw new HttpError(409, 'Receipt status changed. Refresh before clearing it.');
    return this.view(updated);
  }
  async download(clubId, id, user) {
    return (await this.owned(clubId, id, user)).receiptKey;
  }
}
