import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

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
