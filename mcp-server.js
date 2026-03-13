import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS, SHEETS_TOOLS, SCRIPTS_TOOLS, GMAIL_TOOLS } from './tools.js';
import { CALENDAR_TOOLS } from './calendar-tools.js';
import { TASKS_TOOLS } from './tasks-tools.js';
import { SLIDES_TOOLS } from './slides-tools.js';
import { CONTACTS_TOOLS } from './contacts-tools.js';
import { CHAT_TOOLS } from './chat-tools.js';
import { SEARCH_TOOLS } from './search-tools.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { handleDocsToolCall, handleSheetsToolCall, handleGmailToolCall } from './handlers.js';
import { handleCalendarToolCall } from './handlers-calendar.js';
import { handleTasksToolCall } from './handlers-tasks.js';
import { handleSlidesToolCall } from './handlers-slides.js';
import { handleContactsToolCall } from './handlers-contacts.js';
import { handleChatToolCall } from './handlers-chat.js';
import { handleSearchToolCall } from './handlers-search.js';
import { enrichToolsForApps } from './apps-metadata.js';
import { listStaticResources, listResourceTemplates, readResource } from './mcp-resources.js';
import { isAuthError, withAuth } from './auth.js';

export const SERVER_NAME = 'agent-gsuite';
export const SERVER_VERSION = '1.0.0';

const TOOLS = enrichToolsForApps([
  ...DOCS_TOOLS,
  ...SECTION_TOOLS,
  ...MEDIA_TOOLS,
  ...DRIVE_TOOLS,
  ...SHEETS_TOOLS,
  ...SCRIPTS_TOOLS,
  ...GMAIL_TOOLS,
  ...CALENDAR_TOOLS,
  ...TASKS_TOOLS,
  ...SLIDES_TOOLS,
  ...CONTACTS_TOOLS,
  ...CHAT_TOOLS,
  ...SEARCH_TOOLS
]);

export async function dispatchToolCall(name, args, auth, context) {
  return withAuth(async () => {
    const docsResult = await handleDocsToolCall(name, args, auth, context);
    if (docsResult) return docsResult;

    const sheetsResult = await handleSheetsToolCall(name, args, auth);
    if (sheetsResult) return sheetsResult;

    const gmailResult = await handleGmailToolCall(name, args, auth);
    if (gmailResult) return gmailResult;

    const calendarResult = await handleCalendarToolCall(name, args, auth);
    if (calendarResult) return calendarResult;

    const tasksResult = await handleTasksToolCall(name, args, auth);
    if (tasksResult) return tasksResult;

    const slidesResult = await handleSlidesToolCall(name, args, auth);
    if (slidesResult) return slidesResult;

    const contactsResult = await handleContactsToolCall(name, args, auth);
    if (contactsResult) return contactsResult;

    const chatResult = await handleChatToolCall(name, args, auth);
    if (chatResult) return chatResult;

    const searchResult = await handleSearchToolCall(name, args, auth);
    if (searchResult) return searchResult;

    throw new Error(`Unknown tool: ${name}`);
  });
}

export function setupMcpHandlers(server, getAuth, hooks = {}) {
  const { trackDoc, listSessionDocs } = hooks;

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const sessionDocs = listSessionDocs ? listSessionDocs() : [];
    return { resources: [...listStaticResources(), ...sessionDocs] };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: listResourceTemplates() }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const auth = await getAuth();
      return await readResource(auth, request.params.uri);
    } catch (err) {
      return {
        contents: [{ uri: request.params.uri, mimeType: 'text/plain', text: `Error reading resource: ${err.message}` }]
      };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const auth = await getAuth();
      const context = trackDoc ? {
        trackDoc: (docId, title) => {
          trackDoc(docId, title);
          try { server.sendResourceListChanged(); } catch (e) {}
        }
      } : undefined;
      return await dispatchToolCall(name, args, auth, context);
    } catch (err) {
      console.error(`[tool:${name}] Error:`, err.message);
      const msg = isAuthError(err)
        ? `${err.message}\n\nTo re-authenticate, visit /login or run: bun x agent-gsuite auth login`
        : err.message;
      return {
        content: [{ type: 'text', text: msg }],
        isError: true
      };
    }
  });
}

export function buildMcpServer(getAuth, hooks) {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );
  setupMcpHandlers(server, getAuth, hooks);
  return server;
}
