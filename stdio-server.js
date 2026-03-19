#!/usr/bin/env node
import { createClient, createOAuthClient, createTokenClient, createADCClient } from './sdk.js';
import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS, SHEETS_TOOLS, SCRIPTS_TOOLS, GMAIL_TOOLS } from './tools.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getAuth } from './auth.js';



import { handleDocsToolCall, handleSheetsToolCall, handleGmailToolCall } from './handlers.js';
import { enrichToolsForApps } from './apps-metadata.js';
import { listStaticResources, listResourceTemplates, readResource } from './mcp-resources.js';

const TOOLS = enrichToolsForApps([
  ...DOCS_TOOLS,
  ...SECTION_TOOLS,
  ...MEDIA_TOOLS,
  ...DRIVE_TOOLS,
  ...SHEETS_TOOLS,
  ...SCRIPTS_TOOLS,
  ...GMAIL_TOOLS
]);

export async function handleToolCall(name, args) {
  const auth = await getAuth();

  const docsResult = await handleDocsToolCall(name, args, auth);
  if (docsResult) return docsResult;

  const sheetsResult = await handleSheetsToolCall(name, args, auth);
  if (sheetsResult) return sheetsResult;

  const gmailResult = await handleGmailToolCall(name, args, auth);
  if (gmailResult) return gmailResult;

  throw new Error(`Unknown tool: ${name}`);
}

const server = new Server(
  { name: 'docmcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleToolCall(name, args);
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: listStaticResources() };
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return { resourceTemplates: listResourceTemplates() };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const auth = await getAuth();
    return await readResource(auth, request.params.uri);
  } catch (err) {
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'text/plain',
          text: `Error reading resource: ${err.message}`
        }
      ]
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
