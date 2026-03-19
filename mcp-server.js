import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS, SHEETS_TOOLS, SCRIPTS_TOOLS, GMAIL_TOOLS } from './tools.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { handleDocsToolCall, handleSheetsToolCall, handleGmailToolCall } from './handlers.js';
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
  ...GMAIL_TOOLS
]);

export async function dispatchToolCall(name, args, auth) {
  return withAuth(async () => {
    const docsResult = await handleDocsToolCall(name, args, auth);
    if (docsResult) return docsResult;

    const sheetsResult = await handleSheetsToolCall(name, args, auth);
    if (sheetsResult) return sheetsResult;

    const gmailResult = await handleGmailToolCall(name, args, auth);
    if (gmailResult) return gmailResult;

    throw new Error(`Unknown tool: ${name}`);
  });
}

export function setupMcpHandlers(server, getAuth) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listStaticResources() }));

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
      return await dispatchToolCall(name, args, auth);
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

export function buildMcpServer(getAuth) {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } }
  );
  setupMcpHandlers(server, getAuth);
  return server;
}
