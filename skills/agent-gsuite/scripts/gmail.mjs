import { google } from 'googleapis';

function getGmail(auth) { return google.gmail({ version: 'v1', auth }); }

function normalizeFilterCriteria(criteria = {}) {
  const out = {};
  if (criteria.from) out.from = criteria.from;
  if (criteria.to) out.to = criteria.to;
  if (criteria.subject) out.subject = criteria.subject;
  if (criteria.query) out.query = criteria.query;
  if (criteria.negated_query) out.negatedQuery = criteria.negated_query;
  if (criteria.negatedQuery) out.negatedQuery = criteria.negatedQuery;
  if (criteria.has_attachment !== undefined) out.hasAttachment = criteria.has_attachment;
  if (criteria.hasAttachment !== undefined) out.hasAttachment = criteria.hasAttachment;
  if (criteria.size !== undefined) out.size = criteria.size;
  if (criteria.size_comparison) out.sizeComparison = criteria.size_comparison;
  if (criteria.sizeComparison) out.sizeComparison = criteria.sizeComparison;
  return out;
}

function normalizeFilterAction(action = {}) {
  const out = {};
  if (action.add_label_ids) out.addLabelIds = action.add_label_ids;
  if (action.addLabelIds) out.addLabelIds = action.addLabelIds;
  if (action.remove_label_ids) out.removeLabelIds = action.remove_label_ids;
  if (action.removeLabelIds) out.removeLabelIds = action.removeLabelIds;
  if (action.forward) out.forward = action.forward;
  return out;
}

export async function listMessages(auth, { query, max_results = 20, label_ids } = {}) {
  const gmail = getGmail(auth);
  const params = { userId: 'me', maxResults: max_results };
  if (query) params.q = query;
  if (label_ids) params.labelIds = label_ids;
  const res = await gmail.users.messages.list(params);
  return res.data.messages || [];
}

export async function searchMessages(auth, { query, max_results = 20 }) {
  return listMessages(auth, { query, max_results });
}

export async function getMessage(auth, { message_id, format = 'full' }) {
  const gmail = getGmail(auth);
  const res = await gmail.users.messages.get({ userId: 'me', id: message_id, format });
  return res.data;
}

export async function getAttachments(auth, { message_id }) {
  const gmail = getGmail(auth);
  const res = await gmail.users.messages.get({ userId: 'me', id: message_id, format: 'full' });
  const attachments = [];
  const parts = res.data.payload?.parts || [];
  for (const part of parts) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({ filename: part.filename, mimeType: part.mimeType, size: part.body.size, attachmentId: part.body.attachmentId });
    }
  }
  return attachments;
}

export async function downloadAttachment(auth, { message_id, attachment_id }) {
  const gmail = getGmail(auth);
  const res = await gmail.users.messages.attachments.get({ userId: 'me', messageId: message_id, id: attachment_id });
  return { data: res.data.data, size: res.data.size };
}

export async function sendMessage(auth, { to, subject, body, from, cc, bcc }) {
  const gmail = getGmail(auth);
  const lines = [`To: ${to}`, `Subject: ${subject}`];
  if (from) lines.push(`From: ${from}`);
  if (cc) lines.push(`Cc: ${Array.isArray(cc) ? cc.join(',') : cc}`);
  if (bcc) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(',') : bcc}`);
  const contentType = body.includes('<html') || body.includes('<body') ? 'text/html' : 'text/plain';
  lines.push(`Content-Type: ${contentType}; charset=utf-8`, 'MIME-Version: 1.0', '', body);
  const raw = Buffer.from(lines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return res.data;
}

export async function listThreads(auth, { query, max_results = 10 } = {}) {
  const gmail = getGmail(auth);
  const res = await gmail.users.threads.list({ userId: 'me', q: query, maxResults: max_results });
  return res.data.threads || [];
}

export async function getThread(auth, { thread_id, format = 'full' }) {
  const gmail = getGmail(auth);
  const res = await gmail.users.threads.get({ userId: 'me', id: thread_id, format });
  return res.data;
}

export async function modifyMessage(auth, { message_id, add_labels = [], remove_labels = [] }) {
  const gmail = getGmail(auth);
  const res = await gmail.users.messages.modify({ userId: 'me', id: message_id, requestBody: { addLabelIds: add_labels, removeLabelIds: remove_labels } });
  return res.data;
}

export async function deleteMessage(auth, { message_id }) {
  const gmail = getGmail(auth);
  await gmail.users.messages.delete({ userId: 'me', id: message_id });
  return { deleted: message_id };
}

export async function trashMessage(auth, { message_id }) {
  const gmail = getGmail(auth);
  const res = await gmail.users.messages.trash({ userId: 'me', id: message_id });
  return res.data;
}

export async function bulkModifyLabels(auth, { query, add_labels = [], remove_labels = [], max_results = 2000 }) {
  const gmail = getGmail(auth);
  const pageSize = Math.min(max_results, 500);
  let pageToken;
  const ids = [];
  while (ids.length < max_results) {
    const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: Math.min(pageSize, max_results - ids.length), pageToken });
    const messages = listRes.data.messages || [];
    for (const m of messages) ids.push(m.id);
    pageToken = listRes.data.nextPageToken;
    if (!pageToken || messages.length === 0) break;
  }
  if (ids.length === 0) return { matched: 0, processed: 0, failedBatches: 0 };
  let processed = 0, failedBatches = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    try {
      await gmail.users.messages.batchModify({ userId: 'me', requestBody: { ids: chunk, addLabelIds: add_labels, removeLabelIds: remove_labels } });
      processed += chunk.length;
    } catch { failedBatches++; }
  }
  return { query, matched: ids.length, processed, failedBatches };
}

export async function getLabels(auth) {
  const gmail = getGmail(auth);
  const res = await gmail.users.labels.list({ userId: 'me' });
  return { labels: (res.data.labels || []).map(l => ({ id: l.id, name: l.name, type: l.type, messagesTotal: l.messagesTotal, messagesUnread: l.messagesUnread, threadsTotal: l.threadsTotal, threadsUnread: l.threadsUnread, labelListVisibility: l.labelListVisibility, messageListVisibility: l.messageListVisibility, color: l.color })) };
}

export async function createLabel(auth, { name, label_list_visibility, message_list_visibility, color }) {
  const gmail = getGmail(auth);
  const body = { name };
  if (label_list_visibility) body.labelListVisibility = label_list_visibility;
  if (message_list_visibility) body.messageListVisibility = message_list_visibility;
  if (color) body.color = { textColor: color.text_color, backgroundColor: color.background_color };
  const res = await gmail.users.labels.create({ userId: 'me', requestBody: body });
  return res.data;
}

export async function updateLabel(auth, { label_id, name, label_list_visibility, message_list_visibility, color }) {
  const gmail = getGmail(auth);
  const body = {};
  if (name) body.name = name;
  if (label_list_visibility) body.labelListVisibility = label_list_visibility;
  if (message_list_visibility) body.messageListVisibility = message_list_visibility;
  if (color) body.color = { textColor: color.text_color, backgroundColor: color.background_color };
  const res = await gmail.users.labels.patch({ userId: 'me', id: label_id, requestBody: body });
  return res.data;
}

export async function deleteLabel(auth, { label_id }) {
  const gmail = getGmail(auth);
  await gmail.users.labels.delete({ userId: 'me', id: label_id });
  return { deleted: label_id };
}

export async function listFilters(auth) {
  const gmail = getGmail(auth);
  const res = await gmail.users.settings.filters.list({ userId: 'me' });
  return { filters: res.data.filter || [] };
}

export async function getFilter(auth, { filter_id }) {
  const gmail = getGmail(auth);
  const res = await gmail.users.settings.filters.get({ userId: 'me', id: filter_id });
  return res.data;
}

export async function createFilter(auth, { criteria, action }) {
  const gmail = getGmail(auth);
  const res = await gmail.users.settings.filters.create({ userId: 'me', requestBody: { criteria: normalizeFilterCriteria(criteria || {}), action: normalizeFilterAction(action || {}) } });
  return res.data;
}

export async function deleteFilter(auth, { filter_id }) {
  const gmail = getGmail(auth);
  await gmail.users.settings.filters.delete({ userId: 'me', id: filter_id });
  return { deleted: filter_id };
}

export async function replaceFilter(auth, { filter_id, criteria = {}, action = {} }) {
  const current = await getFilter(auth, { filter_id });
  const nextCriteria = { ...(current.criteria || {}), ...normalizeFilterCriteria(criteria) };
  const nextAction = { ...(current.action || {}), ...normalizeFilterAction(action) };
  const created = await createFilter(auth, { criteria: nextCriteria, action: nextAction });
  try {
    await deleteFilter(auth, { filter_id });
    return { replaced: true, oldFilterId: filter_id, newFilterId: created.id, deletedOld: true, filter: created };
  } catch (err) {
    return { replaced: false, oldFilterId: filter_id, newFilterId: created.id, deletedOld: false, warning: err.message };
  }
}
