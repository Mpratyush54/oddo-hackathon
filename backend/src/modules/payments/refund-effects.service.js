import { HttpError, dateToday, recordId, timestamp } from '../../shared/records.js';
import { cancelTicket, restoreOrderPoints } from '../commerce/commerce.domain.js';
import { openEvent } from '../../shared/validation.js';

export class RefundEffectsService {
  membership(data, payment) {
    const includesMembership =
      payment.action.type === 'membership.demo-dues' || (payment.result?.membershipFee || 0) > 0;
    if (!includesMembership) return null;
    const member = data.members.find((m) => m.userId === payment.userId);
    if (
      !member ||
      member.duesWaived ||
      (member.membershipPaymentId && member.membershipPaymentId !== payment.paymentId)
    )
      return null;
    return member;
  }
  eligible(data, payment) {
    const tickets = data.tickets.filter((t) => t.paymentId === payment.paymentId);
    const orders = data.orders.filter((o) => o.paymentId === payment.paymentId);
    if (payment.action.type === 'tickets.book' && !tickets.length)
      throw new HttpError(409, 'The paid ticket is unavailable.');
    if (payment.action.type === 'orders' && !orders.length)
      throw new HttpError(409, 'The paid order is unavailable.');
    for (const ticket of tickets) {
      if (ticket.checkedIn || ticket.status === 'Cancelled')
        throw new HttpError(409, 'Checked-in or cancelled tickets cannot be refunded.');
      const event = data.events.find((e) => e.id === ticket.eventId);
      if (!event) throw new HttpError(409, 'Event details are unavailable.');
      openEvent(event);
    }
    if (orders.some((o) => ['Picked up', 'Cancelled'].includes(o.status)))
      throw new HttpError(409, 'Picked-up or cancelled orders cannot be refunded.');
    if (orders.some((o) => !data.products.some((p) => p.id === o.productId)))
      throw new HttpError(409, 'Restore the product listing before refunding its stock.');
    const member = this.membership(data, payment);
    if (member?.refundPending) throw new HttpError(409, 'Another membership refund is processing.');
    if (
      member &&
      (data.tickets.some(
        (t) => t.userId === payment.userId && t.member && t.status !== 'Cancelled',
      ) ||
        data.orders.some(
          (o) =>
            o.userId === payment.userId &&
            o.paymentId !== payment.paymentId &&
            o.status !== 'Cancelled' &&
            o.date >= payment.createdAt.slice(0, 10),
        ))
    )
      throw new HttpError(
        409,
        'Resolve other active member purchases before refunding this membership.',
      );
  }
  lock(data, payment) {
    this.eligible(data, payment);
    for (const row of [...data.tickets, ...data.orders])
      if (row.paymentId === payment.paymentId) row.refundPending = true;
    const member = this.membership(data, payment);
    if (!member) return {};
    const membershipLocked = { status: member.status, expires: member.expires };
    member.refundPending = true;
    member.status = 'Pending';
    return { membershipLocked };
  }
  failed(data, payment, refund) {
    for (const row of [...data.tickets, ...data.orders])
      if (row.paymentId === payment.paymentId) delete row.refundPending;
    const member = data.members.find((m) => m.userId === payment.userId && m.refundPending);
    if (member && refund.membershipLocked) {
      Object.assign(member, refund.membershipLocked);
      delete member.refundPending;
    }
  }
  processed(data, payment, refund) {
    if (!refund.automatic) {
      for (const ticket of data.tickets.filter(
        (t) => t.paymentId === payment.paymentId && t.status !== 'Cancelled',
      )) {
        const oldTransactions = data.transactions;
        const { patch } = cancelTicket(data, {
          ticketId: ticket.id,
          actor: { id: refund.reviewedBy, name: 'Refund processing' },
          today: dateToday(),
        });
        Object.assign(data, patch, { transactions: oldTransactions });
        const updated = data.tickets.find((t) => t.id === ticket.id);
        delete updated.refundPending;
      }
      const orders = data.orders.filter((o) => o.paymentId === payment.paymentId);
      for (const order of orders) {
        if (order.status !== 'Cancelled') {
          const product = data.products.find((p) => p.id === order.productId);
          if (!product)
            throw new HttpError(409, 'Restore the product listing to reconcile the refund.');
          product.stock[order.size] = (product.stock[order.size] || 0) + (order.quantity || 1);
          order.status = 'Cancelled';
        }
        delete order.refundPending;
      }
      const orderIds = new Set(orders.map((o) => o.id));
      const entries = (data.pointLedger || []).filter(
        (entry) =>
          orderIds.has(entry.orderId) &&
          entry.kind === 'contribution' &&
          !entry.reversed &&
          entry.points > 0,
      );
      for (const entry of entries) {
        const member = data.members.find((m) => m.id === entry.memberId);
        if (member)
          member.contributionPoints = Math.max(0, (member.contributionPoints || 0) - entry.points);
        entry.reversed = true;
        data.pointLedger.unshift({
          ...entry,
          id: recordId('PTS'),
          points: -entry.points,
          reversed: false,
          reason: `Refund reversal · ${refund.providerRefundId}`,
          date: dateToday(),
        });
      }
      restoreOrderPoints(
        data,
        [...orderIds],
        `Points returned · refund ${refund.providerRefundId}`,
        dateToday(),
      );
      const member = data.members.find((m) => m.userId === payment.userId && m.refundPending);
      if (member && refund.membershipLocked) {
        delete member.membershipPaymentId;
        Object.assign(
          member,
          payment.membershipBefore || { status: 'Pending', expires: dateToday() },
        );
        delete member.refundPending;
      }
      data.transactions.unshift({
        id: recordId('TX'),
        title: `Razorpay test refund · ${payment.paymentId}`,
        category: 'Refunds',
        amount: -refund.amount / 100,
        date: dateToday(),
        status: 'Completed',
        createdBy: payment.userId,
        reviewedBy: refund.reviewedBy,
        paymentId: payment.paymentId,
        simulated: true,
      });
    }
    data.notifications.unshift({
      id: recordId('NOT'),
      title: 'Test refund processed',
      body: `Your refund of ₹${(refund.amount / 100).toFixed(2)} has been processed. Reference: ${refund.providerRefundId}.`,
      date: timestamp(),
      read: false,
      to: refund.userId,
      userId: refund.userId,
    });
  }
}
