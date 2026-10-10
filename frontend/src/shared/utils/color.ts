import '../styles/portal.css';
import '../../features/landing/styles/landing.css';

export const accentColor = (tone: string) =>
  ({ teal: 'var(--primary)', purple: 'var(--purple)', gold: 'var(--gold)' })[tone] ||
  'var(--primary)';
