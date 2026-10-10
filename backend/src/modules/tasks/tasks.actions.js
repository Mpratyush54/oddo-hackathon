import { HttpError, recordId } from '../../shared/records.js';
import { staff } from '../../shared/authorization.js';
import { text } from '../../shared/validation.js';
import { taskSchema } from '../../database/schemas/club.schema.js';

export function handleTasks({ data, action, user, role, now, context, actor, args }) {
  let result = {};
  switch (action.type) {
    case 'tasks.save': {
      const task = args.task,
        prior = data.tasks.find((t) => t.id === task?.id);
      if (!staff.includes(role)) {
        if (!prior || (prior.assigneeId !== user.id && prior.assignee !== user.name))
          throw new HttpError(403, 'You can update only your assigned task.');
        if (!['To do', 'In progress', 'Done'].includes(task.status))
          throw new HttpError(400, 'Unknown task status.');
        prior.status = task.status;
      } else {
        if (
          !['To do', 'In progress', 'Done'].includes(task?.status) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(task.due)
        )
          throw new HttpError(400, 'Enter a valid task status and due date.');
        const assignee = data.members.find((m) => m.name === task.assignee);
        const next = {
          id: prior?.id || recordId('TASK'),
          title: text(task.title, 160),
          description: String(task.description || '').slice(0, 2000),
          assignee: assignee?.name || '',
          assigneeId: assignee?.userId,
          due: task.due,
          priority: String(task.priority || 'Medium').slice(0, 20),
          status: task.status,
        };
        if (!taskSchema.safeParse(next).success)
          throw new HttpError(400, 'Enter a valid task priority, status, and due date.');
        data.tasks = [next, ...data.tasks.filter((t) => t.id !== next.id)];
      }
      break;
    }
  }
  return { data, result };
}
