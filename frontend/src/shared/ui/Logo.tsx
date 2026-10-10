import { Link } from 'react-router-dom';

export function Logo({ compact = false, to = '/' }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="Skyline home">
      <span className="brand-mark">
        <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <path
            d="M7 27V16l8-7v18m5 0V5l9 8v14M5 28h26"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          skyline<span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
