import { google } from 'googleapis';

function getGmail(auth) {
  return google.gmail({ version: 'v1', auth });
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
  const { normalizeFilterCriteria, normalizeFilterAction } = await import('./gmail-filters.js');
  const normalizedCriteria = normalizeFilterCriteria(criteria || {});
  const normalizedAction = normalizeFilterAction(action || {});
  const res = await gmail.users.settings.filters.create({
    userId: 'me',
    requestBody: { criteria: normalizedCriteria, action: normalizedAction }
  });
  return res.data;
}

export async function deleteFilter(auth, filterId) {
  const gmail = getGmail(auth);
  await gmail.users.settings.filters.delete({ userId: 'me', id: filterId });
  return { deleted: filterId };
}

export async function replaceFilter(auth, filterId, criteriaPatch = {}, actionPatch = {}) {
  const { normalizeFilterCriteria, normalizeFilterAction } = await import('./gmail-filters.js');
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
