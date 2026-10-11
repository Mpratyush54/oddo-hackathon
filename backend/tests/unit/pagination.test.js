import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../../src/shared/request-validation.js';

test('paginate returns a server page slice with totals', () => {
  const items = Array.from({ length: 67 }, (_, i) => ({ id: i + 1 }));
  const first = paginate(items, { page: '1', limit: '8' });
  assert.equal(first.page, 1);
  assert.equal(first.limit, 8);
  assert.equal(first.total, 67);
  assert.equal(first.pages, 9);
  assert.deepEqual(
    first.items.map((row) => row.id),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  const last = paginate(items, { page: 9, limit: 8 });
  assert.equal(last.items.length, 3);
  assert.equal(last.page, 9);
});

test('paginate clamps past-the-end pages', () => {
  const page = paginate([1, 2, 3], { page: 99, limit: 2 });
  assert.equal(page.page, 2);
  assert.deepEqual(page.items, [3]);
});
