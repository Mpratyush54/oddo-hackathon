import { HttpError, recordId } from '../../shared/records.js';
import { staff } from '../../shared/authorization.js';
import { parseRequest } from '../../shared/request-validation.js';
import { saveTaskSchema, updateOwnTaskSchema } from './tasks.schemas.js';
import { ClubActionService } from '../clubs/club-action.service.js';

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
    prior.status = task.status;
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
    this.data.tasks = [next, ...this.data.tasks.filter((item) => item.id !== next.id)];
    return {};
  }
}
