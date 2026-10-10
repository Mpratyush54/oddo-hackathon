import { useEffect, useRef, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import {
  ArrowDownLeft,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Camera,
  CameraOff,
  Check,
  ChevronsUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  CloudUpload,
  Coffee,
  Columns3,
  Cookie,
  CreditCard,
  Download,
  Ellipsis,
  Eye,
  FileCheck2,
  Flag,
  Globe,
  Grip,
  Heart,
  HeartHandshake,
  LayoutDashboard,
  LayoutGrid,
  Leaf,
  Lightbulb,
  List,
  ListPlus,
  ListTodo,
  LockKeyhole,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Minus,
  Package,
  PanelsTopLeft,
  PartyPopper,
  PenLine,
  Plus,
  QrCode,
  Receipt,
  Rows3,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Sprout,
  Ticket,
  TrendingUp,
  UserCheck,
  UserRound,
  UserRoundPlus,
  UsersRound,
  Wallet,
  X,
  Clock3,
  Paperclip,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money } from './store';

const icons: Record<string, LucideIcon> = {
  ArrowDownLeft,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Camera,
  CameraOff,
  Check,
  ChevronsUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  CloudUpload,
  Coffee,
  Columns3,
  Cookie,
  CreditCard,
  Download,
  Ellipsis,
  Eye,
  FileCheck2,
  Flag,
  Globe,
  Grip,
  Heart,
  HeartHandshake,
  LayoutDashboard,
  LayoutGrid,
  Leaf,
  Lightbulb,
  List,
  ListPlus,
  ListTodo,
  LockKeyhole,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  Minus,
  Package,
  PanelsTopLeft,
  PartyPopper,
  PenLine,
  Plus,
  QrCode,
  Receipt,
  Rows3,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Sprout,
  Ticket,
  TrendingUp,
  UserCheck,
  UserRound,
  UserRoundPlus,
  UsersRound,
  Wallet,
  X,
  Clock3,
  Paperclip,
};
export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Component = icons[name];
  return Component ? (
    <Component size={size} strokeWidth={1.75} className={className} aria-hidden="true" />
  ) : null;
}
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
export function Avatar({
  name,
  small = false,
  index = 0,
}: {
  name: string;
  small?: boolean;
  index?: number;
}) {
  return (
    <span className={`avatar ${small ? 'small' : ''} avatar-${index % 4}`} title={name}>
      {name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
export function Badge({ children, tone = 'teal' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Button({
  children,
  icon,
  variant = 'primary',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  icon?: string;
  variant?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
export function LinkButton({
  children,
  to,
  icon,
  variant = 'primary',
}: {
  children: ReactNode;
  to: string;
  icon?: string;
  variant?: string;
}) {
  return (
    <Link className={`button ${variant}`} to={to}>
      {icon && <Icon name={icon} size={17} />}
      {children}
    </Link>
  );
}
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="header-actions">{action}</div>}
    </div>
  );
}
export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
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
export function SearchField({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-field">
      <Icon name="Search" size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button className="plain-icon" aria-label="Clear search" onClick={() => onChange('')}>
          <Icon name="X" size={16} />
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = 'Nothing here yet',
  description = 'Your next great thing starts right here.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="icon-tile">
        <Icon name="Sprout" size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex="0"]',
        ) || [],
      ).filter((el) => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const els = focusable();
        const first = els[0],
          last = els[els.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', listener);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="X" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function FormFooter({
  onClose,
  label = 'Save changes',
}: {
  onClose: () => void;
  label?: string;
}) {
  return (
    <div className="form-footer">
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" icon="Check">
        {label}
      </Button>
    </div>
  );
}
export function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
}
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
      <div className="stat-value">
        {animatedNumber !== null ? animatedNumber : value}
      </div>
      {note && (
        <div className="stat-note">
          <Icon name="TrendingUp" size={14} />
          {note}
        </div>
      )}
    </div>
  );
}
export function CommunityArt() {
  return (
    <svg className="community-art" viewBox="0 0 270 230" fill="none" aria-hidden="true">
      <circle cx="146" cy="121" r="87" stroke="currentColor" strokeDasharray="4 9" />
      <path
        d="M49 175h190M74 170V86l40-28 30 17v95M145 169V45l49 27v98M80 96l35-21 21 11M153 83h32M153 99h32M153 115h32M153 131h32M84 113h18M84 132h18M115 100v15M115 129v15M96 172v-20h26v20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M45 70l8-13 8 13-8 14-8-14ZM217 107l7-12 7 12-7 12-7-12Z" fill="currentColor" />
      <circle cx="208" cy="41" r="4" fill="currentColor" />
      <circle cx="39" cy="118" r="3" fill="currentColor" />
      <path
        d="m211 163 10-14 14 8M39 184c3-12 9-19 18-20M227 178c-3-13-9-18-17-21M110 39v-10m-5 5h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58 178v-27c-20-13-27 11 0 27ZM220 179v-30c19-11 27 9 0 30Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="58" cy="188" r="5" fill="currentColor" />
      <circle cx="220" cy="188" r="5" fill="currentColor" />
    </svg>
  );
}
export function FinanceChart({
  values,
  dark = true,
}: {
  values: { label: string; income: number; expense: number }[];
  dark?: boolean;
}) {
  const max = Math.max(...values.flatMap((v) => [v.income, v.expense]), 1000);
  const width = 600,
    height = 170;
  const points = (key: 'income' | 'expense') =>
    values.map((v, i) => [
      30 + (i * 540) / Math.max(values.length - 1, 1),
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
            <line x1="30" x2="575" y1={y} y2={y} className="chart-grid" />
            <text x="0" y={y + 4} className="chart-label">
              {Math.round((max * (3 - i)) / 3 / 1000)}k
            </text>
          </g>
        ))}
        <path d={`${curve('income')} L570,150 L30,150 Z`} fill="url(#chart-fill)" />
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
              x={30 + (i * 540) / Math.max(values.length - 1, 1)}
              y="169"
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
export function ProductArt({ type, color }: { type: string; color: string }) {
  return (
    <div className={`product-art product-${color}`}>
      <svg viewBox="0 0 300 245" aria-label={`Skyline ${type}`} role="img">
        <ellipse cx="150" cy="216" rx="83" ry="9" fill="currentColor" opacity=".06" />
        {type === 'Tote bag' ? (
          <>
            <path
              d="M102 66c0-65 96-65 96 0"
              fill="none"
              stroke="var(--product-fabric)"
              strokeWidth="10"
            />
            <path d="M76 64h148l-11 140H87Z" fill="var(--product-fabric)" />
            <path d="M85 75h130M99 78v114m103-114v114" stroke="var(--product-seam)" fill="none" />
          </>
        ) : (
          <>
            <path
              d={
                type === 'Hoodie'
                  ? 'M119 48c-10-49 74-49 62 0l33 10 45 66-36 21-27-36 9 94H96l8-94-27 36-36-21 45-66Z'
                  : 'M119 44l-34 9-45 52 31 28 34-29-9 99h109l-10-99 34 29 31-28-45-52-34-9c-4 29-58 29-62 0Z'
              }
              fill="var(--product-fabric)"
            />
            <path d="M98 190h106M99 83l7 22m95-22-7 22" stroke="var(--product-seam)" fill="none" />
            {type === 'Hoodie' && (
              <>
                <path
                  d="m119 48 31 13 31-13M146 61v26m10-26v26m-34 70-10 23h76l-10-23"
                  stroke="var(--product-seam)"
                  fill="none"
                />
                <path d="m124 46 26 10 26-10" stroke="var(--product-seam)" fill="none" />
              </>
            )}
          </>
        )}
        <g fill="var(--product-print)" textAnchor="middle">
          <text x="150" y="123" fontSize="20" fontFamily="Georgia, serif" fontWeight="bold">
            skyline.
          </text>
          <text x="150" y="138" fontSize="5.5" letterSpacing="2.4">
            BETTER TOGETHER
          </text>
        </g>
      </svg>
      <span className="product-art-caption">MADE FOR YOUR EVERYDAY.</span>
    </div>
  );
}
