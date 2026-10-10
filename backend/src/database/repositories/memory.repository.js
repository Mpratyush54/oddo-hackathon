import { HttpError } from '../../shared/records.js';
import { parseDatabaseRecord } from '../schemas/index.js';

export class MemoryRepository {
  constructor() {
    this.items = new Map();
  }
  async get(pk, sk) {
    return structuredClone(this.items.get(`${pk}|${sk}`));
  }
  async put(item, fresh = false) {
    item = parseDatabaseRecord(item);
    const key = `${item.pk}|${item.sk}`;
    if (fresh && this.items.has(key)) return false;
    this.items.set(key, structuredClone(item));
    return true;
  }
  async list(pk, prefix) {
    return [...this.items.values()]
      .filter((i) => i.pk === pk && i.sk.startsWith(prefix))
      .map((i) => structuredClone(i));
  }
  async atomic(items) {
    items = items.map((operation) => ({ ...operation, item: parseDatabaseRecord(operation.item) }));
    for (const { item, condition, values } of items) {
      const existing = this.items.get(`${item.pk}|${item.sk}`);
      if (condition === 'attribute_not_exists(pk)' && existing) return false;
      if (condition === '#version = :version' && existing?.version !== values[':version'])
        return false;
      if (condition === 'revoked = :false' && existing?.revoked !== false) return false;
      if (condition === '#role = :role' && existing?.role !== values[':role']) return false;
      if (
        condition === 'sessionVersion = :version' &&
        existing?.sessionVersion !== values[':version']
      )
        return false;
    }
    for (const { item } of items) this.items.set(`${item.pk}|${item.sk}`, structuredClone(item));
    return true;
  }
  async limit(key, maximum, seconds) {
    if (
      typeof key !== 'string' ||
      !key ||
      !Number.isInteger(maximum) ||
      maximum < 1 ||
      !Number.isInteger(seconds) ||
      seconds < 1
    )
      throw new TypeError('Invalid rate-limit parameters.');
    const pk = `LIMIT#${key}#${Math.floor(Date.now() / (seconds * 1000))}`;
    const item = await this.get(pk, 'COUNT');
    if ((item?.count || 0) >= maximum) throw new HttpError(429, 'Too many requests.');
    await this.put({
      pk,
      sk: 'COUNT',
      count: (item?.count || 0) + 1,
      expiresAt: Math.floor(Date.now() / 1000) + seconds * 2,
    });
  }
  async commit(pk, version, data, audit, request) {
    if (Buffer.byteLength(JSON.stringify(data)) > 300_000)
      throw new HttpError(
        409,
        'This club has reached its pilot data limit. Archive records before adding more.',
      );
    return this.atomic([
      {
        item: { pk, sk: 'STATE', version: version + 1, data },
        condition: '#version = :version',
        names: { '#version': 'version' },
        values: { ':version': version },
      },
      {
        item: { pk, sk: `AUDIT#${audit.date}#${audit.id}`, ...audit },
        condition: 'attribute_not_exists(pk)',
      },
      {
        item: {
          pk,
          sk: request.sk,
          result: request.result,
          fingerprint: request.fingerprint,
          expiresAt: Math.floor(Date.now() / 1000) + 86400,
        },
        condition: 'attribute_not_exists(pk)',
      },
    ]);
  }
}
