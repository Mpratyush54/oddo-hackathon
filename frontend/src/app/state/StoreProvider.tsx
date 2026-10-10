import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { backendPost, backendRequest, cloudMode } from '../../shared/api/client';
import { actionFromChange } from './commands';
import type { ReactNode } from 'react';
import type { Transaction, Organization, AuditEntry, Store } from '../../shared/types/domain';
import { date, uid } from '../../shared/utils/format';
import { seed, organizations, makeClub, enrichEventHistory } from '../../demo/data/clubs';

export type Registry = { selectedClub: string; clubs: Record<string, Store> };

export type ContextValue = {
  data: Store;
  update: (fn: (current: Store) => Store) => void;
  applyServerPatch: (clubId: string, patch: Partial<Store>) => void;
  toast: (message: string) => void;
  toastMessage: string;
  clearToast: () => void;
  organizations: Organization[];
  allClubs: Record<string, Store>;
  selectedClub: string;
  selectClub: (id: string) => void;
  setActor: (name: string) => void;
};

export const StoreContext = createContext<ContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Registry>(() => {
    if (cloudMode)
      return {
        selectedClub: 'skyline',
        clubs: Object.fromEntries(
          organizations.map((o) => {
            const club = makeClub(o.id);
            return [
              o.id,
              {
                ...club,
                events: club.events.map((e) => ({ ...e, sold: 0 })),
                members: [],
                transactions: [],
                tasks: [],
                announcements: [],
                tickets: [],
                orders: [],
                waitlist: [],
                audit: [],
                notifications: [],
                deliveries: [],
                eventReviews: [],
                pointLedger: [],
              },
            ];
          }),
        ),
      };
    try {
      const saved = localStorage.getItem('skyline-v2');
      if (saved) {
        const parsed = JSON.parse(saved) as Registry;
        if (parsed.clubs && organizations.every((o) => parsed.clubs[o.id])) {
          for (const club of Object.values(parsed.clubs))
            club.transactions = club.transactions.map((t) => ({
              ...t,
              createdBy: club.members.find((m) => m.name === t.createdBy)?.id || t.createdBy,
            }));
          for (const [clubId, club] of Object.entries(parsed.clubs)) {
            club.promos ??= structuredClone(seed.promos || []);
            club.pointLedger ??= [];
            club.products = club.products.map((p, i) => ({
              ...p,
              image: p.image || seed.products[i]?.image || seed.products[0]?.image,
            }));
            club.members = club.members.map((m) => ({
              ...m,
              participationPoints: m.participationPoints ?? 0,
              volunteerPoints: m.volunteerPoints ?? 0,
              contributionPoints: m.contributionPoints ?? 0,
            }));
            enrichEventHistory(club, clubId);
          }
          return parsed;
        }
      }
    } catch {
      /* Start with a consistent demo if storage is unavailable or invalid. */
    }
    return {
      selectedClub: 'skyline',
      clubs: Object.fromEntries(
        organizations.map((o) => [o.id, enrichEventHistory(makeClub(o.id), o.id)]),
      ),
    };
  });
  const [actor, setActor] = useState('Alex Morgan');
  const data = registry.clubs[registry.selectedClub] || registry.clubs.skyline;
  const [toastMessage, setToastMessage] = useState('');
  useEffect(() => {
    if (cloudMode) return;
    try {
      localStorage.setItem('skyline-v2', JSON.stringify(registry));
    } catch {
      setToastMessage('Your browser could not save changes. Check your storage settings.');
    }
  }, [registry]);
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
  const scope = registry.selectedClub;
  const [authenticated, setAuthenticated] = useState(false);
  const pending = useRef(Promise.resolve());
  useEffect(() => {
    if (!cloudMode) return;
    const authChanged = (event: Event) => {
      const signedIn = !!(event as CustomEvent).detail;
      setAuthenticated(signedIn);
      if (!signedIn)
        void backendRequest<{ clubs: Record<string, Store> }>('/public/clubs').then((result) =>
          setRegistry((r) => ({ ...r, clubs: result.clubs })),
        );
    };
    window.addEventListener('skyline-auth-changed', authChanged);
    return () => window.removeEventListener('skyline-auth-changed', authChanged);
  }, []);
  useEffect(() => {
    if (!cloudMode) return;
    let active = true;
    const refresh = async () => {
      try {
        if (authenticated) {
          const result = await backendRequest<{ state: Store }>(`/clubs/${scope}/state`);
          if (active) setRegistry((r) => ({ ...r, clubs: { ...r.clubs, [scope]: result.state } }));
        } else {
          const result = await backendRequest<{ clubs: Record<string, Store> }>('/public/clubs');
          if (active) setRegistry((r) => ({ ...r, clubs: result.clubs }));
        }
      } catch (error) {
        if (active)
          setToastMessage(error instanceof Error ? error.message : 'Could not load campus data.');
      }
    };
    void refresh();
    window.addEventListener('skyline-data-changed', refresh);
    const timer = authenticated
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') void refresh();
        }, 30000)
      : undefined;
    const onVisible = () => {
      if (authenticated && document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.removeEventListener('skyline-data-changed', refresh);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [scope, authenticated]);
  const localUpdate = (fn: (current: Store) => Store) =>
    setRegistry((current) => {
      const before = current.clubs[scope];
      const after = fn(before);
      const entries: AuditEntry[] = [];
      after.transactions = after.transactions.map((t) => ({
        ...t,
        createdBy: after.members.find((m) => m.name === t.createdBy)?.id || t.createdBy,
      }));
      const entities = [
        'members',
        'events',
        'transactions',
        'tickets',
        'orders',
        'tasks',
        'announcements',
      ] as const;
      for (const entity of entities) {
        const prior = before[entity] as { id: string }[];
        const next = after[entity] as { id: string }[];
        for (const item of next) {
          const previous = prior.find((p) => p.id === item.id);
          if (JSON.stringify(previous) !== JSON.stringify(item)) {
            const record = item as Record<string, unknown>;
            const action = previous
              ? entity === 'transactions' &&
                record.status === 'Completed' &&
                (previous as Transaction).status === 'Pending'
                ? 'Approved'
                : entity === 'transactions' && record.status === 'Rejected'
                  ? 'Rejected'
                  : 'Updated'
              : 'Created';
            entries.push({
              id: uid('AUD'),
              actor,
              action,
              entity,
              entityId: item.id,
              date: new Date().toISOString(),
              detail:
                String(record.title || record.name || record.id) +
                (record.rejectionReason ? ` · ${record.rejectionReason}` : ''),
            });
          }
        }
      }
      return {
        ...current,
        clubs: {
          ...current.clubs,
          [scope]: { ...after, audit: [...entries, ...after.audit].slice(0, 500) },
        },
      };
    });
  const update = (fn: (current: Store) => Store) => {
    if (!cloudMode) {
      localUpdate(fn);
      return;
    }
    try {
      const action = actionFromChange(data, fn(structuredClone(data)));
      if (!action) return;
      const request = { ...action, idempotencyKey: crypto.randomUUID() };
      pending.current = pending.current
        .then(async () => {
          const result = await backendPost<{ state: Store }>(`/clubs/${scope}/actions`, request);
          setRegistry((current) => ({
            ...current,
            clubs: { ...current.clubs, [scope]: result.state },
          }));
          setToastMessage(
            action.type === 'membership.demo-dues'
              ? 'Membership is now active.'
              : action.type === 'profile.preferences'
                ? 'Preferences saved.'
                : action.type === 'membership.join'
                  ? 'Club joined. Your membership is pending dues.'
                  : 'Changes saved.',
          );
        })
        .catch((error) => setToastMessage(error.message));
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'This action could not be saved.');
    }
  };
  const selectClub = (id: string) => {
    if (organizations.some((o) => o.id === id)) setRegistry((r) => ({ ...r, selectedClub: id }));
  };
  const applyServerPatch = (clubId: string, patch: Partial<Store>) => {
    if (!organizations.some((o) => o.id === clubId) || !patch) return;
    setRegistry((current) => {
      const before = current.clubs[clubId];
      if (!before) return current;
      return {
        ...current,
        clubs: {
          ...current.clubs,
          [clubId]: { ...before, ...patch },
        },
      };
    });
  };
  return (
    <StoreContext.Provider
      value={{
        data,
        update,
        applyServerPatch,
        toast: setToastMessage,
        toastMessage,
        clearToast: () => setToastMessage(''),
        organizations,
        allClubs: registry.clubs,
        selectedClub: registry.selectedClub,
        selectClub,
        setActor,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('StoreProvider is required');
  return context;
};
