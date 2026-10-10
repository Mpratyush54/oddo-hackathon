export type Member = {
  id: string;
  userId?: string;
  name: string;
  email: string;
  course: string;
  status: 'Active' | 'Pending' | 'Expiring' | 'Expired';
  joined: string;
  expires: string;
  role: string;
  phone?: string;
  whatsappOptIn?: boolean;
  participationPoints?: number;
  volunteerPoints?: number;
  contributionPoints?: number;
};

export type ClubEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  price: number;
  memberPrice: number;
  capacity: number;
  sold: number;
  description: string;
  image: string;
  budget?: number;
  gallery?: string[];
  recap?: string;
  endTime?: string;
  endDate?: string;
};

export type Transaction = {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  status: 'Completed' | 'Pending' | 'Rejected';
  receipt?: string;
  receiptData?: string;
  receiptKey?: string;
  eventId?: string;
  createdBy?: string;
  reviewedBy?: string;
  rejectionReason?: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  due: string;
  priority: string;
  status: 'To do' | 'In progress' | 'Done';
};

export type Product = {
  id: string;
  name: string;
  price: number;
  memberPrice: number;
  color: string;
  type: string;
  stock: Record<string, number>;
  image?: string;
  gallery?: string[];
  delisted?: boolean;
};

export type PromoCode = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  active: boolean;
  maxRedemptions?: number;
  redemptions: number;
  memberOnly?: boolean;
  minSubtotal?: number;
  expires?: string;
  description?: string;
  /** When set, coupon only applies to this product. */
  productId?: string;
};

export type PointEntry = {
  id: string;
  memberId: string;
  kind: 'participation' | 'volunteer' | 'contribution';
  points: number;
  reason: string;
  date: string;
  eventId?: string;
  orderId?: string;
  taskId?: string;
};

/** Club-configurable basis for automatic contribution points. */
export type PointRules = {
  checkInEnabled: boolean;
  checkInPoints: number;
  merchEnabled: boolean;
  /** Spend this many rupees (after discount) to earn 1 contribution point. */
  merchRupeesPerPoint: number;
  taskEnabled: boolean;
  taskDonePoints: number;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  date: string;
  author: string;
  read: number;
  email: boolean;
  whatsapp?: boolean;
  recipients?: number;
};

export type Ticket = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  member: boolean;
  checkedIn: boolean;
  amount: number;
  status?: 'Confirmed' | 'Cancelled';
};

export type OrderStatus = 'Placed' | 'Ready for pickup' | 'Picked up' | 'Cancelled';

export type Order = {
  id: string;
  productId: string;
  name: string;
  email?: string;
  size: string;
  amount: number;
  date: string;
  promoCode?: string;
  status?: OrderStatus;
  quantity?: number;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string;
  accent: string;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  date: string;
  detail: string;
};

export type WaitlistEntry = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  joined: string;
  status: 'Waiting' | 'Promoted' | 'Booked';
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
  to: string;
  audience?: string;
};

export type Delivery = {
  id: string;
  announcementId: string;
  channel: 'Email' | 'WhatsApp' | 'In-app';
  recipient: string;
  status: 'Prepared' | 'Sent' | 'Failed' | 'Unknown';
  date: string;
  detail: string;
};

export type EventReview = {
  id: string;
  eventId: string;
  authorId: string;
  authorName: string;
  rating: number;
  comment: string;
  date: string;
};

export type Store = {
  members: Member[];
  events: ClubEvent[];
  transactions: Transaction[];
  tasks: Task[];
  products: Product[];
  announcements: Announcement[];
  tickets: Ticket[];
  orders: Order[];
  profile: { name: string; email: string; role: string };
  preferences: { email: boolean; renewals: boolean; weekly: boolean };
  waitlist: WaitlistEntry[];
  audit: AuditEntry[];
  notifications: Notification[];
  deliveries: Delivery[];
  eventReviews?: EventReview[];
  promos?: PromoCode[];
  pointLedger?: PointEntry[];
  pointRules?: PointRules;
};
