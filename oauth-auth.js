import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { SCOPES } from './auth.js';

export async function loadCredentials(configPath) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { installed: { client_id: clientId, client_secret: clientSecret } };
  }
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.installed || config.web;
  }
  throw new Error('Google OAuth credentials not found');
}

export function createOAuth2Client(credentials, redirectUri) {
  const { client_id, client_secret } = credentials.installed || credentials.web || credentials;
  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

export const OAUTH_SCOPES = SCOPES;
