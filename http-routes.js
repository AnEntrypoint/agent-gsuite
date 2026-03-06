import cors from 'cors';
import express from 'express';

export function setupRoutes(app, oauthServer, mcpTransport) {
  app.set('trust proxy', true);
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'mcp-session-id', 'mcp-protocol-version'],
    exposedHeaders: ['mcp-session-id'],
    credentials: false
  }));
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/mcp', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    next();
  });
  app.use((req, res, next) => {
    console.log('[REQ]', req.method, req.path);
    next();
  });

  const sessionMiddleware = (req, res, next) => {
    let sessionId = req.params.sessionId || req.query.sessionId || req.query.token || req.headers['x-session-id'] || req.headers['mcp-session-id'];
    const bearerToken = parseBearerToken(req.headers.authorization);
    if (!sessionId && bearerToken) sessionId = bearerToken;
    if (bearerToken && oauthServer.staticBearerTokens.has(bearerToken)) {
      sessionId = oauthServer.getStaticSessionId(bearerToken);
      req.staticBearerToken = bearerToken;
    }
    req.sessionId = sessionId;
    next();
  };

  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    const base = getBaseUrl(req, oauthServer) || `https://${req.hostname}`;
    res.json({
      resource: base,
      authorization_servers: [`${base}/.well-known/oauth-authorization-server`],
      bearer_methods_supported: ['header'],
      resource_documentation: `${base}/login`
    });
  });

  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const base = getBaseUrl(req, oauthServer) || `https://${req.hostname}`;
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/login`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256', 'plain'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['drive', 'documents', 'spreadsheets', 'script.projects', 'gmail.modify', 'gmail.settings.basic']
    });
  });

  app.get('/debug/sessions', (req, res) => {
    if (process.env.ENABLE_DEBUG_ENDPOINTS !== '1') return res.status(404).json({ error: 'Not found' });
    const sessions = [];
    for (const [id, s] of oauthServer.sessionManager.sessionMap.entries()) {
      sessions.push({ id, status: s.status, createdAt: s.createdAt });
    }
    res.json({ count: sessions.length, sessions });
  });

  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      service: 'docmcp-http-server',
      version: '1.0.0',
      description: 'Google Workspace MCP Server with OAuth authentication',
      activeSessions: oauthServer.sessionManager.size(),
      activeConnections: mcpTransport.transportMap.size
    });
  });

  app.get('/status', (req, res) => {
    res.json({
      status: 'running',
      activeSessions: oauthServer.sessionManager.size(),
      activeConnections: mcpTransport.transportMap.size,
      uptime: process.uptime()
    });
  });

  app.get('/login', (req, res) => oauthServer.handleLogin(req, res));
  app.get('/auth/callback', (req, res) => oauthServer.handleCallback(req, res));
  app.post('/auth/token', express.json(), (req, res) => oauthServer.handleTokenAuth(req, res));
  app.post('/auth/refresh', express.json(), (req, res) => oauthServer.handleRefreshAuth(req, res));
  app.post('/oauth/token', express.urlencoded({ extended: true }), express.json(), (req, res) => oauthServer.handleOAuthToken(req, res));
  app.post('/register', express.json(), (req, res) => oauthServer.handleDynamicRegistration(req, res));

  app.get('/mcp/token', sessionMiddleware, (req, res) => {
    const sessionId = req.sessionId;
    if (!sessionId || !oauthServer.sessionManager.has(sessionId) || oauthServer.sessionManager.getSession(sessionId)?.status !== 'authenticated') {
      return res.status(401).json({ error: 'Not authenticated. Visit /login first.' });
    }
    const base = getBaseUrl(req, oauthServer) || `https://${req.hostname}`;
    res.json({ token: sessionId, mcp_url: `${base}/mcp`, mcp_url_with_token: `${base}/mcp?token=${sessionId}` });
  });

  app.all('/mcp', sessionMiddleware, (req, res) => mcpTransport.handleConnection(req, res, req.sessionId));
  app.post('/mcp-json', sessionMiddleware, (req, res) => {
    req.headers.accept = 'application/json, text/event-stream';
    return mcpTransport.handleConnection(req, res, req.sessionId);
  });

  app.use((err, req, res, next) => {
    console.error('HTTP Server Error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  });
}

function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function getBaseUrl(req, oauthServer) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.COOLIFY_URL) return process.env.COOLIFY_URL;
  if (process.env.COOLIFY_FQDN) return `https://${process.env.COOLIFY_FQDN}`;
  if (req) {
    const fProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
    const fHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
    if (fProto && fHost) return `${fProto}://${fHost}`;
    const proto = req.protocol || 'http';
    const host = req.get('host');
    if (host) return `${proto}://${host}`;
  }
  return '';
}
