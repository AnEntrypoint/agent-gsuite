#!/usr/bin/env node
import { getAuth, CONFIG_DIR, TOKEN_FILE, SCOPES, saveTokens } from './auth.js';
import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as sections from './docs-sections.js';
import * as media from './docs-media.js';
import * as scripts from './scripts.js';
import * as gmail from './gmail.js';

const HELP = `agent-gsuite - Google Docs, Sheets, Drive, Gmail CLI

Commands:
  auth login                Authenticate with Google (opens browser)
  auth status               Check authentication status
  auth logout               Remove saved credentials

  docs create <title>       Create a new document
  docs read <id>            Read document content
  docs edit <id>            Edit document (--old, --new, --replace-all)
  docs insert <id>          Insert text (--text, --position/--after/--index)
  docs get-info <id>        Get document metadata
  docs list                 List documents (--max-results, --query)
  docs format <id>          Format text (--search, --bold, --italic, --heading, etc)
  docs insert-table <id>    Insert table (--rows, --cols, --position)
  docs delete <id>          Delete text from document (--text, --delete-all)
  docs get-structure <id>   Get document heading hierarchy
  docs get-sections <id>    Parse document sections
  docs section <id>         Section operations (--action, --section, --target, --content)
  docs image <id>           Image operations (--action, --image-url, --image-index, etc)

  sheets create <title>     Create a new spreadsheet
  sheets read <id>          Read sheet range (--range)
  sheets edit <id>          Edit sheet range (--range, --values)
  sheets list               List spreadsheets (--max-results, --query)
  sheets get-info <id>      Get sheet info
  sheets get-cell <id>      Get single cell (--cell)
  sheets set-cell <id>      Set cell value (--cell, --value)
  sheets clear <id>         Clear range (--range)
  sheets insert-rows <id>   Insert rows/columns (--sheet-name, --dimension, --start-index, --count)

  gmail list                List emails (--query, --max-results)
  gmail search              Search emails (--query)
  gmail send                Send email (--to, --subject, --body, --cc, --bcc)

  scripts search <query>    Search Apps Scripts by name or content

  drive search <query>      Search Google Drive (--query, --max-results)
`;

async function runLoginFlow() {
  const { OAuth2Client } = await import('google-auth-library');
  const { createServer } = await import('http');
  const { default: open } = await import('open');
  const { default: fs } = await import('fs');

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const configFile = `${CONFIG_DIR}/config.json`;
    if (!fs.existsSync(configFile)) {
      console.error(`
No OAuth credentials found. Provide them one of two ways:

  1. Environment variables:
       GOOGLE_OAUTH_CLIENT_ID=...
       GOOGLE_OAUTH_CLIENT_SECRET=...

  2. Config file at ${configFile}:
       { "client_id": "...", "client_secret": "..." }

Create OAuth credentials at: https://console.cloud.google.com/apis/credentials
Add redirect URI: http://localhost:PORT/callback  (any localhost port)
`);
      process.exit(1);
    }
  }

  const port = await getFreePort();
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  let cid = clientId;
  let csec = clientSecret;
  if (!cid) {
    const cfg = JSON.parse(fs.readFileSync(`${CONFIG_DIR}/config.json`, 'utf8'));
    cid = cfg.client_id || cfg.installed?.client_id || cfg.web?.client_id;
    csec = cfg.client_secret || cfg.installed?.client_secret || cfg.web?.client_secret;
  }

  const oauth2Client = new OAuth2Client(cid, csec, redirectUri);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  const tokens = await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) return;
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error) {
        res.end('<h2>Authentication canceled.</h2><p>You can close this tab.</p>');
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      try {
        const { tokens } = await oauth2Client.getToken(code);
        res.end('<h2>Authentication successful!</h2><p>You can close this tab and return to the terminal.</p>');
        server.close();
        resolve(tokens);
      } catch (err) {
        res.end('<h2>Authentication failed.</h2><p>' + err.message + '</p>');
        server.close();
        reject(err);
      }
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`\nOpening browser for Google sign-in...`);
      console.log(`If the browser does not open, visit:\n  ${authUrl}\n`);
      open(authUrl).catch(() => {});
    });
    server.on('error', reject);
    setTimeout(() => { server.close(); reject(new Error('Login timed out after 5 minutes')); }, 5 * 60 * 1000);
  });

  saveTokens({ ...tokens, client_id: cid, client_secret: csec });
  console.log(`\nAuthenticated successfully!`);
  console.log(`Session saved to: ${TOKEN_FILE}`);
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
        await runLoginFlow();
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
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
