import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { FormFooter } from '../../../shared/ui/FormFooter';
import { Icon } from '../../../shared/ui/Icon';
import { Modal } from '../../../shared/ui/Modal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { SearchField } from '../../../shared/ui/SearchField';
import { formValues } from '../../../shared/ui/formValues';
import { date, exportCSV, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';

export function AnnouncementsPage() {
  const { data, update, toast } = useStore();
  const [params, setParams] = useSearchParams();
  const [compose, setCompose] = useState(params.get('create') === 'true'),
    [search, setSearch] = useState(''),
    [audience, setAudience] = useState('All');
  const close = useCallback(() => {
    setCompose(false);
    setParams({}, { replace: true });
  }, [setParams]);
  const filtered = data.announcements.filter(
    (a) =>
      `${a.title} ${a.body}`.toLowerCase().includes(search.toLowerCase()) &&
      (audience === 'All' || a.audience === audience),
  );
  return (
    <>
      <PageHeader
        eyebrow="KEEP EVERYONE IN THE LOOP"
        title="A word to the community"
        description="One message. Everyone connected. Nothing lost in the group chat."
        action={
          <Button icon="PenLine" onClick={() => setCompose(true)}>
            Write announcement
          </Button>
        }
      />
      <div className="announcement-layout">
        <div>
          <div className="announcement-toolbar">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search announcements..."
            />
            <select
              value={audience}
              aria-label="Filter audience"
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="All">Every audience</option>
              <option>All members</option>
              <option>Volunteers</option>
              <option>Leadership team</option>
            </select>
          </div>
          <div className="announcement-feed">
            {filtered.map((a, i) => (
              <article className="card announcement-card" key={a.id}>
                <div className="announcement-meta">
                  <Avatar name={a.author} index={i} />
                  <div>
                    <strong>{a.author}</strong>
                    <small>
                      {date(a.date)} · {a.audience}
                    </small>
                  </div>
                  <span className="announcement-channel">
                    <Icon name={a.email ? 'Mail' : 'Globe'} size={16} />
                    {a.email ? 'Web + email draft' : 'Website'}
                  </span>
                </div>
                <h2>{a.title}</h2>
                <p className="announcement-body">{a.body}</p>
                <div className="announcement-footer">
                  <Badge tone="green">Published</Badge>
                  <span>
                    <Icon name="Eye" size={15} />
                    {a.read} reads
                  </span>
                  {a.email && (
                    <button
                      className="text-link"
                      onClick={() => {
                        exportCSV(`announcement-${a.id}-email-list.csv`, [
                          ['Email', 'Name'],
                          ...data.members
                            .filter(
                              (m) =>
                                a.audience === 'All members' ||
                                (a.audience === 'Volunteers'
                                  ? m.role === 'Volunteer'
                                  : ['President', 'Treasurer', 'Events lead'].includes(m.role)),
                            )
                            .map((m) => [m.email, m.name]),
                        ]);
                        toast('Audience email list exported.');
                      }}
                    >
                      Export audience <Icon name="Download" size={14} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <Empty
              title="No announcements found"
              description="Try a different search, or write something new."
            />
          )}
        </div>
        <aside>
          <section className="dark-card communication-aside">
            <Icon name="Megaphone" size={36} />
            <h2>Good news travels together.</h2>
            <p>
              Updates, invitations, little reminders. Give your community one place to stay in the
              loop.
            </p>
            <div>
              <strong>{data.announcements.length}</strong>
              <span>community updates</span>
            </div>
            <div>
              <strong>{data.members.length}</strong>
              <span>people to connect with</span>
            </div>
          </section>
          <div className="card note-card">
            <Icon name="Lightbulb" size={23} />
            <h3>A thoughtful little tip</h3>
            <p>
              Keep announcements short, add the details people need, and end with a clear next step.
            </p>
          </div>
        </aside>
      </div>
      {compose && (
        <Modal
          title="Something to share?"
          description="A little message can make a big difference."
          onClose={close}
          wide
        >
          <form
            onSubmit={(e) => {
              const f = formValues(e);
              update((d) => ({
                ...d,
                announcements: [
                  {
                    id: uid('ANN'),
                    title: f.title.trim(),
                    body: f.body.trim(),
                    audience: f.audience,
                    author: d.profile.name,
                    date: today,
                    read: 0,
                    email: f.email === 'on',
                  },
                  ...d.announcements,
                ],
              }));
              close();
              toast('Your announcement is live on the community board.');
            }}
          >
            <Field label="Give it a title">
              <input name="title" required placeholder="What’s the good news?" maxLength={130} />
            </Field>
            <Field label="Your message">
              <textarea
                name="body"
                required
                rows={7}
                placeholder="Tell your community what’s happening..."
                maxLength={5000}
              />
            </Field>
            <Field label="Who is it for?">
              <select name="audience">
                <option>All members</option>
                <option>Volunteers</option>
                <option>Leadership team</option>
              </select>
            </Field>
            <label className="check-label">
              <input type="checkbox" name="email" defaultChecked />
              Prepare an email audience list
            </label>
            <p className="form-note">
              Announcements publish to this workspace. Export the audience list to use with your
              mailing service; email delivery is not connected yet.
            </p>
            <FormFooter onClose={close} label="Publish announcement" />
          </form>
        </Modal>
      )}
    </>
  );
}
