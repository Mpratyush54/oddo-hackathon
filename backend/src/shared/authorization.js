import { HttpError } from './records.js';

export const staff = ['admin', 'organizer'];

export const finance = ['admin', 'treasurer'];

/** Club admin, events lead, and treasurer can create/assign on project boards. */
export const taskManagers = ['admin', 'organizer', 'treasurer'];

export const allowedRoles = ['member', 'organizer', 'treasurer', 'admin', 'college'];

export function requireRole(role, allowed) {
  if (!allowed.includes(role)) throw new HttpError(403, 'Your role cannot perform this action.');
}
