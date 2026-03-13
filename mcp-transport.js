import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './mcp-server.js';
import { isAuthError } from './auth.js';

export class MCPTransport {
  constructor(oauthServer) {
    this.oauthServer = oauthServer;
    this.serverMap = new Map();
    this.transportMap = new Map();
    this.sessionDocs = new Map();
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
        const getAuth = async () => {
          const auth = await this.oauthServer.getUserAuth(sessionId);
          if (!auth) throw new Error('Authentication required. Visit /login to authenticate.');
          return auth;
        };
        const hooks = {
          trackDoc: (docId, title) => {
            if (!this.sessionDocs.has(sessionId)) this.sessionDocs.set(sessionId, new Map());
            this.sessionDocs.get(sessionId).set(docId, {
              uri: `docmcp://docs/document/${docId}`,
              title: title || docId
            });
          },
          listSessionDocs: () => {
            const map = this.sessionDocs.get(sessionId);
            if (!map) return [];
            return Array.from(map.values()).map(d => ({
              uri: d.uri,
              name: d.title,
              title: d.title,
              mimeType: 'text/plain'
            }));
          }
        };
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId,
          enableJsonResponse: true
        });
        const server = buildMcpServer(getAuth, hooks);
        await server.connect(transport);
        transport.onclose = () => {
          try { server.close(); } catch (e) {}
          this.transportMap?.delete(sessionId);
          this.serverMap?.delete(sessionId);
          this.sessionDocs?.delete(sessionId);
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
      const status = isAuthError(error) ? 401 : 500;
      const msg = isAuthError(error)
        ? `${error.message} Visit /login to re-authenticate.`
        : `Connection failed: ${error.message}`;
      this.sendError(req, res, status, msg);
    }
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
