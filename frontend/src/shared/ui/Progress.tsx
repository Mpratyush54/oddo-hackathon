export function Progress({ value, tone = 'teal' }: { value: number; tone?: string }) {
  return (
    <div
      className={`progress ${tone}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
