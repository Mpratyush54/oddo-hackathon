import { parseRequest } from '../../shared/request-validation.js';
import {
  orderRequestSchema,
  inventoryRequestSchema,
  createProductSchema,
  updateProductSchema,
  deleteProductSchema,
  updateOrderSchema,
  awardPointsSchema,
  savePointRulesSchema,
  savePromoSchema,
} from './commerce.schemas.js';
import { HttpError, recordId } from '../../shared/records.js';
import {
  adjustInventory,
  awardPoints,
  createProduct,
  updateProduct,
  deleteProduct,
  placeOrder,
  savePointRules,
  updateOrderStatus,
} from './commerce.domain.js';
import { staff, requireRole } from '../../shared/authorization.js';
import { ownMember } from '../../shared/validation.js';
import { ClubActionService } from '../clubs/club-action.service.js';

export class CommerceService extends ClubActionService {
  placeOrder(input) {
    input = parseRequest(orderRequestSchema, input);
    if (this.data.products.find((product) => product.id === input.productId)?.delisted)
      throw new HttpError(409, 'This product is no longer available.');

    const result = placeOrder(this.data, {
      productId: input.productId,
      size: input.size,
      quantity: input.quantity,
      promoCode: input.promoCode,
      joinMembership: input.joinMembership === true,
      actor: this.actor,
      today: this.now,
    });
    result.patch.orders = result.patch.orders.map((o) =>
      result.orders.some((x) => x.id === o.id)
        ? { ...o, userId: this.user.id, simulated: true, status: o.status || 'Placed' }
        : o,
    );
    result.patch.members = result.patch.members.map((m) =>
      m.email === this.user.email
        ? { ...m, id: ownMember(this.data, this.user)?.id || m.id, userId: this.user.id }
        : m,
    );
    this.data = { ...this.data, ...result.patch };

    return result;
  }

  updateOrder(input) {
    input = parseRequest(updateOrderSchema, input);
    requireRole(this.role, ['admin', 'treasurer', 'organizer']);
    const result = updateOrderStatus(this.data, {
      orderId: input.orderId,
      status: input.status,
      actor: this.actor,
    });
    this.data = { ...this.data, ...result.patch };
    return result;
  }

  adjustInventory(input) {
    input = parseRequest(inventoryRequestSchema, input);

    requireRole(this.role, ['admin', 'treasurer']);
    const result = adjustInventory(this.data, { ...input, actor: this.actor });
    this.data = { ...this.data, ...result.patch };

    return result;
  }

  createProduct(input) {
    input = parseRequest(createProductSchema, input);
    requireRole(this.role, ['admin', 'treasurer']);
    const result = createProduct(this.data, { ...input, actor: this.actor });
    this.data = { ...this.data, ...result.patch };
    return result;
  }

  updateProduct(input) {
    input = parseRequest(updateProductSchema, input);
    requireRole(this.role, ['admin', 'treasurer']);
    const result = updateProduct(this.data, { ...input, actor: this.actor });
    this.data = { ...this.data, ...result.patch };
    return result;
  }

  deleteProduct(input) {
    input = parseRequest(deleteProductSchema, input);
    requireRole(this.role, ['admin', 'treasurer']);
    const result = deleteProduct(this.data, { productId: input.productId, actor: this.actor });
    this.data = { ...this.data, ...result.patch };
    return result;
  }

  awardPoints(input) {
    input = parseRequest(awardPointsSchema, input);

    requireRole(this.role, staff);
    const result = awardPoints(this.data, { ...input, actor: this.actor });
    this.data = { ...this.data, ...result.patch };

    return result;
  }

  savePointRules(input) {
    input = parseRequest(savePointRulesSchema, input);
    requireRole(this.role, ['admin', 'treasurer']);
    const result = savePointRules(this.data, { rules: input.rules, actor: this.actor });
    this.data = { ...this.data, ...result.patch };
    return result;
  }

  savePromo(input) {
    input = parseRequest(savePromoSchema, input);

    requireRole(this.role, ['admin', 'treasurer']);
    const promo = input.promo;

    const prior = this.data.promos.find((p) => p.id === promo.id);
    if (this.data.promos.some((p) => p.code === promo.code && p.id !== prior?.id))
      throw new HttpError(409, 'This promo code already exists.');

    const next = {
      id: prior?.id || recordId('PROMO'),
      code: promo.code,
      type: promo.type,
      value: promo.value,
      active: promo.active,
      maxRedemptions: promo.maxRedemptions,
      redemptions: prior?.redemptions || 0,
      memberOnly: promo.memberOnly,
      minSubtotal: promo.minSubtotal,
      description: promo.description,
      ...(promo.productId ? { productId: promo.productId } : {}),
    };
    this.data.promos = [next, ...this.data.promos.filter((p) => p.id !== next.id)];

    return {};
  }
}
