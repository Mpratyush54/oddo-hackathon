export function paginateLocal<T>(items: T[], page = 1, limit = 5) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit) || 1);
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * limit;
  return {
    rows: items.slice(start, start + limit),
    page: current,
    limit,
    total,
    pages,
  };
}
