import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Badge, CardHeader, Empty, Icon, LinkButton } from './components';
import { date, money, useStore } from './store';
import { useSession } from './session';
import Workspace from './Workspace';
import { EventDiscovery } from './pages/EventDiscovery';
import EventExperience from './pages/EventExperience';
import { eventPhase } from './event-utils';
import { PageMotion } from './components/PageMotion';
import { ShopPage } from './pages/Shop';
import { AuthPage, ClubsPage, LandingPage, PublicNav } from './pages/Portal';

function PublicClub() {
  const { id } = useParams();
  const { organizations, allClubs } = useStore();
  const { selectClub, signedIn } = useSession();
  const navigate = useNavigate();
  const club = organizations.find((o) => o.id === id);
  if (!club)
    return (
      <Empty
        title="This club is not in the directory"
        action={<LinkButton to="/clubs">Discover clubs</LinkButton>}
      />
    );
  const data = allClubs[club.id];
  return (
    <div className="public-detail">
      <PublicHeader />
      <main>
        <Link to="/clubs" className="text-link">
          <Icon name="ArrowLeft" size={16} />
          All communities
        </Link>
        <div className="public-club-hero">
          <Badge tone={club.accent}>STUDENT-LED COMMUNITY</Badge>
          <h1>{club.name}</h1>
          <p>{club.description}</p>
          <button
            className="button primary"
            onClick={() => {
              selectClub(club.id);
              navigate(signedIn ? '/app' : '/login');
            }}
          >
            Open this community
            <Icon name="ArrowRight" size={17} />
          </button>
          <LinkButton to={`/shop?club=${club.id}`} variant="secondary" icon="ShoppingBag">
            Explore the collection
          </LinkButton>
        </div>
        <div className="public-club-stats">
          <div>
            <strong>{data.members.length}</strong>
            <span>members finding their place</span>
          </div>
          <div>
            <strong>{data.events.length}</strong>
            <span>moments on the calendar</span>
          </div>
          <div>
            <strong>₹500</strong>
            <span>annual membership</span>
          </div>
        </div>
        <CardHeader
          title="Events and memories"
          subtitle="Everyone is welcome. Members enjoy a little extra."
        />
        <div className="event-grid">
          {data.events.map((e) => (
            <article className="event-card" key={e.id}>
              <Link to={`/e/${club.id}/${e.id}`} className="event-image">
                <img src={e.image} alt={`${e.title} event`} />
              </Link>
              <div className="event-card-content">
                <Badge tone={eventPhase(e) === "past" ? "gold" : "teal"}>{eventPhase(e) === "past" ? "Past event" : eventPhase(e) === "ongoing" ? "Happening now" : e.category}</Badge>
                <h2>
                  <Link to={`/e/${club.id}/${e.id}`}>{e.title}</Link>
                </h2>
                <p>
                  <Icon name="CalendarDays" size={16} />
                  {date(e.date)} · {e.time}
                </p>
                <p>
                  <Icon name="MapPin" size={16} />
                  {e.venue}
                </p>
                <div className="event-card-footer">
                  <span>
                    <strong>{e.price ? `From ${money(e.memberPrice)}` : 'Free entry'}</strong>
                  </span>
                  <LinkButton to={`/e/${club.id}/${e.id}`} variant="secondary" icon="ArrowUpRight">
                    View event
                  </LinkButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
function PublicHeader() { return <PublicNav />; }
export default function AppRouter() {
  return (
    <PageMotion><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/welcome" element={<Navigate to="/" replace />} />
      <Route path="/events" element={<EventDiscovery publicView />} />
      <Route path="/clubs" element={<ClubsPage />} />
      <Route path="/shop" element={<ShopPage publicView />} />
      <Route path="/clubs/:id" element={<PublicClub />} />
      <Route path="/e/:clubId/:id" element={<EventExperience publicView />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/app/*" element={<Workspace />} />
      {[
        'members',
        'finance',
        'merchandise',
        'tasks',
        'announcements',
        'settings',
        'calendar',
        'check-in',
      ].map((p) => (
        <Route key={p} path={`/${p}`} element={<Navigate to={`/app/${p}`} replace />} />
      ))}
      <Route
        path="*"
        element={
          <div className="public-not-found">
            <h1>Let’s get you back to your people.</h1>
            <p>This page does not exist.</p>
            <LinkButton to="/" icon="ArrowLeft">
              Back to Skyline
            </LinkButton>
          </div>
        }
      />
    </Routes></PageMotion>
  );
}
