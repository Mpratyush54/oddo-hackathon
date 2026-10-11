import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { date, money } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { seed } from '../../../demo/data/clubs';
import '../../../shared/styles/portal.css';
import '../styles/landing.css';
import { LandingEvents } from '../../events/components/LandingEvents';
import { Revealed } from '../../../shared/components/PageMotion';
import { roles } from '../../auth/config/roles';
import { PublicNav, PublicFooter } from '../../../shared/layout/PublicLayout';

export const mosaicExtras = [
  {
    image:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
    club: 'SKYLINE',
    title: 'NIGHT STAGE',
    tag: 'MUSIC',
    year: '2026',
  },
  {
    image:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80',
    club: 'CANVAS',
    title: 'OPEN MIC',
    tag: 'CULTURE',
    year: '2026',
  },
  {
    image:
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=80',
    club: 'CODECRAFT',
    title: 'BUILDERS',
    tag: 'TECH',
    year: '2026',
  },
  {
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
    club: 'SKYLINE',
    title: 'CAMPUS',
    tag: 'COMMUNITY',
    year: '2026',
  },
];

const defaultMosaicImages = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1000&q=80',
];

const defaultProductFallbackImages = [
  'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=85',
  'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85',
];

/** Always-available placeholder when remote Unsplash hotlinks fail. */
const localImageFallback =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1a3832"/><stop offset="100%" stop-color="#2f6f57"/>
      </linearGradient></defs>
      <rect width="900" height="700" fill="url(#g)"/>
      <text x="450" y="360" fill="#e8f0ea" font-family="Georgia,serif" font-size="42" text-anchor="middle">skyline.</text>
    </svg>`,
  );

function swapBrokenImage(img: HTMLImageElement, candidates: string[], startIndex: number) {
  const tried = Number(img.dataset.fallbackTries || '0');
  if (tried >= candidates.length) {
    if (img.src !== localImageFallback) img.src = localImageFallback;
    return;
  }
  img.dataset.fallbackTries = String(tried + 1);
  const next = candidates[(startIndex + tried + 1) % candidates.length];
  if (next && img.src !== next) img.src = next;
  else if (img.src !== localImageFallback) img.src = localImageFallback;
}

export function LandingPage() {
  const { allClubs, organizations } = useStore();
  const afterRef = useRef<HTMLDivElement>(null);

  const merchandiseItems = (
    allClubs.skyline?.products?.length ? allClubs.skyline.products : seed.products || []
  ).slice(0, 3);

  const announcementItems = (
    allClubs.skyline?.announcements?.length
      ? allClubs.skyline.announcements
      : seed.announcements || []
  ).slice(0, 3);
  const mosaic = [
    ...organizations.flatMap((org) =>
      (allClubs[org.id]?.events || []).map((event) => ({
        id: `${org.id}-${event.id}`,
        href: `/e/${org.id}/${event.id}`,
        image: event.image,
        club: org.name.split(' ')[0].toUpperCase(),
        title: event.title.split(' ').slice(0, 2).join(' ').toUpperCase(),
        tag: event.category.toUpperCase(),
        year: event.date.slice(0, 4),
      })),
    ),
    ...mosaicExtras.map((item, i) => ({
      id: `extra-${i}`,
      href: '/events',
      ...item,
    })),
  ]
    .slice(0, 14)
    .map((card, i) => ({
      ...card,
      image:
        card.image && card.image.startsWith('http')
          ? card.image
          : defaultMosaicImages[i % defaultMosaicImages.length],
    }));

  return (
    <div className="portal-public landing-root">
      <section className="landing-stage" aria-label="Skyline home">
        <PublicNav className="landing-stage-nav" />
        <div className="landing-mosaic-viewport" aria-hidden="true">
          <div className="landing-mosaic">
            {mosaic.map((card, i) => (
              <Link
                key={card.id}
                to={card.href}
                className="landing-mosaic-card"
                style={{ '--pop-delay': `${Math.min(420, i * 35)}ms` } as CSSProperties}
                tabIndex={-1}
              >
                <img
                  src={card.image}
                  alt=""
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(e) => swapBrokenImage(e.currentTarget, defaultMosaicImages, i)}
                />
                <div className="landing-mosaic-meta">
                  <span className="tl">{card.club}</span>
                  <span className="tr">{card.title}</span>
                  <span className="bl">{card.tag}</span>
                  <span className="br">{card.year}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="landing-stage-veil" />
        <div className="landing-stage-copy">
          <div className="landing-stage-panel">
            <span className="landing-stage-kicker">
              <span className="live-dot" /> The student community operating system
            </span>
            <h1 className="landing-stage-headline">
              Less chasing.
              <br />
              More <em>belonging.</em>
            </h1>
            <p className="landing-stage-lede">
              Events worth showing up for. People worth knowing. Money everyone can account for. Run
              your whole student organization in one thoughtful space.
            </p>
            <div className="landing-stage-actions">
              <LinkButton to="/events" icon="ArrowRight">
                Browse campus events
              </LinkButton>
              <LinkButton to="/clubs" variant="secondary">
                Find your community
              </LinkButton>
            </div>
            <div className="landing-stage-caption">
              <div className="avatar-stack">
                {['Alex Morgan', 'Priya Sharma', 'Jordan Lee', 'Aisha Patel'].map((n, i) => (
                  <Avatar key={n} name={n} index={i} small />
                ))}
              </div>
              <span>
                Built for busy students.
                <br />
                <strong>Every role has a place.</strong>
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="landing-stage-scroll"
          onClick={() => afterRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          Scroll to explore
          <Icon name="ChevronDown" size={18} />
        </button>
      </section>

      <div className="landing-after-stage" ref={afterRef}>
        <section className="portal-proof" aria-label="Campus clubs ticker">
          <div className="portal-proof-ticker">
            {[0, 1].map((copyIndex) => (
              <div
                key={copyIndex}
                className="portal-proof-track"
                aria-hidden={copyIndex > 0 ? 'true' : undefined}
              >
                {Array.from({ length: 3 }).map((_, repeatIndex) => (
                  <span key={repeatIndex} className="portal-proof-segment">
                    <span className="ticker-label">ONE CONNECTED CAMPUS.</span>
                    {organizations.map((c) => (
                      <span key={`${c.id}-${repeatIndex}`} className="ticker-item">
                        <Icon name="Sprout" size={18} />
                        <span>{c.name}</span>
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
        <LandingEvents />

        {/* Merchandise Teaser */}
        <section className="landing-merch-section" aria-labelledby="landing-merch-title">
          <Revealed>
            <header className="landing-section-header">
              <div>
                <span className="portal-kicker">COMMUNITY APPAREL & GOODS</span>
                <h2 id="landing-merch-title">Official club merchandise</h2>
                <p>Support your clubs and wear your community with pride.</p>
              </div>
              <LinkButton to="/app/merchandise" variant="secondary" icon="ArrowRight">
                Shop all gear
              </LinkButton>
            </header>
          </Revealed>
          <div className="landing-merch-grid">
            {merchandiseItems.map((prod, i) => {
              const prodImg =
                prod.image && prod.image.startsWith('http')
                  ? prod.image
                  : defaultProductFallbackImages[i % defaultProductFallbackImages.length];
              return (
                <Revealed key={prod.id} delay={i * 70} pop>
                  <Link
                    className="landing-event"
                    to="/app/merchandise"
                    aria-label={`View ${prod.name}`}
                  >
                    <div className="landing-event-image">
                      <img
                        src={prodImg}
                        alt={prod.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) =>
                          swapBrokenImage(e.currentTarget, defaultProductFallbackImages, i)
                        }
                      />
                      <span>{prod.type}</span>
                      <span
                        className="landing-event-arrow"
                        role="img"
                        aria-label={`View ${prod.name}`}
                      >
                        <Icon name="ArrowUpRight" />
                      </span>
                    </div>
                    <small>Skyline Collection · {prod.color}</small>
                    <h3>{prod.name}</h3>
                    <p>In stock in campus shop</p>
                    <footer>
                      <strong>
                        {money(prod.memberPrice)} (Members) · {money(prod.price)}
                      </strong>
                      <span>Member discount</span>
                    </footer>
                  </Link>
                </Revealed>
              );
            })}
          </div>
        </section>

        {/* Latest Announcements */}
        <section
          className="landing-announcements-section"
          aria-labelledby="landing-announcements-title"
        >
          <Revealed>
            <header className="landing-section-header">
              <div>
                <span className="portal-kicker">BULLETIN & UPDATES</span>
                <h2 id="landing-announcements-title">Latest announcements</h2>
                <p>Stay in the loop with what matters across campus.</p>
              </div>
              <LinkButton to="/app/announcements" variant="secondary" icon="ArrowRight">
                View all updates
              </LinkButton>
            </header>
          </Revealed>
          <div className="landing-announcements-grid">
            {announcementItems.map((ann, i) => (
              <Revealed key={ann.id} delay={i * 70} pop>
                <article className="landing-announcement-card">
                  <div className="landing-announcement-meta">
                    <span className="landing-announcement-date">
                      {date(ann.date, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="landing-announcement-audience">{ann.audience}</span>
                  </div>
                  <h3>{ann.title}</h3>
                  <p>{ann.body}</p>
                  <div className="landing-announcement-footer">
                    <span>By {ann.author}</span>
                    <Link to="/app/announcements" className="landing-announcement-link">
                      Read more <Icon name="ArrowRight" size={14} />
                    </Link>
                  </div>
                </article>
              </Revealed>
            ))}
          </div>
        </section>

        <Revealed>
          <section className="portal-feature-section" id="how-it-works">
            <span className="portal-kicker">EVERYTHING YOUR CLUB NEEDS</span>
            <h2>
              Good things happen
              <br />
              when everything comes together.
            </h2>
            <div className="portal-features">
              {[
                {
                  icon: 'UsersRound',
                  title: 'A home for your people',
                  body: 'Membership, renewals, digital cards and student benefits. Know who belongs and help them feel it.',
                  label: 'MEMBERSHIP',
                },
                {
                  icon: 'Ticket',
                  title: 'From idea to a full room',
                  body: 'Member pricing, capacity, digital tickets and quick check-in. Give every event a strong start.',
                  label: 'EVENTS & EXPERIENCES',
                },
                {
                  icon: 'Wallet',
                  title: 'Money that makes sense',
                  body: 'Dues, sales, receipts and approvals in a shared ledger. Close the semester with confidence.',
                  label: 'FINANCE & TRUST',
                },
              ].map((f, i) => (
                <Revealed key={f.title} delay={i * 70} pop as="article">
                  <span className="icon-tile">
                    <Icon name={f.icon} size={26} />
                  </span>
                  <small>{f.label}</small>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </Revealed>
              ))}
            </div>
          </section>
        </Revealed>
        <Revealed>
          <section className="portal-roles-section">
            <div>
              <span className="portal-kicker">THE RIGHT VIEW FOR EVERY RESPONSIBILITY</span>
              <h2>
                One campus.
                <br />
                Five ways to make it better.
              </h2>
              <p>
                Students need their next ticket. Treasurers need their next approval. College teams
                need the bigger picture. Skyline gives each person a useful starting point.
              </p>
              <LinkButton to="/login" icon="ArrowRight">
                Explore roles
              </LinkButton>
            </div>
            <div className="portal-role-list">
              {roles.map((r, i) => (
                <Revealed key={r.role} delay={i * 50} pop>
                  <Link to="/login">
                    <span>0{i + 1}</span>
                    <Icon name={r.icon} />
                    <div>
                      <strong>{r.title}</strong>
                      <small>{r.text}</small>
                    </div>
                    <Icon name="ArrowUpRight" size={20} />
                  </Link>
                </Revealed>
              ))}
            </div>
          </section>
        </Revealed>
        <Revealed>
          <section className="portal-public-cta">
            <span className="portal-kicker">MAKE THIS SEMESTER COUNT</span>
            <h2>
              Your next big thing
              <br />
              starts with your people.
            </h2>
            <LinkButton to="/login" icon="ArrowRight">
              Join your club
            </LinkButton>
          </section>
        </Revealed>
        <PublicFooter />
      </div>
    </div>
  );
}
