import { backendPost, backendRequest } from '../../../shared/api/client';
import type { Store } from '../../../shared/types/domain';

type PaymentReply = {
  status: string;
  key?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  state: Store;
};
type CheckoutConstructor = new (options: Record<string, unknown>) => { open(): void };
declare global {
  interface Window {
    Razorpay?: CheckoutConstructor;
  }
}
let loading: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => {
        script.remove();
        reject(new Error('Razorpay checkout could not load. Please retry.'));
      }, 15000);
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Razorpay checkout could not load.'));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}

/** Keep an unfinished checkout key across reloads; retrying must not issue another order. */
export async function razorpayCheckout<T extends { state: Store }>(
  clubId: string,
  action: { type: string; args: object },
  user: { id: string; name: string; email: string },
): Promise<T> {
  const storageKey =
    'skyline-test-checkout:' + user.id + ':' + clubId + ':' + JSON.stringify(action);
  const idempotencyKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
  sessionStorage.setItem(storageKey, idempotencyKey);
  const finish = (reply: PaymentReply) => {
    if (reply.status !== 'Fulfilled') {
      if (reply.status === 'Refunded') sessionStorage.removeItem(storageKey);
      throw new Error(
        reply.status === 'Refunded'
          ? 'Availability or price changed. Your test payment was refunded.'
          : reply.status === 'RefundPending'
            ? 'Your test payment needs refund review. Contact the club administrator.'
            : 'Payment confirmation is pending. Retry this checkout to check its status.',
      );
    }
    sessionStorage.removeItem(storageKey);
    window.dispatchEvent(new Event('skyline-data-changed'));
    return reply as unknown as T;
  };
  let order = await backendPost<PaymentReply>('/payments/orders', {
    clubId,
    action,
    idempotencyKey,
  });
  if (order.status === 'Fulfilled') return finish(order);
  if (order.status !== 'Created' || !order.orderId) return finish(order);
  order = await backendRequest<PaymentReply>('/payments/' + encodeURIComponent(idempotencyKey));
  if (order.status !== 'Created') return finish(order);
  await loadCheckout();
  return new Promise<T>((resolve, reject) => {
    let submitted = false;
    const checkout = new window.Razorpay!({
      key: order.key,
      order_id: order.orderId,
      amount: order.amount,
      currency: 'INR',
      name: 'Skyline · Test payment',
      description: 'Test mode — no real money is charged',
      prefill: { name: user.name, email: user.email },
      theme: { color: '#0f6b66' },
      modal: {
        ondismiss: () => {
          if (!submitted)
            reject(new Error('Test checkout closed. No purchase has been confirmed.'));
        },
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        submitted = true;
        try {
          let reply = await backendPost<PaymentReply>('/payments/verify', {
            idempotencyKey,
            ...response,
          });
          for (let attempt = 0; reply.status === 'Created' && attempt < 5; attempt++) {
            await new Promise((done) => setTimeout(done, 1500));
            reply = await backendRequest<PaymentReply>(
              '/payments/' + encodeURIComponent(idempotencyKey),
            );
          }
          resolve(finish(reply));
        } catch (error) {
          reject(error);
        }
      },
    });
    checkout.open();
  });
}
