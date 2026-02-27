#!/usr/bin/env node

import http from 'http';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { google } from 'googleapis';
import open from 'open';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'async_hooks';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { OAuth2Client } from 'google-auth-library';
import { DOCS_TOOLS, SECTION_TOOLS, MEDIA_TOOLS, DRIVE_TOOLS } from './tools-docs.js';
import { SHEETS_TOOLS, SCRIPTS_TOOLS } from './tools-sheets.js';
import { GMAIL_TOOLS } from './tools-gmail.js';
import { handleDocsToolCall, handleSheetsToolCall, handleGmailToolCall } from './handlers.js';

// AsyncLocalStorage for session context
const sessionContext = new AsyncLocalStorage();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'gcloud', 'docmcp');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Auto-detect redirect URI and CORS origin from Coolify or environment
function getRedirectUri(host, port) {
  // Priority: explicit env var > Coolify URL > constructed URL
  if (process.env.REDIRECT_URI) return process.env.REDIRECT_URI;
  if (process.env.COOLIFY_URL) return `${process.env.COOLIFY_URL}/auth/callback`;
  if (process.env.COOLIFY_FQDN) return `https://${process.env.COOLIFY_FQDN}/auth/callback`;
  return `http://${host}:${port}/auth/callback`;
}

function getCorsOrigin(host, port) {
  // Priority: explicit env var > Coolify URL > constructed URL > wildcard
  if (process.env.CORS_ORIGIN) return process.env.CORS_ORIGIN;
  if (process.env.COOLIFY_URL) return process.env.COOLIFY_URL;
  if (process.env.COOLIFY_FQDN) return `https://${process.env.COOLIFY_FQDN}`;
  if (host === '0.0.0.0' || host === '127.0.0.1') return '*';
  return `http://${host}:${port}`;
}

class AuthenticatedHTTPServer {
  constructor(options = {}) {
    this.port = options.port || 3333;
    this.host = options.host || '127.0.0.1';
    this.sessionMap = new Map();
    this.oAuth2Client = null;
    this.credentials = null;
    this.transportMap = new Map();
    this.userAuthMap = new Map();
    this.initializeExpress();
    this.initializeRoutes();
    this.initializeMcpServer();
  }

  initializeExpress() {
    this.app = express();
    this.corsOrigin = getCorsOrigin(this.host, this.port);
    this.app.use(cors({
      origin: this.corsOrigin,
      credentials: true
    }));
    this.app.use(express.json({ limit: '4mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  initializeRoutes() {
    // Session context middleware - extract and validate session ID
    const sessionContextMiddleware = (req, res, next) => {
      // Extract session ID from URL params, query params, or headers
      const sessionId = req.params.sessionId || req.query.sessionId || req.headers['x-session-id'];

      // Attach to request for downstream handlers
      req.sessionId = sessionId;
      next();
    };

    // Health check
    this.app.get('/', (req, res) => {
      res.json({
        status: 'ok',
        service: 'docmcp-http-server',
        version: '1.0.0',
        endpoints: {
          login: '/auth/login',
          callback: '/auth/callback',
          sse: '/sse/:sessionId',
          message: '/message',
          status: '/status'
        },
        activeSessions: this.sessionMap.size,
        activeConnections: this.transportMap.size
      });
    });

    // Server status
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'running',
        activeSessions: this.sessionMap.size,
        activeConnections: this.transportMap.size,
        uptime: process.uptime()
      });
    });

    // Authentication routes
    this.app.get('/auth/login', (req, res) => this.handleLogin(req, res));
    this.app.get('/auth/callback', (req, res) => this.handleCallback(req, res));

    // SSE connection with session context
    this.app.get('/sse/:sessionId', sessionContextMiddleware, (req, res) => this.handleSSEConnection(req, res));

    // Message endpoint with session context
    this.app.post('/message', sessionContextMiddleware, (req, res) => this.handleMessage(req, res));

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error('HTTP Server Error:', err);
      res.status(500).json({ error: 'Internal server error', message: err.message });
    });
  }

  initializeMcpServer() {
    this.server = new Server(
      { name: 'docmcp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    const TOOLS = [...DOCS_TOOLS, ...SECTION_TOOLS, ...MEDIA_TOOLS, ...DRIVE_TOOLS, ...SHEETS_TOOLS, ...SCRIPTS_TOOLS, ...GMAIL_TOOLS];

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Get session ID from AsyncLocalStorage context
        const sessionId = sessionContext.getStore();
        if (!sessionId) {
          throw new Error('Session not found. Please authenticate first.');
        }

        const auth = await this.getUserAuth(sessionId);
        if (!auth) {
          throw new Error('Authentication required. Please login first.');
        }

        const docsResult = await handleDocsToolCall(name, args, auth);
        if (docsResult) return docsResult;

        const sheetsResult = await handleSheetsToolCall(name, args, auth);
        if (sheetsResult) return sheetsResult;

        const gmailResult = await handleGmailToolCall(name, args, auth);
        if (gmailResult) return gmailResult;

        throw new Error(`Unknown tool: ${name}`);
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true
        };
      }
    });

    console.log('MCP server initialized with', TOOLS.length, 'tools');
  }

  async loadCredentials() {
    // Check environment variables first
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (clientId && clientSecret) {
      this.credentials = {
        installed: {
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uris: [getRedirectUri(this.host, this.port)]
        }
      };
      return;
    }

    // Check config file
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      this.credentials = config.installed || config.web;
      return;
    }

    throw new Error('Google OAuth credentials not found. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.');
  }

  createOAuth2Client() {
    const { client_id, client_secret } = this.credentials.installed || this.credentials.web;
    return new google.auth.OAuth2(
      client_id,
      client_secret,
      getRedirectUri(this.host, this.port)
    );
  }

  async getUserAuth(sessionId) {
    const session = this.sessionMap.get(sessionId);
    if (!session || session.status !== 'authenticated') {
      return null;
    }

    // Reuse existing auth client
    if (this.userAuthMap.has(sessionId)) {
      return this.userAuthMap.get(sessionId);
    }

    // Create new auth client with user's tokens
    const oAuth2Client = this.createOAuth2Client();
    oAuth2Client.setCredentials(session.tokens);
    
    this.userAuthMap.set(sessionId, oAuth2Client);
    return oAuth2Client;
  }

  async handleLogin(req, res) {
    try {
      await this.loadCredentials();
      this.oAuth2Client = this.createOAuth2Client();

      const scopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/script.projects',
        'https://www.googleapis.com/auth/gmail.modify'
      ];

      const sessionId = crypto.randomBytes(16).toString('hex');
      const state = sessionId;

      const authUrl = this.oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: state,
        prompt: 'consent'
      });

      // Create session
      this.sessionMap.set(sessionId, {
        state: state,
        createdAt: Date.now(),
        status: 'authenticating'
      });

      console.log(`Created session: ${sessionId}`);

      // For remote hosting, don't open browser automatically
      if (this.host === '127.0.0.1' || this.host === 'localhost') {
        await open(authUrl);
      }

      res.json({
        success: true,
        message: 'Authentication started. Please check your browser or visit the provided URL.',
        sessionId: sessionId,
        authUrl: authUrl
      });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
        message: error.message
      });
    }
  }

  async handleCallback(req, res) {
    const { code, state, error } = req.query;

    if (error) {
      console.error('Authentication Error:', error);
      return res.status(400).json({
        success: false,
        error: 'Authentication canceled',
        message: error
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Missing code or state parameter'
      });
    }

    const session = this.sessionMap.get(state);
    if (!session) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session',
        message: 'Session not found or expired'
      });
    }

    try {
      const { tokens } = await this.oAuth2Client.getToken(code);
      
      // Update session with user's tokens
      session.status = 'authenticated';
      session.tokens = tokens;
      session.updatedAt = Date.now();

      console.log(`Session authenticated: ${state}`);

      // Return success response with session information
      res.json({
        success: true,
        message: 'Authentication successful! You can now use the MCP server.',
        sessionId: state,
        user: {
          email: tokens.email || 'unknown',
          expiry_date: tokens.expiry_date,
          token_type: tokens.token_type,
          scope: tokens.scope
        }
      });
    } catch (error) {
      console.error('Token Exchange Error:', error);
      res.status(500).json({
        success: false,
        error: 'Token exchange failed',
        message: error.message
      });
    }
  }

  async handleSSEConnection(req, res) {
    const sessionId = req.sessionId;
    const session = this.sessionMap.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'authenticated') {
      return res.status(401).json({ error: 'Session not authenticated' });
    }

    try {
      // Create SSE transport for this connection
      const transport = new SSEServerTransport('/message', res);
      this.transportMap.set(sessionId, transport);

      // Store original server handlers to restore them later
      const originalHandlers = new Map(this.server._requestHandlers || []);

      // Wrap request handlers to inject session context
      const wrappedCallToolHandler = async (request) => {
        // Run the handler in the session context
        return new Promise((resolve, reject) => {
          sessionContext.run(sessionId, async () => {
            try {
              const originalHandler = originalHandlers.get(CallToolRequestSchema);
              const result = await originalHandler.call(this.server, request);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          });
        });
      };

      this.server.setRequestHandler(CallToolRequestSchema, wrappedCallToolHandler);

      // Connect to MCP server
      await this.server.connect(transport);

      console.log(`SSE connection established for session: ${sessionId}`);

      // Handle transport close
      transport.onclose = () => {
        console.log(`SSE connection closed for session: ${sessionId}`);
        this.transportMap.delete(sessionId);
        // Restore original handlers for next session
        originalHandlers.forEach((handler, schema) => {
          this.server.setRequestHandler(schema, handler);
        });
      };

      // Start the transport
      await transport.start();
    } catch (error) {
      console.error('SSE Connection Error:', error);
      res.status(500).json({ error: 'Connection failed', message: error.message });
    }
  }

  async handleMessage(req, res) {
    const sessionId = req.sessionId || req.query.sessionId || req.headers['x-session-id'];
    const transport = this.transportMap.get(sessionId);

    if (!transport) {
      return res.status(404).json({ error: 'Session not found or connection not established' });
    }

    try {
      // Run message handling within the session context
      await sessionContext.run(sessionId, async () => {
        await transport.handlePostMessage(req, res);
      });
    } catch (error) {
      console.error('Message Handling Error:', error);
      res.status(500).json({
        success: false,
        error: 'Message handling failed',
        message: error.message
      });
    }
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(this.app);
      this.httpServer.listen(this.port, this.host, () => {
        console.log(`HTTP Streaming Server running on http://${this.host}:${this.port}`);
        console.log(`- Health check: http://${this.host}:${this.port}/`);
        console.log(`- Login endpoint: http://${this.host}:${this.port}/auth/login`);
        console.log(`- Callback endpoint: http://${this.host}:${this.port}/auth/callback`);
        console.log(`- SSE endpoint: http://${this.host}:${this.port}/sse/:sessionId`);
        console.log(`- Message endpoint: http://${this.host}:${this.port}/message`);
        console.log(`- Status endpoint: http://${this.host}:${this.port}/status`);
        console.log('');
        console.log(`OAuth Configuration:`);
        console.log(`- Redirect URI: ${getRedirectUri(this.host, this.port)}`);
        console.log(`- CORS Origin: ${this.corsOrigin}`);
        console.log('');
        console.log('To use the server:');
        console.log('1. GET /auth/login - to start Google OAuth flow');
        console.log('2. Complete authentication in browser');
        console.log('3. Use /sse/:sessionId for streaming communication');
        console.log('4. Use /message for message transmission (with sessionId query parameter)');
        resolve();
      }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${this.port} is already in use. Please try a different port.`);
        } else {
          console.error('Server startup error:', err);
        }
        reject(err);
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('HTTP Streaming Server stopped');
        resolve();
      });
    });
  }
}

// Command-line interface
if (process.argv[1] && process.argv[1].endsWith('http-server.js')) {
  const args = process.argv.slice(2);
  let port = 3333;
  let host = '127.0.0.1';

  // Parse command-line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node http-server.js [options]');
      console.log('');
      console.log('Options:');
      console.log('  --port, -p    Port number (default: 3333)');
      console.log('  --host, -H    Host address (default: 127.0.0.1)');
      console.log('  --help, -h    Show this help message');
      console.log('');
      console.log('Environment Variables:');
      console.log('  GOOGLE_OAUTH_CLIENT_ID     Google OAuth client ID');
      console.log('  GOOGLE_OAUTH_CLIENT_SECRET Google OAuth client secret');
      console.log('  REDIRECT_URI               Redirect URI for OAuth');
      console.log('  CORS_ORIGIN                Allowed CORS origins');
      process.exit(0);
    }
  }

  // Start server
  const server = new AuthenticatedHTTPServer({ port, host });
  server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    try {
      await server.stop();
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
}

export default AuthenticatedHTTPServer;