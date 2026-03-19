import { getGmailClient } from './google-clients.js';

function getGmail(auth) {
  return getGmailClient(auth);
}

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

export async function getLabels(auth) {
  const gmail = getGmail(auth);
  const res = await gmail.users.labels.list({ userId: 'me' });
  return {
    labels: (res.data.labels || []).map(label => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messagesTotal: label.messagesTotal,
      messagesUnread: label.messagesUnread,
      threadsTotal: label.threadsTotal,
      threadsUnread: label.threadsUnread,
      labelListVisibility: label.labelListVisibility,
      messageListVisibility: label.messageListVisibility,
      color: label.color
    }))
  };
}

export async function createLabel(auth, requestBody) {
  const gmail = getGmail(auth);
  const res = await gmail.users.labels.create({ userId: 'me', requestBody });
  return res.data;
}

export async function updateLabel(auth, labelId, requestBody) {
  const gmail = getGmail(auth);
  const res = await gmail.users.labels.patch({ userId: 'me', id: labelId, requestBody });
  return res.data;
}

export async function deleteLabel(auth, labelId) {
  const gmail = getGmail(auth);
  await gmail.users.labels.delete({ userId: 'me', id: labelId });
  return { deleted: labelId };
}

export async function listFilters(auth) {
  const gmail = getGmail(auth);
  const res = await gmail.users.settings.filters.list({ userId: 'me' });
  return { filters: res.data.filter || [] };
}

export async function getFilter(auth, filterId) {
  const gmail = getGmail(auth);
  const res = await gmail.users.settings.filters.get({ userId: 'me', id: filterId });
  return res.data;
}

export async function createFilter(auth, criteria, action) {
  const gmail = getGmail(auth);
  const res = await gmail.users.settings.filters.create({
    userId: 'me',
    requestBody: { criteria: normalizeFilterCriteria(criteria || {}), action: normalizeFilterAction(action || {}) }
  });
  return res.data;
}

export async function deleteFilter(auth, filterId) {
  const gmail = getGmail(auth);
  await gmail.users.settings.filters.delete({ userId: 'me', id: filterId });
  return { deleted: filterId };
}

export async function replaceFilter(auth, filterId, criteriaPatch = {}, actionPatch = {}) {
  const current = await getFilter(auth, filterId);
  const nextCriteria = { ...(current.criteria || {}), ...normalizeFilterCriteria(criteriaPatch || {}) };
  const nextAction = { ...(current.action || {}), ...normalizeFilterAction(actionPatch || {}) };
  const created = await createFilter(auth, nextCriteria, nextAction);
  try {
    await deleteFilter(auth, filterId);
    return { replaced: true, oldFilterId: filterId, newFilterId: created.id, deletedOld: true, filter: created };
  } catch (err) {
    return { replaced: false, oldFilterId: filterId, newFilterId: created.id, deletedOld: false, warning: err.message };
  }
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
}

export async function listMessageIdsByQuery(auth, query, maxResults = 2000) {
  const gmail = getGmail(auth);
  const pageSize = Math.min(maxResults, 500);
  let pageToken;
  const ids = [];
  while (ids.length < maxResults) {
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(pageSize, maxResults - ids.length),
      pageToken
    });
    const messages = listRes.data.messages || [];
    for (const message of messages) ids.push(message.id);
    pageToken = listRes.data.nextPageToken;
    if (!pageToken || messages.length === 0) break;
  }
  return { ids, count: ids.length };
}

export async function bulkModifyLabels(auth, messageIds = [], addLabels = [], removeLabels = []) {
  const gmail = getGmail(auth);
  if (!Array.isArray(messageIds) || messageIds.length === 0) return { matched: 0, processed: 0, failedBatches: 0 };
  const chunks = chunkArray(messageIds, 1000);
  let processed = 0;
  let failedBatches = 0;
  for (const ids of chunks) {
    try {
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: { ids, addLabelIds: addLabels, removeLabelIds: removeLabels }
      });
      processed += ids.length;
    } catch {
      failedBatches += 1;
    }
  }
  return { matched: messageIds.length, processed, failedBatches };
}

export async function bulkModifyLabelsByQuery(auth, query, addLabels = [], removeLabels = [], maxResults = 2000) {
  const listed = await listMessageIdsByQuery(auth, query, maxResults);
  const modified = await bulkModifyLabels(auth, listed.ids, addLabels, removeLabels);
  return { query, ...modified };
}
