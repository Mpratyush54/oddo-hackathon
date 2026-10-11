import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Button({
  children,
  icon,
  variant = 'primary',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  title,
}: {
  children: ReactNode;
  icon?: string;
  variant?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      onClick={onClick}
      type={type}
      disabled={disabled}
      title={title}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
