import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import '../styles/portal.css';
import '../../features/landing/styles/landing.css';

import { useTheme } from '../theme/theme';

export function PublicNav({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        nav.current?.querySelector<HTMLButtonElement>('.public-menu-toggle')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <nav
      ref={nav}
      className={`portal-public-nav public-navigation ${className}`.trim()}
      aria-label="Public navigation"
    >
      <Logo />
      <div className="public-nav-right">
        <div className={open ? 'public-links is-open' : 'public-links'}>
          <Link to="/events" onClick={() => setOpen(false)}>
            Events
          </Link>
          <Link to="/clubs" onClick={() => setOpen(false)}>
            Clubs
          </Link>
          <Link to="/shop" onClick={() => setOpen(false)}>
            Shop
          </Link>
          <Link to="/login" onClick={() => setOpen(false)}>
            Login
          </Link>
          <button
            type="button"
            className="mobile-public-theme-row"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Icon name={theme === 'dark' ? 'Sun' : 'Moon'} size={16} />
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
        <button
          type="button"
          className={`public-theme-toggle public-theme-toggle-btn ${theme === 'dark' ? 'shift-to-light' : 'shift-to-dark'}`}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <Icon name={theme === 'dark' ? 'Sun' : 'Moon'} size={17} />
        </button>
        <button
          className="public-menu-toggle icon-button"
          aria-label={open ? 'Close site menu' : 'Open site menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'X' : 'Menu'} />
        </button>
      </div>
    </nav>
  );
}

export function PublicFooter() {
  return (
    <footer className="portal-public-footer">
      <Logo />
      <span>Made for student communities. Built to bring people together.</span>
      <Link to="/clubs">Find your club →</Link>
    </footer>
  );
}
