import { HttpError, recordId } from '../../shared/records.js';
import { taskManagers } from '../../shared/authorization.js';
import { parseRequest } from '../../shared/request-validation.js';
import {
  saveTaskSchema,
  updateOwnTaskSchema,
  claimTaskSchema,
  saveProjectSchema,
} from './tasks.schemas.js';
import { ClubActionService } from '../clubs/club-action.service.js';
import { awardPoints, resolvePointRules } from '../commerce/commerce.domain.js';

export class TaskService extends ClubActionService {
  knownProjectId(projectId) {
    if (!projectId) return false;
    if (projectId === 'PROJ-OPS') return true;
    if ((this.data.events || []).some((event) => event.id === projectId)) return true;
    return (this.data.projects || []).some((project) => project.id === projectId);
  }

  saveProject(input) {
    if (!taskManagers.includes(this.role)) throw new HttpError(403, 'Staff access is required.');
    const { project } = parseRequest(saveProjectSchema, input);
    const prior = (this.data.projects || []).find((item) => item.id === project.id);
    const next = {
      id: prior?.id || recordId('PROJ'),
      title: project.title,
      description: project.description || '',
      ...(project.date || prior?.date ? { date: project.date || prior?.date } : {}),
      icon: project.icon || prior?.icon || 'Flag',
    };
    this.data.projects = [
      next,
      ...(this.data.projects || []).filter((item) => item.id !== next.id),
    ];
    return { projectId: next.id };
  }

  save(input) {
    if (taskManagers.includes(this.role)) return this.saveForStaff(input);
    return this.updateAssigned(input);
  }

  updateAssigned(input) {
    const { task } = parseRequest(updateOwnTaskSchema, input);
    const prior = this.data.tasks.find((item) => item.id === task.id);
    if (!prior || (prior.assigneeId !== this.user.id && prior.assignee !== this.user.name))
      throw new HttpError(403, 'You can update only your assigned task.');
    const becameDone = prior.status !== 'Done' && task.status === 'Done';
    prior.status = task.status;
    if (becameDone) this.awardTaskPoints(prior);
    return {};
  }

  saveForStaff(input) {
    if (!taskManagers.includes(this.role)) throw new HttpError(403, 'Staff access is required.');
    const { task } = parseRequest(saveTaskSchema, input);
    const prior = this.data.tasks.find((item) => item.id === task.id);
    const assignee = task.assignee
      ? this.data.members.find(
          (member) => member.name === task.assignee || member.id === task.assignee,
        )
      : null;
    const projectId =
      task.projectId || prior?.projectId || task.eventId || prior?.eventId || 'PROJ-OPS';
    if (!this.knownProjectId(projectId)) throw new HttpError(400, 'That project was not found.');
    const linkedEvent =
      (this.data.events || []).find((event) => event.id === projectId) ||
      (task.eventId || prior?.eventId
        ? (this.data.events || []).find((event) => event.id === (task.eventId || prior?.eventId))
        : null);
    if (
      (task.eventId || prior?.eventId) &&
      !linkedEvent &&
      projectId !== (task.eventId || prior?.eventId)
    )
      throw new HttpError(400, 'That event project was not found.');
    const eventId = linkedEvent?.id;
    const next = {
      id: prior?.id || recordId('TASK'),
      title: task.title,
      description: task.description,
      assignee: assignee?.name || '',
      projectId,
      ...(eventId ? { eventId } : {}),
      due: task.due,
      priority: task.priority,
      status: task.status,
      ...(assignee?.userId ? { assigneeId: assignee.userId } : {}),
    };
    const becameDone = prior?.status !== 'Done' && next.status === 'Done';
    this.data.tasks = [next, ...this.data.tasks.filter((item) => item.id !== next.id)];
    if (becameDone) this.awardTaskPoints(next);
    return {};
  }

  claim(input) {
    const { taskId } = parseRequest(claimTaskSchema, input);
    const prior = this.data.tasks.find((item) => item.id === taskId);
    if (!prior) throw new HttpError(404, 'Task not found.');
    if (prior.assignee || prior.assigneeId)
      throw new HttpError(409, 'Someone already picked up this task.');
    const member = this.data.members.find(
      (row) => row.userId === this.user.id || row.email === this.user.email,
    );
    prior.assignee = member?.name || this.user.name;
    prior.assigneeId = this.user.id;
    if (prior.status === 'To do') prior.status = 'In progress';
    return {};
  }

  awardTaskPoints(task) {
    const rules = resolvePointRules(this.data);
    if (rules.taskEnabled === false || !Number(rules.taskDonePoints)) return;
    if ((this.data.pointLedger || []).some((e) => e.taskId === task.id && e.kind === 'volunteer'))
      return;
    const member = this.data.members.find(
      (m) => m.name === task.assignee || (task.assigneeId && m.userId === task.assigneeId),
    );
    if (!member) return;
    const result = awardPoints(this.data, {
      memberId: member.id,
      kind: 'volunteer',
      points: Math.min(500, Math.max(1, Number(rules.taskDonePoints) || 15)),
      reason: `Completed task · ${task.title}`,
      taskId: task.id,
      actor: this.actor,
    });
    this.data = { ...this.data, ...result.patch };
  }
}
