import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from './store';
import { backendPost, backendRequest, cloudMode, setCsrf } from './backend';
export type Role = 'member' | 'organizer' | 'treasurer' | 'admin' | 'college';
export const roleLabels: Record<Role, string> = {
  member: 'Student & volunteer',
  organizer: 'Event organizer',
  treasurer: 'Club treasurer',
  admin: 'Club administrator',
  college: 'College administrator',
};
export const personas: Record<Role, { id: string; name: string; email: string }> = {
  member: { id: 'MEM-005', name: 'Aisha Patel', email: 'aisha@skyline.edu' },
  organizer: { id: 'MEM-003', name: 'Jordan Lee', email: 'jordan@skyline.edu' },
  treasurer: { id: 'MEM-002', name: 'Priya Sharma', email: 'priya@skyline.edu' },
  admin: { id: 'MEM-001', name: 'Alex Morgan', email: 'alex@skyline.edu' },
  college: { id: 'FAC-001', name: 'Dr. Kavya Rao', email: 'kavya@skyline.edu' },
};
type Session = {
  ready: boolean;
  reloadAuth: () => Promise<void>;
  role: Role;
  signedIn: boolean;
  user: { id: string; name: string; email: string };
  clubId: string;
  clubs: ReturnType<typeof useStore>['organizations'];
  selectClub: (id: string) => void;
  switchPersona: (role: Role) => void;
  signOut: () => void;
  can: (permission: string) => boolean;
};
const permissions: Record<Role, string[]> = {
  member: ['request_expense', 'shop', 'book_ticket', 'own_tasks'],
  organizer: [
    'request_expense',
    'shop',
    'book_ticket',
    'own_tasks',
    'manage_events',
    'check_in',
    'publish_announcement',
    'manage_tasks',
    'manage_orders',
  ],
  treasurer: [
    'request_expense',
    'shop',
    'book_ticket',
    'view_finance',
    'record_income',
    'approve_expense',
    'audit',
    'manage_orders',
  ],
  admin: [
    'request_expense',
    'shop',
    'book_ticket',
    'own_tasks',
    'manage_events',
    'check_in',
    'publish_announcement',
    'manage_tasks',
    'manage_orders',
    'manage_members',
    'view_finance',
    'record_income',
    'approve_expense',
    'audit',
    'manage_inventory',
  ],
  college: ['college_overview', 'manage_clubs'],
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  return cloudMode ? <CloudSessionProvider>{children}</CloudSessionProvider> : <DemoSessionProvider>{children}</DemoSessionProvider>;
}
function DemoSessionProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [session, setSession] = useState<{ role: Role; signedIn: boolean }>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('skyline-session') || 'null');
      if (s && s.role in personas) return s;
    } catch {
      /*Start signed out.*/
    }
    return { role: 'admin', signedIn: false };
  });
  const user = personas[session.role];
  useEffect(() => {
    localStorage.setItem('skyline-session', JSON.stringify(session));
    store.setActor(user.name);
  }, [session, user.name, store.setActor]);
  return (
    <Context.Provider
      value={{
        ready: true,
        reloadAuth: async () => {},
        ...session,
        user,
        clubId: store.selectedClub,
        clubs: store.organizations,
        selectClub: store.selectClub,
        switchPersona: (role) => setSession({ role, signedIn: true }),
        signOut: () => setSession((s) => ({ ...s, signedIn: false })),
        can: (permission) => session.signedIn && permissions[session.role].includes(permission),
      }}
    >
      {children}
    </Context.Provider>
  );
}
function CloudSessionProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [account, setAccount] = useState<{ user: Session['user']; roles: Record<string, Role> } | null>(null);
  const [ready, setReady] = useState(false);
  const reloadAuth = async () => {
    try {
      const result = await backendRequest<{ user: Session['user']; roles: Record<string, Role>; csrfToken: string }>('/auth/me');
      setCsrf(result.csrfToken); setAccount(result);
      window.dispatchEvent(new CustomEvent('skyline-auth-changed', { detail: true }));
    } catch { setAccount(null); window.dispatchEvent(new CustomEvent('skyline-auth-changed', { detail: false })); }
    finally { setReady(true); }
  };
  useEffect(() => {
    void reloadAuth();
    const expired = () => { setAccount(null); window.dispatchEvent(new CustomEvent('skyline-auth-changed', { detail: false })); };
    window.addEventListener('skyline-session-expired', expired);
    return () => window.removeEventListener('skyline-session-expired', expired);
  }, []);
  const role = account?.roles[store.selectedClub] || 'member';
  const user = account?.user || { id: '', name: '', email: '' };
  useEffect(() => { store.setActor(user.name); }, [user.name, store.setActor]);
  return <Context.Provider value={{ ready, reloadAuth, role, signedIn: !!account, user, clubId: store.selectedClub, clubs: store.organizations, selectClub: store.selectClub,
    switchPersona: () => store.toast('Roles are assigned by the campus administrator.'),
    signOut: () => { void backendPost('/auth/logout', {}).then(() => { setCsrf(''); setAccount(null); window.dispatchEvent(new CustomEvent('skyline-auth-changed', { detail: false })); }).catch(error => store.toast(error.message)); },
    can: permission => !!account && permissions[role].includes(permission),
  }}>{children}</Context.Provider>;
}
export function useSession() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('SessionProvider required');
  return ctx;
}
