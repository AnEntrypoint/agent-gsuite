import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import open from 'open';
import { loginHtml, errorHtml, successHtml } from './oauth-html.js';
import { handleOAuthToken as createOAuthTokenHandler, handleDynamicRegistration } from './oauth-handlers.js';
import { loadCredentials, createOAuth2Client, OAUTH_SCOPES } from './oauth-auth.js';

export class OAuthServer {
  constructor(sessionManager, host, port, configDir) {
    this.sessionManager = sessionManager;
    this.host = host;
    this.port = port;
    this.configDir = configDir;
    this.configPath = path.join(configDir, 'config.json');
    this.tokenPath = path.join(configDir, 'token.json');
    this.adcPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'gcloud', 'application_default_credentials.json');
    this.credentials = null;
    this.oAuth2Client = null;
    this.userAuthMap = new Map();
    this.staticBearerTokens = new Set(
      String(process.env.DOCMCP_BEARER_TOKENS || process.env.DOCMCP_BEARER_TOKEN || '')
        .split(',').map(v => v.trim()).filter(Boolean)
    );
  }

  async loadCredentials() {
    this.credentials = await loadCredentials(this.configPath);
  }

  getRedirectUri() {
    if (process.env.REDIRECT_URI) return process.env.REDIRECT_URI;
    if (process.env.COOLIFY_URL) return `${process.env.COOLIFY_URL}/auth/callback`;
    if (process.env.COOLIFY_FQDN) return `https://${process.env.COOLIFY_FQDN}/auth/callback`;
    return `http://${this.host}:${this.port}/auth/callback`;
  }

  getCorsOrigin() {
    if (process.env.CORS_ORIGIN) return process.env.CORS_ORIGIN;
    if (process.env.COOLIFY_URL) return process.env.COOLIFY_URL;
    if (process.env.COOLIFY_FQDN) return `https://${process.env.COOLIFY_FQDN}`;
    if (this.host === '0.0.0.0' || this.host === '127.0.0.1') return '*';
    return `http://${this.host}:${this.port}`;
  }

  createOAuth2Client() {
    return createOAuth2Client(this.credentials, this.getRedirectUri());
  }

  async getUserAuth(sessionId) {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || session.status !== 'authenticated' || !session.tokens) return null;
    if (this.userAuthMap.has(sessionId)) return this.userAuthMap.get(sessionId);
    try {
      if (!this.credentials) await this.loadCredentials();
      const oauth = this.createOAuth2Client();
      oauth.setCredentials(session.tokens);
      this.userAuthMap.set(sessionId, oauth);
      return oauth;
    } catch (err) {
      console.warn(`[auth] Cannot reconstruct for ${sessionId}:`, err.message);
      return null;
    }
  }

  getStaticSessionId(bearerToken) {
    const digest = crypto.createHash('sha256').update(bearerToken).digest('hex').slice(0, 16);
    return `static_${digest}`;
  }

  isStaticSessionId(sessionId) {
    return typeof sessionId === 'string' && sessionId.startsWith('static_');
  }

  async handleLogin(req, res) {
    try {
      await this.loadCredentials();
      this.oAuth2Client = this.createOAuth2Client();
      const sessionId = crypto.randomBytes(16).toString('hex');
      const authUrl = this.oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: OAUTH_SCOPES,
        state: sessionId,
        prompt: 'consent'
      });
      this.sessionManager.setSession(sessionId, {
        state: sessionId,
        createdAt: Date.now(),
        status: 'authenticating',
        clientRedirectUri: req.query.redirect_uri || null,
        clientState: req.query.state || null,
        codeChallenge: req.query.code_challenge || null,
        codeChallengeMethod: req.query.code_challenge_method || null
      });
      if (this.host === '127.0.0.1' || this.host === 'localhost') await open(authUrl);
      res.send(loginHtml(authUrl, sessionId));
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({ success: false, error: 'Authentication failed', message: error.message });
    }
  }

  async handleCallback(req, res) {
    const { code, state, error } = req.query;
    if (error) return res.send(errorHtml('Authentication Canceled', 'You canceled the authentication process', error));
    if (!code || !state) return res.send(errorHtml('Invalid Request', 'Missing code or state parameter'));
    const session = this.sessionManager.getSession(state);
    if (!session) return res.send(errorHtml('Session Expired', 'Session not found or has expired'));
    try {
      await this.loadCredentials();
      const callbackClient = this.createOAuth2Client();
      const { tokens } = await callbackClient.getToken(code);
      session.status = 'authenticated';
      session.tokens = tokens;
      session.updatedAt = Date.now();
      this.sessionManager.setSession(state, session);
      if (session.clientRedirectUri) {
        const params = new URLSearchParams({ code: state });
        if (session.clientState) params.set('state', session.clientState);
        return res.redirect(`${session.clientRedirectUri}?${params.toString()}`);
      }
      const baseUrl = this.getCorsOrigin();
      res.send(successHtml(state, baseUrl));
    } catch (error) {
      console.error('Token Exchange Error:', error);
      res.status(500).json({ success: false, error: 'Token exchange failed', message: error.message });
    }
  }

  async handleTokenAuth(req, res) {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ success: false, error: 'Missing authorization code' });
      await this.loadCredentials();
      this.oAuth2Client = this.createOAuth2Client();
      const { tokens } = await this.oAuth2Client.getToken(code);
      const sessionId = crypto.randomBytes(16).toString('hex');
      this.sessionManager.setSession(sessionId, {
        status: 'authenticated',
        tokens,
        createdAt: Date.now(),
        authMethod: 'oauth_code_exchange',
        source: 'external_client'
      });
      const oauth = this.createOAuth2Client();
      oauth.setCredentials(tokens);
      this.userAuthMap.set(sessionId, oauth);
      res.json({ success: true, sessionId, mcp_endpoint: '/mcp' });
    } catch (error) {
      console.error('OAuth Code Exchange Error:', error);
      res.status(500).json({ success: false, error: 'OAuth code exchange failed', message: error.message });
    }
  }

  async handleRefreshAuth(req, res) {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) return res.status(400).json({ success: false, error: 'refresh_token required' });
      await this.loadCredentials();
      const oauth = this.createOAuth2Client();
      oauth.setCredentials({ refresh_token });
      const { credentials } = await oauth.refreshAccessToken();
      const sessionId = crypto.randomBytes(16).toString('hex');
      this.sessionManager.setSession(sessionId, {
        status: 'authenticated',
        tokens: credentials,
        createdAt: Date.now(),
        authMethod: 'refresh_token'
      });
      const authClient = this.createOAuth2Client();
      authClient.setCredentials(credentials);
      this.userAuthMap.set(sessionId, authClient);
      res.json({ success: true, sessionId, mcp_endpoint: `/mcp?sessionId=${sessionId}` });
    } catch (error) {
      console.error('Refresh Auth Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  handleOAuthToken(req, res) {
    return createOAuthTokenHandler(this.sessionManager)(req, res);
  }

  handleDynamicRegistration(req, res) {
    return handleDynamicRegistration(req, res);
  }

}
