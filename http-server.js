#!/usr/bin/env node
import http from 'http';
import express from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { SessionManager } from './http-session.js';
import { OAuthServer } from './oauth-server.js';
import { MCPTransport } from './mcp-transport.js';
import { setupRoutes } from './http-routes.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'gcloud', 'docmcp');

class AuthenticatedHTTPServer {
  constructor(options = {}) {
    this.port = options.port || 3333;
    this.host = options.host || '127.0.0.1';
    this.app = express();
    this.sessionContext = new AsyncLocalStorage();

    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

    this.sessionManager = new SessionManager();
    this.oauthServer = new OAuthServer(this.sessionManager, this.host, this.port, CONFIG_DIR);
    this.mcpTransport = new MCPTransport(this.oauthServer);
    this.mcpTransport.setSessionContext(this.sessionContext);
  }

  async initialize() {
    setupRoutes(this.app, this.oauthServer, this.mcpTransport);
    this.httpServer = http.createServer(this.app);
    return this;
  }

  async listen() {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, this.host, () => {
        console.log(`HTTP MCP Server listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      for (const transport of this.mcpTransport.transportMap.values()) {
        try { transport.close(); } catch (e) {}
      }
      this.httpServer.close(() => resolve());
    });
  }
}

async function main() {
  const port = parseInt(process.env.PORT || '3333');
  const host = process.env.HOST || '127.0.0.1';
  const server = new AuthenticatedHTTPServer({ port, host });
  await server.initialize();
  await server.listen();
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
