import { Navigate, Route, Routes } from 'react-router-dom';
import { LinkButton } from '../../shared/ui/LinkButton';
import Workspace from '../layout/Workspace';
import { EventDiscovery } from '../../features/events/pages/EventDiscovery';
import EventExperience from '../../features/events/pages/EventExperience';
import { PageMotion } from '../../shared/components/PageMotion';
import { ShopPage } from '../../features/shop/pages/Shop';
import { AuthPage } from '../../features/auth/pages/AuthPage';
import { ClubsPage } from '../../features/clubs/pages/ClubsPage';
import { LandingPage } from '../../features/landing/pages/LandingPage';
import { PublicClub } from '../../features/clubs/pages/PublicClub';

export default function AppRouter() {
  return (
    <PageMotion>
      <Routes>
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
      </Routes>
    </PageMotion>
  );
}
