import { HttpError, recordId } from '../../shared/records.js';
import { adjustInventory, awardPoints, placeOrder } from './commerce.service.js';
import { staff, requireRole } from '../../shared/authorization.js';
import { ownMember } from '../../shared/validation.js';

export function handleCommerce({ data, action, user, role, now, context, actor, args }) {
  let result = {};
  switch (action.type) {
    case 'orders': {
      result = placeOrder(data, {
        productId: args.productId,
        size: args.size,
        quantity: args.quantity,
        promoCode: args.promoCode,
        joinMembership: args.joinMembership === true,
        actor,
        today: now,
      });
      result.patch.orders = result.patch.orders.map((o) =>
        result.orders.some((x) => x.id === o.id) ? { ...o, userId: user.id, simulated: true } : o,
      );
      result.patch.members = result.patch.members.map((m) =>
        m.email === user.email
          ? { ...m, id: ownMember(data, user)?.id || m.id, userId: user.id }
          : m,
      );
      data = { ...data, ...result.patch };
      break;
    }
    case 'inventory':
      requireRole(role, ['admin']);
      result = adjustInventory(data, { ...args, actor });
      data = { ...data, ...result.patch };
      break;
    case 'points.award':
      requireRole(role, staff);
      result = awardPoints(data, { ...args, actor });
      data = { ...data, ...result.patch };
      break;
    case 'promos.save': {
      requireRole(role, ['admin']);
      const promo = args.promo;
      if (
        !promo ||
        !/^[A-Z0-9]{4,16}$/.test(promo.code) ||
        !['percent', 'fixed'].includes(promo.type) ||
        !Number.isFinite(promo.value) ||
        promo.value <= 0 ||
        (promo.type === 'percent' && promo.value > 100) ||
        promo.value > 1000000
      )
        throw new HttpError(400, 'Enter a valid promo code and discount.');
      const prior = data.promos.find((p) => p.id === promo.id);
      if (data.promos.some((p) => p.code === promo.code && p.id !== prior?.id))
        throw new HttpError(409, 'This promo code already exists.');
      if (
        promo.maxRedemptions !== undefined &&
        (!Number.isInteger(promo.maxRedemptions) ||
          promo.maxRedemptions < 1 ||
          promo.maxRedemptions > 100000)
      )
        throw new HttpError(400, 'Choose a valid redemption limit.');
      const next = {
        id: prior?.id || recordId('PROMO'),
        code: promo.code,
        type: promo.type,
        value: promo.value,
        active: promo.active === true,
        maxRedemptions: promo.maxRedemptions,
        redemptions: prior?.redemptions || 0,
        memberOnly: promo.memberOnly === true,
        minSubtotal:
          Number.isFinite(promo.minSubtotal) && promo.minSubtotal >= 0 ? promo.minSubtotal : 0,
        description: String(promo.description || '').slice(0, 300),
      };
      data.promos = [next, ...data.promos.filter((p) => p.id !== next.id)];
      break;
    }
  }
  return { data, result };
}
