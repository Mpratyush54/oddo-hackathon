import type { ReactNode } from 'react';

export function Badge({ children, tone = 'teal' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
