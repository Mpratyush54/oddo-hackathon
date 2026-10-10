import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireRole } from '../clubs/club.service.js';
import { HttpError, recordId } from '../../shared/records.js';
import { receiptUploadSchema } from './finance.schemas.js';
import { parseRequest } from '../../shared/request-validation.js';

export function createFinanceController({ env, domain, s3 }) {
  return {
    createReceiptUpload: async (req, res) => {
      await domain.load(req.params.clubId);
      const { contentType: type } = parseRequest(
        receiptUploadSchema,
        req.body,
        'Upload a PDF, JPEG, or PNG receipt.',
      );
      const key = `skyline-campus/${req.params.clubId}/${req.auth.user.id}/${recordId('RECEIPT')}`;
      const upload = await createPresignedPost(s3, {
        Bucket: env.RECEIPTS_BUCKET,
        Key: key,
        Fields: { 'Content-Type': type },
        Conditions: [
          ['content-length-range', 1, 5 * 1024 * 1024],
          ['eq', '$Content-Type', type],
        ],
        Expires: 300,
      });
      res.json({ ...upload, key });
    },
    downloadReceipt: async (req, res) => {
      const tx = (await domain.load(req.params.clubId)).data.transactions.find(
        (t) => t.id === req.params.transactionId,
      );
      if (!tx?.receiptKey) throw new HttpError(404, 'Receipt not found.');
      if (tx.createdBy !== req.auth.user.id)
        requireRole(await domain.roleFor(req.auth.user, req.params.clubId), ['admin', 'treasurer']);
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: env.RECEIPTS_BUCKET,
          Key: tx.receiptKey,
          ResponseContentDisposition: 'attachment',
        }),
        { expiresIn: 120 },
      );
      res.json({ url });
    },
  };
}
