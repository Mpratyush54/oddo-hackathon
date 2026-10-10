import { randomUUID } from 'node:crypto';
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const timestamp = () => new Date().toISOString();
export const dateToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
export const recordId = (prefix) => `${prefix}-${randomUUID()}`;
export const clubKey = (id) => `COLLEGE#skyline-campus#CLUB#${id}`;
