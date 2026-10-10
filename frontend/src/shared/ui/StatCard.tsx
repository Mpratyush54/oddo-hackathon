import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function StatCard({
  icon,
  label,
  value,
  note,
  tone = 'teal',
}: {
  icon: string;
  label: string;
  value: ReactNode;
  note?: string;
  tone?: string;
}) {
  const [animatedNumber, setAnimatedNumber] = useState<number | null>(() =>
    typeof value === 'number' ? 0 : null,
  );

  useEffect(() => {
    if (typeof value !== 'number') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setAnimatedNumber(value);
      return;
    }
    const start = performance.now();
    const duration = 400;
    const target = value;
    let animId: number;

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedNumber(Math.round(target * eased));
      if (progress < 1) animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [value]);

  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span className={`icon-tile ${tone}`}>
          <Icon name={icon} />
        </span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{animatedNumber !== null ? animatedNumber : value}</div>
      {note && (
        <div className="stat-note">
          <Icon name="TrendingUp" size={14} />
          {note}
        </div>
      )}
    </div>
  );
}
