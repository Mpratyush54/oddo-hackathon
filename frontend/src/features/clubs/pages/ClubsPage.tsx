import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { useStore } from '../../../app/state/StoreProvider';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { Revealed } from '../../../shared/components/PageMotion';
import { PublicNav, PublicFooter } from '../../../shared/layout/PublicLayout';

export const CLUB_STORIES: Record<
  string,
  {
    image: string;
    category: string;
    tagline: string;
    stats: string;
    cadence: string;
  }
> = {
  skyline: {
    image:
      'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85',
    category: 'Campus Life & Leadership',
    tagline:
      'Bridging connections across campus, curating marquee traditions, and driving community impact.',
    stats: '1,200+ Active Members',
    cadence: 'Thursdays • 6:00 PM',
  },
  codecraft: {
    image:
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=85',
    category: 'Tech, Makers & Hackers',
    tagline:
      'Building open-source tools, hosting overnight hackathons, and demoing ambitious prototypes.',
    stats: '480+ Makers & Devs',
    cadence: 'Tuesdays • 7:30 PM',
  },
  canvas: {
    image:
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85',
    category: 'Design, Studio & Arts',
    tagline:
      'From experimental typography to gallery exhibitions, elevating creative expression campus-wide.',
    stats: '310+ Artists & Designers',
    cadence: 'Fridays • 5:00 PM',
  },
};

export function ClubsPage() {
  const { organizations } = useStore();
  const navigate = useNavigate();
  return (
    <div className="portal-public">
      <PublicNav />
      <main className="portal-discover">
        <span className="portal-kicker">FIND YOUR PEOPLE</span>
        <h1>
          There's a community
          <br />
          with your name on it.
        </h1>
        <p>Explore student-led clubs, meet your next team, and make campus your own.</p>
        <div className="discovery-crosslink">
          <LinkButton to="/events" icon="CalendarDays" variant="secondary">
            See all campus events
          </LinkButton>
        </div>
        <div className="portal-club-grid club-stories-grid">
          {organizations.map((c, idx) => {
            const story = CLUB_STORIES[c.id] || {
              image:
                'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85',
              category: 'Student Organization',
              tagline: c.description,
              stats: 'Active Community',
              cadence: 'Weekly on campus',
            };
            return (
              <Revealed key={c.id} delay={idx * 90}>
                <article
                  className="portal-club club-story-card"
                  onClick={() => navigate(`/clubs/${c.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/clubs/${c.id}`);
                    }
                  }}
                >
                  <div className="club-story-hero">
                    <img
                      src={story.image}
                      alt={c.name}
                      className="club-story-image"
                      loading="lazy"
                    />
                    <div className="club-story-overlay" />
                    <span className="club-category-pill">{story.category}</span>
                  </div>
                  <div className="club-story-body">
                    <div className="club-story-meta">
                      <h2>{c.name}</h2>
                      <span className="club-cadence-badge">{story.cadence}</span>
                    </div>
                    <p className="club-story-desc">{story.tagline || c.description}</p>
                    <div className="club-story-footer">
                      <span className="club-stats-pill">
                        <Icon name="Users" size={14} />
                        {story.stats}
                      </span>
                      <Button
                        icon="ArrowRight"
                        onClick={() => {
                          navigate(`/clubs/${c.id}`);
                        }}
                      >
                        Explore this club
                      </Button>
                    </div>
                  </div>
                </article>
              </Revealed>
            );
          })}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
