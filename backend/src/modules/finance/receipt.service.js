import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { HttpError } from '../../shared/records.js';

export function createReceiptService({ env, s3 }) {
  async function checkReceipt(clubId, user, key) {
    if (typeof key !== 'string' || !key.startsWith(`skyline-campus/${clubId}/${user.id}/`))
      throw new HttpError(403, 'Invalid receipt owner.');
    let object;
    try {
      object = await s3.send(new HeadObjectCommand({ Bucket: env.RECEIPTS_BUCKET, Key: key }));
    } catch {
      throw new HttpError(400, 'Upload the receipt before submitting your expense.');
    }
    if (
      !['application/pdf', 'image/jpeg', 'image/png'].includes(object.ContentType) ||
      object.ContentLength < 1 ||
      object.ContentLength > 5 * 1024 * 1024
    )
      throw new HttpError(400, 'Invalid receipt type or size.');
  }
  return { checkReceipt };
}
