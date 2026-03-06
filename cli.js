#!/usr/bin/env node
import { getAuth } from './auth.js';
import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as sections from './docs-sections.js';
import * as media from './docs-media.js';
import * as scripts from './scripts.js';
import * as gmail from './gmail.js';

const HELP = `docmcp - Google Docs, Sheets, Drive, Gmail CLI

Commands:
  auth login                Authenticate with Google
  auth status               Check authentication status

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
        const { createOAuthClient } = await import('./sdk.js');
        const client = await createOAuthClient();
        console.log('Authentication successful!');
        return;
      }
      if (subCmd === 'status') {
        try {
          await getAuth();
          console.log('Authenticated');
        } catch (err) {
          console.log('Not authenticated:', err.message);
        }
        return;
      }
      console.error('Unknown auth subcommand. Use: login, status');
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
