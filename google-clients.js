import { google } from 'googleapis';

const RELAY_URL = process.env.GSUITE_RELAY_URL;

const SERVICE_BASES = {
  gmail: 'https://gmail.googleapis.com/gmail/v1',
  drive: 'https://www.googleapis.com/drive/v3',
  docs: 'https://docs.googleapis.com/v1',
  sheets: 'https://sheets.googleapis.com/v4',
  script: 'https://script.googleapis.com/v1',
  calendar: 'https://www.googleapis.com/calendar/v3',
  tasks: 'https://tasks.googleapis.com/tasks/v1',
  people: 'https://people.googleapis.com/v1',
  chat: 'https://chat.googleapis.com/v1',
  slides: 'https://slides.googleapis.com/v1',
  forms: 'https://forms.googleapis.com/v1',
};

const VERB_MAP = {
  list: 'GET', get: 'GET', watch: 'POST', export: 'GET', generateIds: 'GET', batchGet: 'GET',
  create: 'POST', send: 'POST', insert: 'POST', modify: 'POST', append: 'POST', clear: 'POST', copyTo: 'POST', batchModify: 'POST', batchDelete: 'POST',
  update: 'PUT', patch: 'PATCH',
  delete: 'DELETE', trash: 'POST', untrash: 'POST',
};

const PATH_VERBS = new Set(['send','trash','untrash','watch','batchModify','batchDelete','clear','copyTo','generateIds','export','append','modify']);

const SEGMENT_ID_MAP = {
  users: 'userId', messages: ['messageId', 'id'], threads: ['threadId', 'id'],
  attachments: 'id', files: 'fileId', documents: 'documentId',
  spreadsheets: 'spreadsheetId', scripts: 'scriptId', labels: 'id',
  filters: 'id', delegates: 'delegateEmail', sendAs: 'sendAsEmail', sheets: 'sheetId',
  values: 'range',
  calendars: 'calendarId', events: 'eventId', calendarList: 'calendarId',
  tasklists: 'tasklistId', tasks: 'taskId',
  people: 'resourceName', connections: 'resourceName', contactGroups: 'resourceName',
  spaces: 'spaceId', presentations: 'presentationId', pages: 'pageId',
  forms: 'formId', responses: 'responseId',
};

function resolveIdKey(seg, params) {
  const keys = SEGMENT_ID_MAP[seg];
  if (!keys) return null;
  const arr = Array.isArray(keys) ? keys : [keys];
  return arr.find(k => params[k] !== undefined) || null;
}

function buildUrl(base, pathSegs, params) {
  const usedParams = new Set();
  let url = base;
  for (const seg of pathSegs) {
    url += '/' + seg;
    const idKey = resolveIdKey(seg, params);
    if (idKey) { url += '/' + encodeURIComponent(params[idKey]); usedParams.add(idKey); }
  }
  return { url, usedParams };
}

async function relayFetch(relayUrl, payload) {
  const res = await fetch(relayUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const env = await res.json();
  if (!env.success) throw Object.assign(new Error(env.error || 'relay error'), { status: env.status, code: env.status });
  return { data: env.data };
}

function makeProxy(base, segs, auth, relayUrl) {
  return new Proxy(function () {}, {
    get(_, prop) { return makeProxy(base, [...segs, prop], auth, relayUrl); },
    async apply(_, __, [params = {}]) {
      const verb = segs[segs.length - 1];
      const pathSegs = PATH_VERBS.has(verb) ? segs : segs.slice(0, -1);
      const method = VERB_MAP[verb] || 'GET';
      const { url, usedParams } = buildUrl(base, pathSegs, params);
      const { requestBody, resource, ...rest } = params;
      const body = requestBody || resource || null;
      const queryParams = Object.fromEntries(Object.entries(rest).filter(([k]) => !usedParams.has(k)));
      const accessToken = auth?.credentials?.access_token || null;
      return relayFetch(relayUrl, { url, method, params: queryParams, body, accessToken });
    },
  });
}

function createServiceProxy(serviceName, auth) {
  return makeProxy(SERVICE_BASES[serviceName], [], auth, RELAY_URL);
}

export function getDocsClient(auth) {
  return RELAY_URL ? createServiceProxy('docs', auth) : google.docs({ version: 'v1', auth });
}

export function getSheetsClient(auth) {
  return RELAY_URL ? createServiceProxy('sheets', auth) : google.sheets({ version: 'v4', auth });
}

export function getGmailClient(auth) {
  return RELAY_URL ? createServiceProxy('gmail', auth) : google.gmail({ version: 'v1', auth });
}

export function getScriptClient(auth) {
  return RELAY_URL ? createServiceProxy('script', auth) : google.script({ version: 'v1', auth });
}

export function getDriveClient(auth) {
  return RELAY_URL ? createServiceProxy('drive', auth) : google.drive({ version: 'v3', auth });
}

export function getCalendarClient(auth) {
  return RELAY_URL ? createServiceProxy('calendar', auth) : google.calendar({ version: 'v3', auth });
}

export function getTasksClient(auth) {
  return RELAY_URL ? createServiceProxy('tasks', auth) : google.tasks({ version: 'v1', auth });
}

export function getPeopleClient(auth) {
  return RELAY_URL ? createServiceProxy('people', auth) : google.people({ version: 'v1', auth });
}

export function getChatClient(auth) {
  return RELAY_URL ? createServiceProxy('chat', auth) : google.chat({ version: 'v1', auth });
}

export function getSlidesClient(auth) {
  return RELAY_URL ? createServiceProxy('slides', auth) : google.slides({ version: 'v1', auth });
}

export function getFormsClient(auth) {
  return RELAY_URL ? createServiceProxy('forms', auth) : google.forms({ version: 'v1', auth });
}
