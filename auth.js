import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'agent-gsuite');
const TOKEN_FILE = path.join(CONFIG_DIR, 'token.json');
const ADC_FILE = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.scriptruntime',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic'
];

function loadConfig() {
  const configFile = path.join(CONFIG_DIR, 'config.json');
  if (!fs.existsSync(configFile)) return null;
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
}

function saveTokens(tokens) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
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

  const tokens = loadTokens();
  if (tokens && tokens.client_id && tokens.client_secret) {
    const client = new OAuth2Client(tokens.client_id, tokens.client_secret);
    client.setCredentials(tokens);
    client.on('tokens', updated => saveTokens({ ...tokens, ...updated }));
    return client;
  }

  const config = loadConfig();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || config?.client_id;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || config?.client_secret;
  if (!clientId || !clientSecret) {
    throw new Error('No auth configured. Set GOOGLE_OAUTH_CLIENT_ID/SECRET or run: bun x agent-gsuite auth login');
  }

  if (!tokens) {
    throw new Error(`Not authenticated. Run: bun x agent-gsuite auth login`);
  }

  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials(tokens);
  client.on('tokens', updated => saveTokens({ ...tokens, ...updated }));
  return client;
}

export { TOKEN_FILE, CONFIG_DIR, SCOPES, loadConfig, loadTokens, saveTokens };
