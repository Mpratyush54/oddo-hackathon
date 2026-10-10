import { promoCodeSchema, optionalPhoneSchema } from '../../../../shared/schemas.js';
import { z } from 'zod';
import {
  id,
  text,
  email,
  date,
  instant,
  nonnegative,
  count,
  preferences,
  recordKeys,
  time,
  prefixedKey,
} from './primitives.js';

// Entity schemas include known historical/fixture fields. New storage fields must be declared here.
export const memberSchema = z.strictObject({
  id,
  userId: id.optional(),
  name: text,
  email,
  course: text,
  status: z.enum(['Active', 'Pending', 'Expiring', 'Expired']),
  joined: date,
  expires: date,
  role: text,
  phone: optionalPhoneSchema.optional(),
  whatsappOptIn: z.boolean().optional(),
  consentUpdatedAt: instant.optional(),
  participationPoints: nonnegative.optional(),
  volunteerPoints: nonnegative.optional(),
  contributionPoints: nonnegative.optional(),
  preferences: preferences.optional(),
  readNotificationIds: z.array(id).max(100).optional(),
  duesWaived: z.boolean().optional(),
  enrollmentSource: text.optional(),
});
export const eventSchema = z.strictObject({
  id,
  title: text,
  date,
  time: time,
  capacity: count.min(1).max(10000),
  sold: count,
  price: nonnegative,
  memberPrice: nonnegative,
  venue: text.optional(),
  category: text.optional(),
  description: text.optional(),
  image: text.optional(),
  budget: nonnegative.optional(),
  gallery: z.array(text).optional(),
  recap: text.optional(),
  endDate: date.optional(),
  endTime: time.optional(),
});
export const productSchema = z.strictObject({
  id,
  name: text,
  type: text,
  price: nonnegative,
  memberPrice: nonnegative,
  stock: z.record(z.string().min(1).max(20), count),
  color: text.optional(),
  image: text.optional(),
});
export const ticketSchema = z.strictObject({
  id,
  eventId: id,
  userId: id.optional(),
  name: text,
  email,
  member: z.boolean(),
  checkedIn: z.boolean(),
  amount: nonnegative,
  status: z.enum(['Confirmed', 'Cancelled']).optional(),
  simulated: z.boolean().optional(),
  cancelledAt: text.optional(),
  checkedInAt: text.optional(),
});
export const orderStatusSchema = z.enum([
  'Placed',
  'Ready for pickup',
  'Picked up',
  'Cancelled',
]);
export const orderSchema = z.strictObject({
  id,
  productId: id,
  userId: id.optional(),
  name: text,
  email: email.optional(),
  size: text,
  amount: nonnegative,
  date,
  promoCode: text.optional(),
  simulated: z.boolean().optional(),
  quantity: count.min(1).optional(),
  subtotal: nonnegative.optional(),
  discount: nonnegative.optional(),
  status: orderStatusSchema.optional(),
});
export const transactionSchema = z.strictObject({
  id,
  title: text,
  category: text,
  amount: z.number().finite(),
  date,
  status: z.enum(['Completed', 'Pending', 'Rejected']),
  receipt: text.optional(),
  receiptKey: text.optional(),
  receiptData: text.optional(),
  eventId: id.optional(),
  createdBy: id.optional(),
  reviewedBy: id.optional(),
  reviewedAt: instant.optional(),
  rejectionReason: text.optional(),
  simulated: z.boolean().optional(),
  ticketId: id.optional(),
  orderId: id.optional(),
});
export const taskSchema = z.strictObject({
  id,
  title: text,
  description: text,
  assignee: text,
  assigneeId: id.optional(),
  due: date,
  priority: z.enum(['Low', 'Medium', 'High']),
  status: z.enum(['To do', 'In progress', 'Done']),
});
export const promoSchema = z.strictObject({
  id,
  code: promoCodeSchema,
  type: z.enum(['percent', 'fixed']),
  value: nonnegative,
  active: z.boolean(),
  redemptions: count,
  maxRedemptions: count.min(1).optional(),
  memberOnly: z.boolean().optional(),
  minSubtotal: nonnegative.optional(),
  expires: date.optional(),
  description: text.optional(),
  productId: id.optional(),
});
export const pointRulesSchema = z.strictObject({
  checkInEnabled: z.boolean(),
  checkInPoints: count.max(500),
  merchEnabled: z.boolean(),
  merchRupeesPerPoint: count.min(1).max(10000),
  taskEnabled: z.boolean(),
  taskDonePoints: count.max(500),
});
export const pointSchema = z.strictObject({
  id,
  memberId: id,
  kind: z.enum(['participation', 'volunteer', 'contribution']),
  points: z.number().int(),
  reason: text,
  date: text,
  eventId: id.optional(),
  orderId: id.optional(),
  taskId: id.optional(),
});
export const announcementSchema = z.strictObject({
  id,
  title: text,
  body: text,
  audience: z.enum([
    'All members',
    'Active members',
    'Volunteers',
    'Pending dues',
    'Renewing soon',
  ]),
  date: text,
  author: text,
  authorId: id.optional(),
  read: count,
  email: z.boolean(),
  whatsapp: z.boolean().optional(),
  recipients: count.optional(),
});
export const notificationSchema = z.strictObject({
  id,
  title: text,
  body: text,
  date: text,
  read: z.boolean(),
  to: text,
  audience: text.optional(),
  userId: id.optional(),
});
export const deliverySchema = z.strictObject({
  id,
  announcementId: id,
  channel: z.enum(['Email', 'WhatsApp', 'In-app']),
  recipient: text,
  status: z.enum(['Prepared', 'Sent', 'Failed', 'Unknown']),
  date: text,
  detail: text,
  actor: id.optional(),
  providerStatus: z.enum(['accepted', 'sent', 'delivered', 'read', 'failed']).optional(),
  providerTimestamp: count.optional(),
  providerMessageId: id.optional(),
});
export const waitlistSchema = z.strictObject({
  id,
  eventId: id,
  name: text,
  email,
  joined: text,
  status: z.enum(['Waiting', 'Promoted', 'Booked']),
  userId: id.optional(),
  promotedAt: text.optional(),
});
export const reviewSchema = z.strictObject({
  id,
  eventId: id,
  authorId: id,
  authorName: text,
  rating: count.min(1).max(5),
  comment: text,
  date: text,
});
export const auditSchema = z.strictObject({
  id: id.optional(),
  actor: id,
  action: text,
  clubId: id.optional(),
  collegeId: id.optional(),
  entity: text.optional(),
  entityId: id.optional(),
  date: text,
  detail: text,
});
export const clubDataSchema = z.strictObject({
  members: z.array(memberSchema),
  events: z.array(eventSchema),
  products: z.array(productSchema),
  tickets: z.array(ticketSchema),
  orders: z.array(orderSchema),
  transactions: z.array(transactionSchema),
  tasks: z.array(taskSchema),
  announcements: z.array(announcementSchema),
  notifications: z.array(notificationSchema),
  deliveries: z.array(deliverySchema),
  audit: z.array(auditSchema),
  waitlist: z.array(waitlistSchema),
  pointLedger: z.array(pointSchema),
  promos: z.array(promoSchema),
  pointRules: pointRulesSchema.optional(),
  eventReviews: z.array(reviewSchema).optional(),
  profile: z.object({ name: text, email: text, role: text }).optional(),
  preferences: preferences.optional(),
});
export const clubPartition = z.string().refine((key) => {
  const [collegeLabel, collegeId, clubLabel, clubId, extra] = key.split('#');
  return (
    collegeLabel === 'COLLEGE' &&
    Boolean(collegeId) &&
    clubLabel === 'CLUB' &&
    Boolean(clubId) &&
    extra === undefined
  );
}, 'Use COLLEGE#collegeId#CLUB#clubId.');
export const stateSchema = z.strictObject({
  ...recordKeys,
  pk: clubPartition,
  sk: z.literal('STATE'),
  version: count.min(1),
  data: clubDataSchema,
});
export const auditRecordSchema = auditSchema.extend({
  ...recordKeys,
  pk: clubPartition,
  sk: prefixedKey('AUDIT#'),
});
export const deliveryRecordSchema = deliverySchema.extend({
  ...recordKeys,
  pk: clubPartition,
  sk: prefixedKey('DELIVERY#'),
});
