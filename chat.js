import { getChatClient } from './google-clients.js';

export async function listSpaces(auth, opts = {}) {
  const svc = getChatClient(auth);
  const { page_size = 100, page_token } = opts;
  const params = { pageSize: page_size };
  if (page_token) params.pageToken = page_token;
  const res = await svc.spaces.list(params);
  return {
    spaces: (res.data.spaces || []).map(s => ({
      name: s.name, displayName: s.displayName, type: s.type,
      spaceType: s.spaceType, memberCount: s.membershipCount || null
    })),
    nextPageToken: res.data.nextPageToken || null
  };
}

export async function getMessages(auth, opts) {
  const svc = getChatClient(auth);
  const { space_name, page_size = 25, page_token, order_by = 'createTime desc' } = opts;
  const params = { parent: space_name, pageSize: page_size, orderBy: order_by };
  if (page_token) params.pageToken = page_token;
  const res = await svc.spaces.messages.list(params);
  return {
    messages: (res.data.messages || []).map(formatMessage),
    nextPageToken: res.data.nextPageToken || null
  };
}

export async function sendMessage(auth, opts) {
  const svc = getChatClient(auth);
  const { space_name, text, thread_key } = opts;
  const params = { parent: space_name, requestBody: { text } };
  if (thread_key) {
    params.requestBody.thread = { threadKey: thread_key };
    params.messageReplyOption = 'REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD';
  }
  const res = await svc.spaces.messages.create(params);
  return formatMessage(res.data);
}

export async function searchMessages(auth, opts) {
  const svc = getChatClient(auth);
  const { query, page_size = 25, page_token } = opts;
  const params = { query, pageSize: page_size };
  if (page_token) params.pageToken = page_token;
  const res = await svc.spaces.messages.list(params);
  return {
    messages: (res.data.messages || []).map(formatMessage),
    nextPageToken: res.data.nextPageToken || null
  };
}

export async function createReaction(auth, opts) {
  const svc = getChatClient(auth);
  const { message_name, emoji } = opts;
  const res = await svc.spaces.messages.reactions.create({
    parent: message_name,
    requestBody: { emoji: { unicode: emoji } }
  });
  return { name: res.data.name, emoji: res.data.emoji };
}

export async function downloadAttachment(auth, opts) {
  const svc = getChatClient(auth);
  const { attachment_name } = opts;
  const res = await svc.media.download({ resourceName: attachment_name });
  return { data: res.data };
}

function formatMessage(m) {
  if (!m) return null;
  return {
    name: m.name, sender: m.sender?.displayName || m.sender?.name || 'Unknown',
    text: m.text || '', createTime: m.createTime,
    threadName: m.thread?.name || null,
    attachments: (m.attachment || []).map(a => ({ name: a.name, contentName: a.contentName, contentType: a.contentType }))
  };
}
