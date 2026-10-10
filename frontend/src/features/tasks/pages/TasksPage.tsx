import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { FormFooter } from '../../../shared/ui/FormFooter';
import { Icon } from '../../../shared/ui/Icon';
import { Modal } from '../../../shared/ui/Modal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Progress } from '../../../shared/ui/Progress';
import { formValues } from '../../../shared/ui/formValues';
import { Revealed } from '../../../shared/components/PageMotion';
import { date, today, uid } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import type { Task } from '../../../shared/types/domain';

export function TasksPage() {
  const { data, update, toast } = useStore();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(params.get('create') === 'true'),
    [view, setView] = useState('board'),
    [editing, setEditing] = useState<Task | null>(null),
    [dragged, setDragged] = useState<string | null>(null),
    [dropTarget, setDropTarget] = useState<Task['status'] | null>(null);
  const close = useCallback(() => {
    setAdding(false);
    setEditing(null);
    setParams({}, { replace: true });
  }, [setParams]);
  const statuses: Task['status'][] = ['To do', 'In progress', 'Done'];
  const completed = data.tasks.filter((t) => t.status === 'Done').length;
  const changeStatus = (id: string, status: Task['status']) => {
    update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }));
    toast(`Task moved to ${status.toLowerCase()}.`);
  };
  const renderTask = (task: Task) => {
    const isOverdue = new Date(task.due) < new Date(today) && task.status !== 'Done';
    const nextStatus =
      task.status === 'To do' ? 'In progress' : task.status === 'In progress' ? 'Done' : null;
    const prevStatus =
      task.status === 'Done' ? 'In progress' : task.status === 'In progress' ? 'To do' : null;

    return (
      <article
        key={task.id}
        className={`task-card project-wall-card ${dragged === task.id ? 'is-dragging' : ''}`}
        draggable
        onDragStart={(e) => {
          setDragged(task.id);
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          setDragged(null);
          setDropTarget(null);
        }}
      >
        <div className="task-top">
          <Badge
            tone={task.priority === 'High' ? 'red' : task.priority === 'Medium' ? 'gold' : 'teal'}
          >
            {task.priority}
          </Badge>
          <button
            className="plain-icon task-edit-trigger"
            aria-label={`Edit ${task.title}`}
            title="Edit task"
            onClick={() => setEditing(task)}
          >
            <Icon name="Pencil" size={13} />
          </button>
        </div>
        <h3 className="task-headline">
          <button className="plain-text" onClick={() => setEditing(task)}>
            {task.title}
          </button>
        </h3>
        {task.description && <p className="task-notes">{task.description}</p>}
        <div className="task-meta">
          <div className="task-person">
            <Avatar
              name={task.assignee}
              small
              index={data.members.findIndex((m) => m.name === task.assignee)}
            />
            <span>{task.assignee}</span>
          </div>
          <span className={`task-deadline ${isOverdue ? 'is-overdue' : ''}`}>
            <Icon name="CalendarDays" size={12} />
            {date(task.due, { day: 'numeric', month: 'short' })}
            {isOverdue && <span className="overdue-tag">Due</span>}
          </span>
        </div>
        <div className="task-actions-row">
          {prevStatus && (
            <button
              type="button"
              className="task-step-btn prev"
              onClick={() => changeStatus(task.id, prevStatus)}
              title={`Move back to ${prevStatus}`}
            >
              ← {prevStatus}
            </button>
          )}
          {nextStatus && (
            <button
              type="button"
              className="task-step-btn next"
              onClick={() => changeStatus(task.id, nextStatus)}
              title={`Advance to ${nextStatus}`}
            >
              {nextStatus} →
            </button>
          )}
        </div>
      </article>
    );
  };
  return (
    <>
      <PageHeader
        eyebrow="CAMPUS PROJECT WALL"
        title="Projects & tasks"
        description="Big ideas become real, one small task at a time."
        action={
          <Button icon="Plus" onClick={() => setAdding(true)}>
            Create task
          </Button>
        }
      />
      <Revealed delay={40}>
        <section className="project-hero dark-card">
          <span className="project-hero-icon">
            <Icon name="Cookie" size={37} />
          </span>
          <div>
            <div className="hero-eyebrow">COMMUNITY FUNDRAISER</div>
            <h2>Bake a difference</h2>
            <p>Good bakes. Great people. A little good for our community.</p>
            <div className="project-hero-meta">
              <span>
                <Icon name="CalendarDays" size={15} />
                16 October 2026
              </span>
              <span>
                <Icon name="MapPin" size={15} />
                Student Union Courtyard
              </span>
              <span className="avatar-stack">
                {data.members.slice(0, 4).map((m, i) => (
                  <Avatar name={m.name} small index={i} key={m.id} />
                ))}
              </span>
            </div>
          </div>
          <div className="project-progress">
            <Badge tone="green">On track</Badge>
            <strong>{Math.round((completed / Math.max(data.tasks.length, 1)) * 100)}%</strong>
            <span>
              {completed} of {data.tasks.length} tasks complete
            </span>
            <Progress value={(completed / Math.max(data.tasks.length, 1)) * 100} />
          </div>
        </section>
      </Revealed>

      <Revealed delay={70}>
        <div className="board-toolbar">
          <div className="segmented">
            <button className={view === 'board' ? 'selected' : ''} onClick={() => setView('board')}>
              <Icon name="Columns3" size={16} />
              Board view
            </button>
            <button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}>
              <Icon name="List" size={16} />
              List view
            </button>
          </div>
          <span className="muted">
            <Icon name="Grip" size={15} />
            Drag tasks between columns or use the step buttons to update progress
          </span>
        </div>
        {view === 'board' ? (
          <div className="kanban-board project-wall-board">
            {statuses.map((status, i) => {
              const isTarget = dropTarget === status;
              return (
                <section
                  key={status}
                  className={`kanban-column ${dragged ? 'drop-ready' : ''} ${isTarget ? 'drop-active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dropTarget !== status) setDropTarget(status);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (dropTarget === status) setDropTarget(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain') || dragged;
                    if (id && data.tasks.some((t) => t.id === id)) {
                      changeStatus(id, status);
                    }
                    setDragged(null);
                    setDropTarget(null);
                  }}
                >
                  <div className="column-heading">
                    <span className={`legend-dot ${['gold', 'teal', 'green'][i]}`} />
                    <h2>{status}</h2>
                    <span className="column-count">
                      {data.tasks.filter((t) => t.status === status).length}
                    </span>
                    <button
                      className="plain-icon"
                      aria-label={`Add ${status} task`}
                      onClick={() => setAdding(true)}
                    >
                      <Icon name="Plus" size={18} />
                    </button>
                  </div>
                  {data.tasks.filter((t) => t.status === status).map(renderTask)}
                  {isTarget && dragged && (
                    <div className="kanban-drop-placeholder">
                      <span>Drop here</span>
                    </div>
                  )}
                  {!data.tasks.some((t) => t.status === status) && !isTarget && (
                    <div className="empty-column">Drop a task here</div>
                  )}
                  <button className="add-task-inline" onClick={() => setAdding(true)}>
                    <Icon name="Plus" size={16} />
                    Add a task
                  </button>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="task-list-view">{data.tasks.map(renderTask)}</div>
        )}
      </Revealed>
      {(adding || editing) && (
        <Modal
          title={editing ? 'A little task update' : 'Make a little progress'}
          description="Give a task a name, an owner, and a little room to grow."
          onClose={close}
        >
          <form
            onSubmit={(e) => {
              const f = formValues(e);
              const task: Task = {
                id: editing?.id || uid('TASK'),
                title: f.title.trim(),
                description: f.description,
                assignee: f.assignee,
                due: f.due,
                priority: f.priority,
                status: f.status as Task['status'],
              };
              update((d) => ({
                ...d,
                tasks: editing
                  ? d.tasks.map((t) => (t.id === editing.id ? task : t))
                  : [...d.tasks, task],
              }));
              close();
              toast(
                editing
                  ? 'Task updated. Keep it going!'
                  : 'A new task, a little closer to the goal.',
              );
            }}
          >
            <Field label="Task title">
              <input
                name="title"
                required
                defaultValue={editing?.title}
                placeholder="What needs doing?"
                maxLength={100}
              />
            </Field>
            <Field label="A little context">
              <textarea
                name="description"
                rows={3}
                defaultValue={editing?.description}
                placeholder="Details that help your team..."
              />
            </Field>
            <Field label="Assigned to">
              <select name="assignee" defaultValue={editing?.assignee}>
                {data.members.map((m) => (
                  <option key={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
            <div className="form-two">
              <Field label="Due date">
                <input
                  type="date"
                  name="due"
                  required
                  defaultValue={editing?.due || '2026-10-16'}
                />
              </Field>
              <Field label="Priority">
                <select name="priority" defaultValue={editing?.priority || 'Medium'}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </Field>
            </div>
            <Field label="Status">
              <select name="status" defaultValue={editing?.status || 'To do'}>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <FormFooter onClose={close} label={editing ? 'Save task' : 'Create task'} />
          </form>
        </Modal>
      )}
    </>
  );
}
