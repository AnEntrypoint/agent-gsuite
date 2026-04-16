import * as tasks from './tasks.js';
import { formatJsonResponse } from './handlers-utils.js';

export async function handleTasksToolCall(name, args, auth) {
  switch (name) {
    case 'tasks_list_lists': return formatJsonResponse(await tasks.listTaskLists(auth));
    case 'tasks_get_list': return formatJsonResponse(await tasks.getTaskList(auth, args.tasklist_id));
    case 'tasks_manage_list': return formatJsonResponse(await tasks.manageTaskList(auth, args));
    case 'tasks_list': return formatJsonResponse(await tasks.listTasks(auth, args));
    case 'tasks_get': return formatJsonResponse(await tasks.getTask(auth, args.tasklist_id, args.task_id));
    case 'tasks_manage': return formatJsonResponse(await tasks.manageTask(auth, args));
    default: return null;
  }
}
