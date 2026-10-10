import { HttpError } from '../../shared/records.js';
export function assertRefundUnlocked(data, action, user) {
  const args = action.args || {};
  const member = data.members.find((m) => m.userId === user.id);
  if (
    member?.refundPending &&
    (action.type === 'membership.demo-dues' || (action.type === 'orders' && args.joinMembership))
  )
    throw new HttpError(
      409,
      'Membership refund is processing. Check its status before purchasing membership again.',
    );
  const ticket =
    ['check-in', 'tickets.cancel'].includes(action.type) &&
    data.tickets.find((t) => t.id === args.ticketId);
  const order = action.type === 'orders.update' && data.orders.find((o) => o.id === args.orderId);
  if (ticket?.refundPending || order?.refundPending)
    throw new HttpError(409, 'This purchase is locked while its refund is processing.');
  if (
    action.type === 'products.delete' &&
    data.orders.some((o) => o.productId === args.productId && o.refundPending)
  )
    throw new HttpError(409, 'Wait for pending refunds before deleting this product.');
}
