import { Icon } from './Icon';

export function TablePager({
  page,
  pages,
  total,
  limit,
  label = 'rows',
  loading = false,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  label?: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const safePages = Math.max(1, pages || 1);
  const safePage = Math.min(Math.max(1, page || 1), safePages);
  const from = total ? (safePage - 1) * limit + 1 : 0;
  const to = Math.min(safePage * limit, total);
  return (
    <div className="table-pager" role="navigation" aria-label="Table pagination">
      <span className="table-pager-summary">
        Showing {from}–{to} of {total} {label}
      </span>
      <div className="table-pager-controls">
        <button
          type="button"
          className="table-pager-btn"
          disabled={safePage <= 1 || loading}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
        >
          <Icon name="ChevronLeft" size={18} />
          <span>Prev</span>
        </button>
        <span className="table-pager-page">
          Page {safePage} / {safePages}
        </span>
        <button
          type="button"
          className="table-pager-btn"
          disabled={safePage >= safePages || loading}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
        >
          <span>Next</span>
          <Icon name="ChevronRight" size={18} />
        </button>
      </div>
    </div>
  );
}
