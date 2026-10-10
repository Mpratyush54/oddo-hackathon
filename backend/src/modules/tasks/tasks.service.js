import { HttpError, recordId } from '../../shared/records.js';
import { staff } from '../../shared/authorization.js';
import { parseRequest } from '../../shared/request-validation.js';
import { saveTaskSchema, updateOwnTaskSchema } from './tasks.schemas.js';
import { ClubActionService } from '../clubs/club-action.service.js';
import { awardPoints, resolvePointRules } from '../commerce/commerce.domain.js';

export class TaskService extends ClubActionService {
  save(input) {
    if (staff.includes(this.role)) return this.saveForStaff(input);
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
    if (!staff.includes(this.role)) throw new HttpError(403, 'Staff access is required.');
    const { task } = parseRequest(saveTaskSchema, input);
    const prior = this.data.tasks.find((item) => item.id === task.id);
    const assignee = this.data.members.find((member) => member.name === task.assignee);
    const next = {
      id: prior?.id || recordId('TASK'),
      title: task.title,
      description: task.description,
      assignee: assignee?.name || '',
      assigneeId: assignee?.userId,
      due: task.due,
      priority: task.priority,
      status: task.status,
    };
    const becameDone = prior?.status !== 'Done' && next.status === 'Done';
    this.data.tasks = [next, ...this.data.tasks.filter((item) => item.id !== next.id)];
    if (becameDone) this.awardTaskPoints(next);
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
