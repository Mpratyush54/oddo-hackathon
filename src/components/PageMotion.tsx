import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import '../motion.css';

type PageMotionProps = {
  children: ReactNode;
  className?: string;
};

/** A short visual cue for navigation, independent of request/loading state. */
export function PageMotion({ children, className = '' }: PageMotionProps) {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const container = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    let transition: Animation | undefined;

    // Wait for the new page's heading to exist before moving keyboard focus.
    const frame = requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reducedMotion && content.current?.animate) {
        transition = content.current.animate(
          [{ opacity: 0.86 }, { opacity: 1 }],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
        );
      }
      const heading = container.current?.querySelector<HTMLElement>('h1');
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      setAnnouncement(heading?.textContent?.trim() || document.title);

      if (!dialog && heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }

      // The workspace owns its own scroll regions. Public pages start at the top.
      if (!pathname.startsWith('/app') && !dialog) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      transition?.cancel();
    };
  }, [pathname]);

  return (
    <div ref={container} className={`page-motion ${className}`}>
      <div key={`cue-${pathname}`} className="route-change-cue" aria-hidden="true" />
      <div ref={content} className="page-motion-content">
        {children}
      </div>
      <span className="motion-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}

/** Content stays visible if observers or animations are unavailable. */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    const element = ref.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || reducedMotion.matches || !('IntersectionObserver' in window)) return;

    const bounds = element.getBoundingClientRect();
    if (bounds.top < window.innerHeight - 24 && bounds.bottom > 0) return;
    setRevealed(false);

    const reveal = () => {
      setRevealed(true);
      observer.disconnect();
    };
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) reveal();
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    );
    observer.observe(element);

    // Changing the preference while the page is open also restores the content.
    const preferenceChanged = () => {
      if (reducedMotion.matches) reveal();
    };
    reducedMotion.addEventListener('change', preferenceChanged);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener('change', preferenceChanged);
    };
  }, []);

  return { ref, revealed };
}

type RevealedProps = {
  children: ReactNode;
  className?: string;
  /** Small stagger in milliseconds. Keep this below 250 for quick reading. */
  delay?: number;
  /** Stronger scale+rise for cards and tiles. */
  pop?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
};

export function Revealed({
  children,
  className = '',
  delay = 0,
  pop = false,
  as: Tag = 'div',
}: RevealedProps) {
  const { ref, revealed } = useReveal();
  const style = { '--reveal-delay': `${Math.min(250, Math.max(0, delay))}ms` } as CSSProperties;

  return (
    <Tag
      ref={ref as never}
      className={`motion-reveal ${pop ? 'pop' : ''} ${revealed ? 'reveal-in' : 'reveal-ready'} ${className}`}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** Stagger children that are already wrapped in Revealed, or wrap plain nodes. */
export function RevealStagger({
  children,
  className = '',
  step = 55,
  pop = false,
}: {
  children: ReactNode;
  className?: string;
  step?: number;
  pop?: boolean;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={`motion-stagger ${className}`}>
      {items.map((child, index) =>
        child == null ? null : (
          <Revealed key={index} delay={Math.min(250, index * step)} pop={pop}>
            {child}
          </Revealed>
        ),
      )}
    </div>
  );
}

export default PageMotion;
