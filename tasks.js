import { getTasksClient } from './google-clients.js';

export async function listTaskLists(auth) {
  const svc = getTasksClient(auth);
  const res = await svc.tasklists.list({ maxResults: 100 });
  return (res.data.items || []).map(tl => ({
    id: tl.id, title: tl.title, updated: tl.updated
  }));
}

export async function getTaskList(auth, tasklistId) {
  const svc = getTasksClient(auth);
  const res = await svc.tasklists.get({ tasklist: tasklistId });
  return { id: res.data.id, title: res.data.title, updated: res.data.updated };
}

export async function manageTaskList(auth, opts) {
  const svc = getTasksClient(auth);
  const { action, tasklist_id, title } = opts;

  if (action === 'create') {
    const res = await svc.tasklists.insert({ requestBody: { title } });
    return { id: res.data.id, title: res.data.title };
  }
  if (action === 'update') {
    const res = await svc.tasklists.update({ tasklist: tasklist_id, requestBody: { title } });
    return { id: res.data.id, title: res.data.title };
  }
  if (action === 'delete') {
    await svc.tasklists.delete({ tasklist: tasklist_id });
    return { deleted: tasklist_id };
  }
  if (action === 'clear') {
    await svc.tasks.clear({ tasklist: tasklist_id });
    return { cleared: tasklist_id };
  }
  throw new Error(`Unknown task list action: ${action}`);
}

export async function listTasks(auth, opts = {}) {
  const svc = getTasksClient(auth);
  const { tasklist_id = '@default', max_results = 100, show_completed = true, show_hidden = false, due_min, due_max } = opts;
  const params = { tasklist: tasklist_id, maxResults: max_results, showCompleted: show_completed, showHidden: show_hidden };
  if (due_min) params.dueMin = due_min;
  if (due_max) params.dueMax = due_max;
  const res = await svc.tasks.list(params);
  return (res.data.items || []).map(formatTask);
}

export async function getTask(auth, tasklistId, taskId) {
  const svc = getTasksClient(auth);
  const res = await svc.tasks.get({ tasklist: tasklistId, task: taskId });
  return formatTask(res.data);
}

export async function manageTask(auth, opts) {
  const svc = getTasksClient(auth);
  const { action, tasklist_id = '@default', task_id } = opts;

  if (action === 'create') {
    const body = {};
    if (opts.title) body.title = opts.title;
    if (opts.notes) body.notes = opts.notes;
    if (opts.due) body.due = opts.due;
    if (opts.status) body.status = opts.status;
    const params = { tasklist: tasklist_id, requestBody: body };
    if (opts.parent) params.parent = opts.parent;
    if (opts.previous) params.previous = opts.previous;
    const res = await svc.tasks.insert(params);
    return formatTask(res.data);
  }
  if (action === 'update') {
    const existing = await svc.tasks.get({ tasklist: tasklist_id, task: task_id });
    const body = { ...existing.data };
    if (opts.title !== undefined) body.title = opts.title;
    if (opts.notes !== undefined) body.notes = opts.notes;
    if (opts.due !== undefined) body.due = opts.due;
    if (opts.status) body.status = opts.status;
    if (opts.completed !== undefined) body.completed = opts.completed;
    const res = await svc.tasks.update({ tasklist: tasklist_id, task: task_id, requestBody: body });
    return formatTask(res.data);
  }
  if (action === 'delete') {
    await svc.tasks.delete({ tasklist: tasklist_id, task: task_id });
    return { deleted: task_id };
  }
  if (action === 'move') {
    const params = { tasklist: tasklist_id, task: task_id };
    if (opts.parent) params.parent = opts.parent;
    if (opts.previous) params.previous = opts.previous;
    const res = await svc.tasks.move(params);
    return formatTask(res.data);
  }
  throw new Error(`Unknown task action: ${action}`);
}

function formatTask(t) {
  return {
    id: t.id, title: t.title || '', notes: t.notes || '',
    status: t.status, due: t.due || null, completed: t.completed || null,
    parent: t.parent || null, position: t.position, updated: t.updated
  };
}
