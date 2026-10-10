import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import '../../../app/layout/workspace.css';

export function PersonalTasks() {
  const { data, update, toast } = useStore();
  const { user } = useSession();
  const tasks = data.tasks.filter((t) => t.assignee === user.name);
  return (
    <>
      <PageHeader
        title="Your part in the bigger picture"
        eyebrow="YOUR VOLUNTEER WORK"
        description="A clear next step, and a team counting on you."
      />
      <div className="personal-task-grid">
        {tasks.map((t) => (
          <section className="card" key={t.id}>
            <Badge tone={t.status === 'Done' ? 'green' : 'gold'}>{t.status}</Badge>
            <h2>{t.title}</h2>
            <p>{t.description}</p>
            <small>
              Due {date(t.due)} · {t.priority} priority
            </small>
            <Button
              icon={t.status === 'Done' ? 'CircleCheck' : 'Check'}
              disabled={t.status === 'Done'}
              onClick={() => {
                update((d) => ({
                  ...d,
                  tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, status: 'Done' } : x)),
                }));
                toast('Your task is complete. Thanks for showing up.');
              }}
            >
              Mark complete
            </Button>
          </section>
        ))}
      </div>
      {!tasks.length && (
        <Empty
          title="A little room for something new"
          description="Your assigned tasks will appear here."
        />
      )}
    </>
  );
}
