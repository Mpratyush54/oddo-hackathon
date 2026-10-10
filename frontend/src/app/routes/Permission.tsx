import type { ReactNode } from 'react';
import { Icon } from '../../shared/ui/Icon';
import { LinkButton } from '../../shared/ui/LinkButton';
import { useSession } from '../../features/auth/session';
import '../layout/workspace.css';

export function Permission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useSession();
  return can(permission) ? children : <Unauthorized />;
}

export function Unauthorized() {
  return (
    <section className="card access-state">
      <span className="icon-tile">
        <Icon name="ShieldCheck" size={32} />
      </span>
      <h1>This view belongs to another responsibility.</h1>
      <p>
        Your current role does not have access to this page. Choose your own workspace or another
        clearly labelled demo persona.
      </p>
      <LinkButton to="/app" icon="ArrowLeft">
        Back to my workspace
      </LinkButton>
    </section>
  );
}
