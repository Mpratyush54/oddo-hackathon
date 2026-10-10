import { z } from 'zod';
import {
  emailVerificationSchema,
  accountSchema,
  profileSchema,
  accessSchema,
  sessionSchema,
  refreshSchema,
} from './auth.schema.js';
import { stateSchema, auditRecordSchema, deliveryRecordSchema } from './club.schema.js';
import {
  requestSchema,
  counterSchema,
  messageMappingSchema,
  messageStatusSchema,
} from './operational.schema.js';

export const recordSchemas = {
  emailVerification: emailVerificationSchema,
  account: accountSchema,
  profile: profileSchema,
  access: accessSchema,
  session: sessionSchema,
  refresh: refreshSchema,
  state: stateSchema,
  audit: auditRecordSchema,
  delivery: deliveryRecordSchema,
  request: requestSchema,
  counter: counterSchema,
  messageMapping: messageMappingSchema,
  messageStatus: messageStatusSchema,
};
export const databaseRecordSchema = z.union(Object.values(recordSchemas));
export class DatabaseValidationError extends Error {
  constructor(issues) {
    super(
      'Database record does not match the declared schema: ' +
        issues.map((i) => i.path.join('.') + ' ' + i.message).join('; '),
    );
    this.name = 'DatabaseValidationError';
    // Report paths and reasons only; never include credentials or record values.
    this.issues = issues.map(({ path, message }) => ({ path: path.join('.'), message }));
  }
}
export function parseDatabaseRecord(item) {
  item = omitUndefined(item);
  const schema =
    item?.sk === 'EMAIL_VERIFICATION'
      ? emailVerificationSchema
      : item?.sk === 'STATE'
        ? stateSchema
        : item?.sk === 'ACCOUNT'
          ? accountSchema
          : item?.sk === 'PROFILE'
            ? profileSchema
            : item?.sk === 'SESSION'
              ? sessionSchema
              : item?.sk === 'REFRESH'
                ? refreshSchema
                : item?.sk === 'COUNT'
                  ? counterSchema
                  : item?.pk?.startsWith('MESSAGE#')
                    ? item.sk === 'STATUS'
                      ? messageStatusSchema
                      : messageMappingSchema
                    : item?.sk?.startsWith('ACCESS#')
                      ? accessSchema
                      : item?.sk?.startsWith('AUDIT#')
                        ? auditRecordSchema
                        : item?.sk?.startsWith('REQUEST#')
                          ? requestSchema
                          : item?.sk?.startsWith('DELIVERY#')
                            ? deliveryRecordSchema
                            : null;
  if (!schema)
    throw new DatabaseValidationError([{ path: ['sk'], message: 'Unknown record kind.' }]);
  const parsed = schema.safeParse(item);
  if (!parsed.success) throw new DatabaseValidationError(parsed.error.issues);
  const value = parsed.data;
  const inconsistent =
    (value.sk === 'PROFILE' && value.pk !== `USER#${value.id}`) ||
    (value.sk.startsWith('ACCESS#') && value.sk !== `ACCESS#${value.clubId}`);
  if (inconsistent)
    throw new DatabaseValidationError([
      { path: ['pk', 'sk'], message: 'Record keys do not match its identity.' },
    ]);
  if (value.sk === 'STATE') {
    for (const field of [
      'members',
      'events',
      'products',
      'tickets',
      'orders',
      'transactions',
      'tasks',
      'announcements',
      'notifications',
      'deliveries',
      'waitlist',
      'pointLedger',
      'promos',
      'eventReviews',
    ]) {
      const rows = value.data[field] || [];
      if (new Set(rows.map((r) => r.id)).size !== rows.length)
        throw new DatabaseValidationError([
          { path: ['data', field], message: 'Entity IDs must be unique within a club.' },
        ]);
    }
    if (value.data.events.some((e) => e.sold > e.capacity))
      throw new DatabaseValidationError([
        { path: ['data', 'events', 'sold'], message: 'Bookings exceed event capacity.' },
      ]);
    if (value.data.promos.some((p) => p.type === 'percent' && p.value > 100))
      throw new DatabaseValidationError([
        { path: ['data', 'promos', 'value'], message: 'Percentage cannot exceed 100.' },
      ]);
  }
  return { ...value, schemaVersion: 1 };
}

// DynamoDB omits optional undefined object properties. Validate that persisted representation
// without JSON serialization, which would silently convert NaN/Infinity into null.
function omitUndefined(value) {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (value && Object.getPrototypeOf(value) === Object.prototype)
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, omitUndefined(v)]),
    );
  return value;
}
