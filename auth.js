import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import os from 'os';

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.config', 'agent-gsuite');
const LOCAL_CONFIG_DIR = path.join(process.cwd(), '.agent-gsuite');
const ADC_FILE = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');

for (const key of ['NO_PROXY', 'no_proxy', 'GLOBAL_AGENT_NO_PROXY']) {
  if (process.env[key]) {
    process.env[key] = process.env[key]
      .split(',')
      .filter(h => !h.endsWith('googleapis.com') && !h.endsWith('google.com'))
      .join(',');
  }
}

function resolveConfigDir() {
  if (fs.existsSync(path.join(LOCAL_CONFIG_DIR, 'token.json'))) return LOCAL_CONFIG_DIR;
  if (fs.existsSync(path.join(LOCAL_CONFIG_DIR, 'config.json'))) return LOCAL_CONFIG_DIR;
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'token.json'))) return cwd;
  if (fs.existsSync(path.join(cwd, 'config.json'))) return cwd;
  return GLOBAL_CONFIG_DIR;
}

const CONFIG_DIR = resolveConfigDir();
const TOKEN_FILE = path.join(CONFIG_DIR, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic'
];

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.isAuthError = true;
  }
}

export function isAuthError(err) {
  if (!err) return false;
  if (err.isAuthError) return true;
  const status = err.code || err.status || err?.response?.status;
  if (status === 401 || status === 403) return true;
  const msg = err.message || '';
  return (
    msg.includes('invalid_grant') ||
    msg.includes('Invalid Credentials') ||
    msg.includes('Token has been expired or revoked') ||
    msg.includes('UNAUTHENTICATED')
  );
}

function loadConfig() {
  const configFile = path.join(CONFIG_DIR, 'config.json');
  if (!fs.existsSync(configFile)) return null;
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

function saveTokens(tokens, dir = CONFIG_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'token.json'), JSON.stringify(tokens, null, 2));
}

function buildOAuthClient(clientId, clientSecret, tokens) {
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials(tokens);
  client.on('tokens', updated => saveTokens({ ...tokens, ...updated }));
  return client;
}

async function refreshIfExpired(client, tokens) {
  const expiry = tokens.expiry_date;
  if (!expiry || expiry > Date.now() + 60_000) return client;
  try {
    const { credentials } = await client.refreshAccessToken();
    saveTokens({ ...tokens, ...credentials });
    client.setCredentials({ ...tokens, ...credentials });
    return client;
  } catch (err) {
    throw new AuthError(`Authentication expired and refresh failed. Run: bun x agent-gsuite auth login`);
  }
}

async function refreshIfExpiredEnvMode(client, tokens) {
  const expiry = tokens.expiry_date;
  if (!expiry || expiry > Date.now() + 60_000) return client;
  try {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials({ ...tokens, ...credentials });
    return client;
  } catch (err) {
    throw new AuthError(`Authentication expired and refresh failed. Set GSUITE_TOKENS with a fresh token.`);
  }
}

export async function getAuth() {
  if (process.env.DOCMCP_USE_ADC === '1' || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    return auth.getClient();
  }

  if (fs.existsSync(ADC_FILE) && !process.env.GOOGLE_OAUTH_CLIENT_ID) {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    return auth.getClient();
  }

  if (process.env.GSUITE_TOKENS) {
    let tokens;
    try { tokens = JSON.parse(process.env.GSUITE_TOKENS); } catch { throw new AuthError('GSUITE_TOKENS is not valid JSON'); }
    if (!tokens.client_id || !tokens.client_secret) throw new AuthError('GSUITE_TOKENS must include client_id and client_secret');
    const client = new OAuth2Client(tokens.client_id, tokens.client_secret);
    client.setCredentials(tokens);
    client.on('tokens', updated => client.setCredentials({ ...tokens, ...updated }));
    return refreshIfExpiredEnvMode(client, tokens);
  }

  const tokens = loadTokens();
  if (tokens && tokens.client_id && tokens.client_secret) {
    const client = buildOAuthClient(tokens.client_id, tokens.client_secret, tokens);
    return refreshIfExpired(client, tokens);
  }

  const config = loadConfig();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || config?.client_id;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || config?.client_secret;
  if (!clientId || !clientSecret) {
    throw new AuthError('No auth configured. Set GOOGLE_OAUTH_CLIENT_ID/SECRET or run: bun x agent-gsuite auth login');
  }

  if (!tokens) {
    throw new AuthError(`Not authenticated. Run: bun x agent-gsuite auth login`);
  }

  const client = buildOAuthClient(clientId, clientSecret, tokens);
  return refreshIfExpired(client, tokens);
}

export async function withAuth(fn) {
  try {
    return await fn();
  } catch (err) {
    if (isAuthError(err) && !(err instanceof AuthError)) {
      throw new AuthError(`Authentication expired. Run: bun x agent-gsuite auth login`);
    }
    throw err;
  }
}

export { TOKEN_FILE, CONFIG_DIR, LOCAL_CONFIG_DIR, GLOBAL_CONFIG_DIR, SCOPES, SCOPES as OAUTH_SCOPES, loadConfig, loadTokens, saveTokens };
