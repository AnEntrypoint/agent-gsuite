#!/usr/bin/env node
import { getAuth, CONFIG_DIR, TOKEN_FILE, LOCAL_CONFIG_DIR, GLOBAL_CONFIG_DIR, SCOPES, loadConfig, saveTokens, isAuthError } from './auth.js';
import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as sections from './docs-sections.js';
import * as media from './docs-media.js';
import * as scripts from './scripts.js';
import * as gmail from './gmail.js';

const HELP = `agent-gsuite - Google Docs, Sheets, Drive, Gmail CLI

  auth login [--cli] [--local|--global]  Authenticate with Google
  auth status               Check authentication status
  auth logout               Remove saved credentials

  docs <cmd> <id>           create, read, edit, insert, list, get-info, format,
                            insert-table, delete, get-structure, get-sections,
                            section, image (--action, --section, --content, etc)

  sheets <cmd> <id>         create, read, edit, list, get-info, get-cell,
                            set-cell, clear, insert, tab, format, merge, batch

  gmail list|search|send    List, search, or send emails
  scripts search <query>    Search Apps Scripts
  drive search <query>      Search Google Drive (--max-results)
`;

function resolveLoginDir(args) {
  if (args.includes('--global')) return GLOBAL_CONFIG_DIR;
  if (args.includes('--local')) return LOCAL_CONFIG_DIR;
  return CONFIG_DIR;
}

async function runLoginFlow(mode, loginDir) {
  const { OAuth2Client } = await import('google-auth-library');
  const cfg = loadConfig();
  const cid = process.env.GOOGLE_OAUTH_CLIENT_ID || cfg?.client_id;
  const csec = process.env.GOOGLE_OAUTH_CLIENT_SECRET || cfg?.client_secret;
  if (!cid || !csec) {
    console.error(`No OAuth credentials found.\nSet GOOGLE_OAUTH_CLIENT_ID/SECRET env vars, or add to ${loginDir}/config.json\nCreate credentials: https://console.cloud.google.com/apis/credentials`);
    process.exit(1);
  }
  console.log(`Session will be saved to: ${loginDir}`);
  return mode === 'cli' ? runCliLogin(cid, csec, OAuth2Client, loginDir) : runGuiLogin(cid, csec, OAuth2Client, loginDir);
}

async function runGuiLogin(cid, csec, OAuth2Client, loginDir) {
  const { createServer } = await import('http');
  const { default: open } = await import('open');

  const port = await getFreePort();
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const oauth2Client = new OAuth2Client(cid, csec, redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

  const tokens = await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) { res.end(); return; }
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const html = (msg) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:60px">${msg}<p>You can close this tab.</p></body></html>`); server.close(); };
      if (error) { html('<h2>Authentication canceled</h2>'); reject(new Error(`OAuth error: ${error}`)); return; }
      try {
        const { tokens } = await oauth2Client.getToken(code);
        html('<h2 style="color:#1a73e8">Authentication successful!</h2>');
        resolve(tokens);
      } catch (err) {
        html(`<h2 style="color:red">Authentication failed</h2><p>${err.message}</p>`);
        reject(err);
      }
    });
    server.listen(port, '127.0.0.1', () => {
      console.log('\nOpening browser for Google sign-in...');
      console.log(`If the browser does not open, copy this URL:\n\n  ${authUrl}\n`);
      open(authUrl).catch(() => {});
    });
    server.on('error', reject);
    setTimeout(() => { server.close(); reject(new Error('Login timed out after 5 minutes')); }, 5 * 60 * 1000);
  });

  const { default: fs } = await import('fs');
  fs.mkdirSync(loginDir, { recursive: true });
  saveTokens({ ...tokens, client_id: cid, client_secret: csec }, loginDir);
  console.log(`\nAuthenticated! Session saved to: ${loginDir}`);
}

async function runCliLogin(cid, csec, OAuth2Client, loginDir) {
  const { createInterface } = await import('readline');
  const oauth2Client = new OAuth2Client(cid, csec, 'urn:ietf:wg:oauth:2.0:oob');
  const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
  console.log(`\nOpen this URL in your browser:\n\n  ${authUrl}\n\nPaste the authorization code below.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise(resolve => rl.question('\nCode: ', ans => { rl.close(); resolve(ans.trim()); }));
  const { tokens } = await oauth2Client.getToken(code);
  const { default: fs } = await import('fs');
  fs.mkdirSync(loginDir, { recursive: true });
  saveTokens({ ...tokens, client_id: cid, client_secret: csec }, loginDir);
  console.log(`\nAuthenticated! Session saved to: ${loginDir}`);
}

async function getFreePort() {
  const { createServer } = await import('net');
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
      console.log(HELP);
      return;
    }

    if (cmd === 'auth') {
      const subCmd = args[1];
      if (subCmd === 'login') {
        const mode = args.includes('--cli') ? 'cli' : 'gui';
        const loginDir = resolveLoginDir(args);
        await runLoginFlow(mode, loginDir);
        return;
      }
      if (subCmd === 'status') {
        try {
          const auth = await getAuth();
          const info = auth.credentials;
          const expiry = info.expiry_date ? new Date(info.expiry_date).toLocaleString() : 'unknown';
          console.log(`Authenticated (token expires: ${expiry})`);
          console.log(`Token file: ${TOKEN_FILE}`);
        } catch (err) {
          console.log('Not authenticated:', err.message);
        }
        return;
      }
      if (subCmd === 'logout') {
        const { default: fs } = await import('fs');
        if (fs.existsSync(TOKEN_FILE)) {
          fs.unlinkSync(TOKEN_FILE);
          console.log('Logged out. Token removed.');
        } else {
          console.log('No active session found.');
        }
        return;
      }
      console.error('Unknown auth subcommand. Use: login, status, logout');
      process.exit(1);
    }

    const auth = await getAuth();

    if (cmd === 'docs') {
      const { handleDocsCommand } = await import('./cli-handlers-docs.js');
      return handleDocsCommand(auth, args.slice(1), docs, sections, media);
    }

    if (cmd === 'sheets') {
      const { handleSheetsCommand } = await import('./cli-handlers-sheets.js');
      return handleSheetsCommand(auth, args.slice(1), sheets);
    }

    if (cmd === 'gmail') {
      const { handleGmailCommand } = await import('./cli-handlers-other.js');
      return handleGmailCommand(auth, args.slice(1), gmail);
    }

    if (cmd === 'scripts') {
      const { handleScriptsCommand } = await import('./cli-handlers-other.js');
      return handleScriptsCommand(auth, args.slice(1), scripts);
    }

    if (cmd === 'drive') {
      const { handleDriveCommand } = await import('./cli-handlers-other.js');
      return handleDriveCommand(auth, args.slice(1));
    }

    console.error('Unknown command. Use: docs, sheets, gmail, scripts, drive, auth, help');
    process.exit(1);
  } catch (err) {
    if (isAuthError(err)) {
      const mode = process.argv.includes('--cli') ? ' --cli' : '';
      console.error(`\nAuthentication error: ${err.message}`);
      console.error(`\nRun: bun x agent-gsuite auth login${mode}`);
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  }
}

main();
