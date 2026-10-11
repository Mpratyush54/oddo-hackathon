import { money } from '../utils/format';

export function FinanceChart({
  values,
  dark = true,
}: {
  values: { label: string; income: number; expense: number }[];
  dark?: boolean;
}) {
  const max = Math.max(...values.flatMap((v) => [v.income, v.expense]), 1000);
  const width = 600,
    height = 178;
  const left = 44;
  const right = 580;
  const span = right - left;
  const points = (key: 'income' | 'expense') =>
    values.map((v, i) => [
      left + (i * span) / Math.max(values.length - 1, 1),
      150 - (v[key] / max) * 125,
    ]);
  const curve = (key: 'income' | 'expense') => {
    const p = points(key);
    return p.reduce(
      (s, point, i) =>
        i === 0
          ? `M${point[0]},${point[1]}`
          : `${s} C${(p[i - 1][0] + point[0]) / 2},${p[i - 1][1]} ${(p[i - 1][0] + point[0]) / 2},${point[1]} ${point[0]},${point[1]}`,
      '',
    );
  };
  return (
    <div className={`finance-chart ${dark ? 'dark-chart' : ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={values
          .map((v) => `${v.label}: income ${money(v.income)}, expenses ${money(v.expense)}`)
          .join('; ')}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity=".2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 66, 108, 150].map((y, i) => (
          <g key={y}>
            <line x1={left} x2={right} y1={y} y2={y} className="chart-grid" />
            <text x={left - 8} y={y + 4} textAnchor="end" className="chart-label">
              {Math.round((max * (3 - i)) / 3 / 1000)}k
            </text>
          </g>
        ))}
        <path d={`${curve('income')} L${right},150 L${left},150 Z`} fill="url(#chart-fill)" />
        <path d={curve('income')} className="chart-income" fill="none" strokeWidth="3" />
        <path
          d={curve('expense')}
          className="chart-expense"
          fill="none"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        {values.map((v, i) => (
          <g key={v.label}>
            <circle
              cx={points('income')[i][0]}
              cy={points('income')[i][1]}
              r="4"
              className="chart-point"
            >
              <title>
                {v.label}: {money(v.income)}
              </title>
            </circle>
            <text
              x={left + (i * span) / Math.max(values.length - 1, 1)}
              y="172"
              textAnchor="middle"
              className="chart-label"
            >
              {v.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
