import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { money } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import '../../../app/layout/workspace.css';

export function CollegeRegistry() {
  const { organizations, allClubs, selectClub } = useStore();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow="CAMPUS ADMINISTRATION"
        title="Student organization registry"
        description="Independent clubs. One connected campus."
      />
      <section className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Memberships</th>
                <th>Events</th>
                <th>Recorded balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.name}</strong>
                    <small className="cell-subtext">{o.description.slice(0, 70)}</small>
                  </td>
                  <td>{allClubs[o.id].members.length}</td>
                  <td>{allClubs[o.id].events.length}</td>
                  <td>
                    {money(
                      allClubs[o.id].transactions
                        .filter((t) => t.status === 'Completed')
                        .reduce((s, t) => s + t.amount, 0),
                    )}
                  </td>
                  <td>
                    <Badge tone="green">Registered</Badge>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      icon="ArrowUpRight"
                      onClick={() => {
                        selectClub(o.id);
                        navigate('/app/club-summary');
                      }}
                    >
                      Review summary
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="info-banner">
        <Icon name="ShieldCheck" />
        <p>
          College administrators see organization summaries. Personal receipts and membership
          details stay within authorized club workspaces.
        </p>
      </div>
    </>
  );
}
