import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useSession } from '../../auth/session';
import { backendPost, cloudMode } from '../../../shared/api/client';
import type { Project, Store, Task } from '../../../shared/types/domain';

const OPS_PROJECT = 'PROJ-OPS';
const TASK_MANAGERS = new Set(['admin', 'organizer', 'treasurer']);

type ProjectCard = {
  id: string;
  title: string;
  description: string;
  date?: string;
  venue?: string;
  eventId?: string;
  icon: string;
  eyebrow: string;
};

export function TasksPage() {
  const { data, update, toast, applyServerPatch, selectedClub } = useStore();
  const { user, can, role } = useSession();
  const manage = TASK_MANAGERS.has(role) || can('manage_tasks');
  const [params, setParams] = useSearchParams();
  const projects = useMemo<ProjectCard[]>(() => {
    const customProjects = (data.projects || []).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description || 'Custom project board for your club team.',
      date: p.date,
      icon: p.icon || 'Flag',
      eyebrow: 'PROJECT',
    }));
    const eventProjects = data.events
      .filter((e) => e.id !== 'EVT-WELCOME-2026' || data.tasks.some((t) => t.eventId === e.id))
      .map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description || 'Event project board for volunteers and organizers.',
        date: e.date,
        venue: e.venue,
        eventId: e.id,
        icon:
          e.category === 'Fundraiser'
            ? 'Cookie'
            : e.category === 'Workshop'
              ? 'Sparkles'
              : e.category === 'Meeting'
                ? 'Coffee'
                : 'CalendarDays',
        eyebrow: (e.category || 'Event').toUpperCase(),
      }));
    return [
      {
        id: OPS_PROJECT,
        title: 'Club operations',
        description: 'Standing work for membership, merch desk, and day-to-day club running.',
        icon: 'PanelsTopLeft',
        eyebrow: 'ALWAYS ON',
      },
      ...customProjects,
      ...eventProjects,
    ];
  }, [data.events, data.tasks, data.projects]);
  const urlProject = params.get('project');
  const initialProject =
    urlProject && projects.some((p) => p.id === urlProject)
      ? urlProject
      : projects.find((p) => p.id === 'EVT-002')?.id || projects[0]?.id || OPS_PROJECT;
  const [projectId, setProjectId] = useState(initialProject);
  const [adding, setAdding] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Task['status'] | null>(null);

  useEffect(() => {
    if (urlProject && projects.some((p) => p.id === urlProject) && urlProject !== projectId) {
      setProjectId(urlProject);
    }
  }, [urlProject, projects, projectId]);

  useEffect(() => {
    if (!manage) return;
    if (params.get('createProject') === 'true') {
      setAddingProject(true);
      setAdding(false);
    } else if (params.get('create') === 'true') {
      setAdding(true);
      setAddingProject(false);
    }
  }, [manage, params]);

  const project = projects.find((p) => p.id === projectId) || projects[0];
  const projectTasks = data.tasks.filter(
    (t) => (t.projectId || t.eventId || OPS_PROJECT) === project.id,
  );
  const completed = projectTasks.filter((t) => t.status === 'Done').length;
  const team = [
    ...new Map(
      projectTasks.filter((t) => t.assignee).map((t) => [t.assignee, t.assignee] as const),
    ).values(),
  ].slice(0, 6);
  const openCount = projectTasks.filter((t) => !t.assignee).length;

  const close = useCallback(() => {
    setAdding(false);
    setAddingProject(false);
    setEditing(null);
    setParams(projectId ? { project: projectId } : {}, { replace: true });
  }, [setParams, projectId]);

  const openCreate = useCallback(() => {
    if (!manage) {
      toast('Only the club administrator, organizers, or treasurer can create tasks.');
      return;
    }
    setEditing(null);
    setAddingProject(false);
    setAdding(true);
    setParams({ project: projectId, create: 'true' }, { replace: true });
  }, [manage, projectId, setParams, toast]);

  const openCreateProject = useCallback(() => {
    if (!manage) {
      toast('Only the club administrator, organizers, or treasurer can create projects.');
      return;
    }
    setEditing(null);
    setAdding(false);
    setAddingProject(true);
    setParams(
      projectId ? { project: projectId, createProject: 'true' } : { createProject: 'true' },
      { replace: true },
    );
  }, [manage, projectId, setParams, toast]);

  const selectProject = (id: string) => {
    setProjectId(id);
    if (addingProject) setParams({ project: id, createProject: 'true' }, { replace: true });
    else if (adding) setParams({ project: id, create: 'true' }, { replace: true });
    else setParams({ project: id }, { replace: true });
  };

  const statuses: Task['status'][] = ['To do', 'In progress', 'Done'];

  const changeStatus = (id: string, status: Task['status']) => {
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return;
    if (!manage && task.assignee !== user.name) {
      toast('You can only move tasks assigned to you.');
      return;
    }
    update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }));
    toast(`Task moved to ${status.toLowerCase()}.`);
  };

  const claimTask = async (task: Task) => {
    if (task.assignee) {
      toast('Someone already picked this up.');
      return;
    }
    if (cloudMode) {
      try {
        const result = await backendPost<{ state: Store }>(`/clubs/${selectedClub}/actions`, {
          type: 'tasks.claim',
          args: { taskId: task.id },
          idempotencyKey: crypto.randomUUID(),
        });
        applyServerPatch(selectedClub, result.state);
        toast('You picked up this task. Thanks for stepping in.');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Could not claim this task.');
      }
      return;
    }
    update((d) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              assignee: user.name,
              status: t.status === 'To do' ? 'In progress' : t.status,
            }
          : t,
      ),
    }));
    toast('You picked up this task. Thanks for stepping in.');
  };

  const renderTask = (task: Task) => {
    const isOverdue = new Date(task.due) < new Date(today) && task.status !== 'Done';
    const mine = task.assignee === user.name;
    const open = !task.assignee;
    const canMove = manage || mine;
    const nextStatus =
      task.status === 'To do' ? 'In progress' : task.status === 'In progress' ? 'Done' : null;
    const prevStatus =
      task.status === 'Done' ? 'In progress' : task.status === 'In progress' ? 'To do' : null;

    return (
      <article
        key={task.id}
        className={`task-card project-wall-card ${dragged === task.id ? 'is-dragging' : ''} ${open ? 'is-open' : ''}`}
        draggable={canMove}
        onDragStart={(e) => {
          if (!canMove) return;
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
          {open && <Badge tone="purple">Open</Badge>}
          {manage && (
            <button
              className="plain-icon task-edit-trigger"
              aria-label={`Edit ${task.title}`}
              title="Edit task"
              onClick={() => setEditing(task)}
            >
              <Icon name="Pencil" size={13} />
            </button>
          )}
        </div>
        <h3 className="task-headline">
          <button
            className="plain-text"
            onClick={() => (manage ? setEditing(task) : undefined)}
            type="button"
          >
            {task.title}
          </button>
        </h3>
        {task.description && <p className="task-notes">{task.description}</p>}
        <div className="task-meta">
          <div className="task-person">
            {task.assignee ? (
              <>
                <Avatar
                  name={task.assignee}
                  small
                  index={data.members.findIndex((m) => m.name === task.assignee)}
                />
                <span>{task.assignee}</span>
              </>
            ) : (
              <span className="task-open-label">Needs a volunteer</span>
            )}
          </div>
          <span className={`task-deadline ${isOverdue ? 'is-overdue' : ''}`}>
            <Icon name="CalendarDays" size={12} />
            {date(task.due, { day: 'numeric', month: 'short' })}
            {isOverdue && <span className="overdue-tag">Due</span>}
          </span>
        </div>
        <div className="task-actions-row">
          {open && (
            <button
              type="button"
              className="task-step-btn next"
              onClick={() => void claimTask(task)}
            >
              Pick up
            </button>
          )}
          {canMove && prevStatus && (
            <button
              type="button"
              className="task-step-btn prev"
              onClick={() => changeStatus(task.id, prevStatus)}
              title={`Move back to ${prevStatus}`}
            >
              ← {prevStatus}
            </button>
          )}
          {canMove && nextStatus && (
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

  const pct = Math.round((completed / Math.max(projectTasks.length, 1)) * 100);

  return (
    <>
      <PageHeader
        eyebrow="CAMPUS PROJECT WALL"
        title="Projects & tasks"
        description="One board per event or custom project — president, treasurer, and organizers assign people; anyone can pick up open work."
        action={
          manage ? (
            <>
              <Button variant="secondary" icon="PanelsTopLeft" onClick={openCreateProject}>
                Create project
              </Button>
              <Button icon="Plus" onClick={openCreate}>
                Create task
              </Button>
            </>
          ) : undefined
        }
      />

      <Revealed delay={30}>
        <div className="project-picker" role="tablist" aria-label="Projects">
          {projects.map((p) => {
            const count = data.tasks.filter(
              (t) => (t.projectId || t.eventId || OPS_PROJECT) === p.id,
            ).length;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === project.id}
                className={`project-picker-tab ${p.id === project.id ? 'selected' : ''}`}
                onClick={() => selectProject(p.id)}
              >
                <Icon name={p.icon} size={16} />
                <span>{p.title}</span>
                <em>{count}</em>
              </button>
            );
          })}
          {manage && (
            <button
              type="button"
              className="project-picker-tab project-picker-create"
              onClick={openCreateProject}
            >
              <Icon name="Plus" size={16} />
              <span>New project</span>
            </button>
          )}
        </div>
      </Revealed>

      <Revealed delay={40}>
        <section className="project-hero dark-card">
          <span className="project-hero-icon">
            <Icon name={project.icon} size={37} />
          </span>
          <div>
            <div className="hero-eyebrow">{project.eyebrow}</div>
            <h2>{project.title}</h2>
            <p>{project.description}</p>
            <div className="project-hero-meta">
              {project.date && (
                <span>
                  <Icon name="CalendarDays" size={15} />
                  {date(project.date)}
                </span>
              )}
              {project.venue && (
                <span>
                  <Icon name="MapPin" size={15} />
                  {project.venue}
                </span>
              )}
              <span className="avatar-stack" aria-label="People on this project">
                {team.map((name) => (
                  <Avatar
                    key={name}
                    name={name}
                    small
                    index={data.members.findIndex((m) => m.name === name)}
                  />
                ))}
              </span>
              {openCount > 0 && (
                <span>
                  <Icon name="UserRoundPlus" size={15} />
                  {openCount} open to pick up
                </span>
              )}
            </div>
          </div>
          <div className="project-progress">
            <Badge tone="green">
              {pct >= 70 ? 'On track' : pct >= 35 ? 'In motion' : 'Getting started'}
            </Badge>
            <strong>{pct}%</strong>
            <span>
              {completed} of {projectTasks.length} tasks complete
            </span>
            <Progress value={pct} />
            {manage && (
              <Button icon="Plus" onClick={openCreate}>
                Create task
              </Button>
            )}
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
          {manage ? (
            <Button icon="Plus" onClick={openCreate}>
              Create task
            </Button>
          ) : (
            <span className="muted">
              <Icon name="Grip" size={15} />
              Pick up an open task, or move the ones assigned to you
            </span>
          )}
        </div>
        {view === 'board' ? (
          <div className="kanban-board project-wall-board">
            {statuses.map((status, i) => {
              const isTarget = dropTarget === status;
              const columnTasks = projectTasks.filter((t) => t.status === status);
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
                    if (id && projectTasks.some((t) => t.id === id)) changeStatus(id, status);
                    setDragged(null);
                    setDropTarget(null);
                  }}
                >
                  <div className="column-heading">
                    <span className={`legend-dot ${['gold', 'teal', 'green'][i]}`} />
                    <h2>{status}</h2>
                    <span className="column-count">{columnTasks.length}</span>
                    {manage && (
                      <button
                        className="plain-icon"
                        aria-label={`Add ${status} task`}
                        onClick={openCreate}
                      >
                        <Icon name="Plus" size={18} />
                      </button>
                    )}
                  </div>
                  {columnTasks.map(renderTask)}
                  {isTarget && dragged && (
                    <div className="kanban-drop-placeholder">
                      <span>Drop here</span>
                    </div>
                  )}
                  {!columnTasks.length && !isTarget && (
                    <div className="empty-column">Drop a task here</div>
                  )}
                  {manage && (
                    <button className="add-task-inline" onClick={openCreate}>
                      <Icon name="Plus" size={16} />
                      Add a task
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="task-list-view">
            {manage && (
              <button type="button" className="add-task-inline" onClick={openCreate}>
                <Icon name="Plus" size={16} />
                Create task for {project.title}
              </button>
            )}
            {projectTasks.map(renderTask)}
          </div>
        )}
      </Revealed>

      {addingProject && manage && (
        <Modal
          title="Create a new project"
          description="Start a board for a campaign, committee, or any club work that is not tied to one event."
          onClose={close}
        >
          <form
            onSubmit={(e) => {
              void (async () => {
                const f = formValues(e);
                const next: Project = {
                  id: uid('PROJ'),
                  title: f.title.trim(),
                  description: f.description.trim(),
                  ...(f.date ? { date: f.date } : {}),
                  icon: f.icon || 'Flag',
                };
                if (cloudMode) {
                  try {
                    const result = await backendPost<{ state: Store; projectId?: string }>(
                      `/clubs/${selectedClub}/actions`,
                      {
                        type: 'projects.save',
                        args: { project: next },
                        idempotencyKey: crypto.randomUUID(),
                      },
                    );
                    applyServerPatch(selectedClub, result.state);
                    const createdId = result.projectId || next.id;
                    setProjectId(createdId);
                    setAddingProject(false);
                    setParams({ project: createdId }, { replace: true });
                    toast(`Project “${next.title}” is ready — add tasks when you are.`);
                  } catch (error) {
                    toast(
                      error instanceof Error ? error.message : 'Could not create this project.',
                    );
                  }
                  return;
                }
                update((d) => ({
                  ...d,
                  projects: [next, ...(d.projects || []).filter((p) => p.id !== next.id)],
                }));
                setProjectId(next.id);
                setAddingProject(false);
                setParams({ project: next.id }, { replace: true });
                toast(`Project “${next.title}” is ready — add tasks when you are.`);
              })();
            }}
          >
            <Field label="Project name">
              <input
                name="title"
                required
                placeholder="e.g. Freshers orientation week"
                maxLength={120}
              />
            </Field>
            <Field label="What is this for?">
              <textarea
                name="description"
                rows={3}
                placeholder="A short brief so volunteers know the goal..."
                maxLength={2000}
              />
            </Field>
            <div className="form-two">
              <Field label="Target date (optional)">
                <input type="date" name="date" />
              </Field>
              <Field label="Icon">
                <select name="icon" defaultValue="Flag">
                  <option value="Flag">Flag</option>
                  <option value="Sparkles">Sparkles</option>
                  <option value="UsersRound">Team</option>
                  <option value="HeartHandshake">Community</option>
                  <option value="PanelsTopLeft">Board</option>
                  <option value="Lightbulb">Idea</option>
                </select>
              </Field>
            </div>
            <FormFooter onClose={close} label="Create project" />
          </form>
        </Modal>
      )}

      {(adding || editing) && manage && (
        <Modal
          title={editing ? 'Update task' : 'Add task to this project'}
          description="Assign someone from the club, or leave open so volunteers can pick it up."
          onClose={close}
        >
          <form
            onSubmit={(e) => {
              const f = formValues(e);
              const assignee = f.assignee === '__open__' ? '' : f.assignee.trim();
              const picked =
                projects.find((p) => p.id === (f.projectPick || project.id)) || project;
              const task: Task = {
                id: editing?.id || uid('TASK'),
                title: f.title.trim(),
                description: f.description,
                assignee,
                projectId: picked.id,
                ...(picked.eventId ? { eventId: picked.eventId } : {}),
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
                  ? 'Task updated.'
                  : assignee
                    ? `Task added and assigned to ${assignee}.`
                    : 'Open task posted — volunteers can pick it up.',
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
            <Field label="Context">
              <textarea
                name="description"
                rows={3}
                defaultValue={editing?.description}
                placeholder="Details that help your team..."
              />
            </Field>
            <Field label="Assigned to">
              <select name="assignee" defaultValue={editing?.assignee || '__open__'}>
                <option value="__open__">Open — anyone can pick up</option>
                {data.members
                  .filter((m) => m.status === 'Active' || m.status === 'Expiring')
                  .map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                      {m.role ? ` · ${m.role}` : ''}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Project">
              <select
                name="projectPick"
                defaultValue={editing?.projectId || editing?.eventId || project.id}
                onChange={(e) => selectProject(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-two">
              <Field label="Due date">
                <input
                  type="date"
                  name="due"
                  required
                  defaultValue={editing?.due || project.date || today}
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
