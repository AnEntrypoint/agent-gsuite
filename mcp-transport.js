import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS } from './tools-docs.js';
import { SHEETS_TOOLS, SCRIPTS_TOOLS } from './tools-sheets.js';
import { GMAIL_TOOLS } from './tools-gmail.js';
import { handleDocsToolCall, handleSheetsToolCall, handleGmailToolCall } from './handlers.js';
import { enrichToolsForApps } from './apps-metadata.js';
import { listStaticResources, listResourceTemplates, readPublicResource, readResource } from './mcp-resources.js';

export class MCPTransport {
  constructor(oauthServer) {
    this.oauthServer = oauthServer;
    this.serverMap = new Map();
    this.transportMap = new Map();
    this.sessionContext = null;
    this.tools = enrichToolsForApps([
      ...DOCS_TOOLS,
      ...SECTION_TOOLS,
      ...MEDIA_TOOLS,
      ...DRIVE_TOOLS,
      ...SHEETS_TOOLS,
      ...SCRIPTS_TOOLS,
      ...GMAIL_TOOLS
    ]);
  }

  setSessionContext(sessionContext) {
    this.sessionContext = sessionContext;
  }

  async handleConnection(req, res, sessionId) {
    try {
      if (!sessionId || !this.oauthServer.sessionManager.has(sessionId)) {
        return this.sendError(req, res, 401, 'Authentication required');
      }

      const isReInit = (req.body || {}).method === 'initialize' && this.transportMap.has(sessionId);
      if (isReInit) {
        const old = this.transportMap.get(sessionId);
        this.transportMap.delete(sessionId);
        this.serverMap.delete(sessionId);
        try { old.close(); } catch (e) {}
      }

      if (!this.transportMap.has(sessionId)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId,
          enableJsonResponse: true
        });
        const server = this.buildMcpServer(sessionId);
        await server.connect(transport);
        transport.onclose = () => {
          try { server.close(); } catch (e) {}
          this.transportMap?.delete(sessionId);
          this.serverMap?.delete(sessionId);
        };
        this.transportMap.set(sessionId, transport);
        this.serverMap.set(sessionId, server);
      }

      if (!req.headers['mcp-session-id']) {
        req.headers['mcp-session-id'] = sessionId;
        req.rawHeaders.push('mcp-session-id', sessionId);
      }

      await this.transportMap.get(sessionId).handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP Connection Error:', error);
      this.sendError(req, res, 500, `Connection failed: ${error.message}`);
    }
  }

  buildMcpServer(sessionId) {
    const server = new Server(
      { name: 'docmcp', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.tools }));
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listStaticResources() }));
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: listResourceTemplates() }));

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const auth = await this.oauthServer.getUserAuth(sessionId);
        if (!auth) throw new Error('Authentication required');
        return await readResource(auth, request.params.uri);
      } catch (err) {
        return {
          contents: [{ uri: request.params.uri, mimeType: 'text/plain', text: `Error: ${err.message}` }]
        };
      }
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const auth = await this.oauthServer.getUserAuth(sessionId);
        if (!auth) throw new Error('Authentication required');

        const docsResult = await handleDocsToolCall(name, args, auth);
        if (docsResult) return docsResult;

        const sheetsResult = await handleSheetsToolCall(name, args, auth);
        if (sheetsResult) return sheetsResult;

        const gmailResult = await handleGmailToolCall(name, args, auth);
        if (gmailResult) return gmailResult;

        throw new Error(`Unknown tool: ${name}`);
      } catch (err) {
        console.error(`[tool:${name}] Error:`, err.message);
        return {
          content: [{ type: 'text', text: `Error calling ${name}: ${err.message}` }],
          isError: true
        };
      }
    });

    return server;
  }

  sendError(req, res, status, error) {
    if (res.headersSent) return;
    const accept = String(req?.headers?.accept || '').toLowerCase();
    if (accept.includes('application/json') || req?.method === 'POST') {
      res.status(status).set('Content-Type', 'application/json').json({ error });
      return;
    }
    res.status(status).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
    res.end();
  }
}
