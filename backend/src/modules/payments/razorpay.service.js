import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../../shared/records.js';

export function validSignature(body, signature, secret) {
  if (
    !secret ||
    typeof signature !== 'string' ||
    signature.length !== 64 ||
    Buffer.byteLength(signature) !== 64
  )
    return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export class RazorpayService {
  constructor({ env, fetchImpl = fetch }) {
    this.env = env;
    this.fetchImpl = fetchImpl;
  }
  assertConfigured() {
    if (
      !this.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') ||
      !this.env.RAZORPAY_KEY_SECRET ||
      !this.env.RAZORPAY_WEBHOOK_SECRET
    )
      throw new HttpError(503, 'Razorpay test payments are not configured.');
  }
  async request(path, body) {
    this.assertConfigured();
    let response;
    try {
      response = await this.fetchImpl('https://api.razorpay.com/v1/' + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(this.env.RAZORPAY_KEY_ID + ':' + this.env.RAZORPAY_KEY_SECRET).toString(
              'base64',
            ),
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new HttpError(
        503,
        'Payment provider unavailable. Check your payment status before retrying.',
      );
    }
    if (!response.ok) throw new HttpError(502, 'Razorpay could not process this request.');
    return response.json();
  }
  createOrder(amount, receipt) {
    return this.request('orders', { amount, currency: 'INR', receipt });
  }
  fetchPayment(id) {
    return this.request('payments/' + encodeURIComponent(id));
  }
  orderPayments(id) {
    return this.request('orders/' + encodeURIComponent(id) + '/payments');
  }
  refund(paymentId, amount, receipt) {
    return this.request('payments/' + encodeURIComponent(paymentId) + '/refund', {
      amount,
      receipt,
      notes: { reason: 'Checkout availability or price changed' },
    });
  }
}
