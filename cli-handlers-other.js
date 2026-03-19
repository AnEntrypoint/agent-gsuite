import { parseArgs, parseJson } from './cli-utils.js';

export async function handleScriptsCommand(auth, args, scripts) {
  const cmd = args[0];
  const opts = parseArgs(args.slice(1));

  if (cmd === 'search') {
    const query = args[1];
    if (!query) {
      console.error('Error: query required');
      process.exit(1);
    }
    const result = await scripts.searchScripts(auth, query, parseInt(opts['max-results'] || '20', 10));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const sheetId = args[1];
  if (!sheetId) {
    console.error('Error: sheet_id required');
    process.exit(1);
  }

  if (cmd === 'create') {
    if (!opts['script-name']) {
      console.error('Error: --script-name required');
      process.exit(1);
    }
    const result = await scripts.createScript(auth, sheetId, opts['script-name']);
    console.log(`Created script "${result.name}" with ID: ${result.scriptId}\nURL: ${result.url}`);
    return;
  }

  if (cmd === 'list') {
    const result = await scripts.listScripts(auth, sheetId);
    let listText = JSON.stringify(result.scripts, null, 2);
    if (result.healed) listText += `\n\n(Auto-healed: removed ${result.removedCount} stale script entries)`;
    console.log(listText);
    return;
  }

  if (cmd === 'read') {
    const scriptId = args[2];
    if (!scriptId) {
      console.error('Error: script_id required');
      process.exit(1);
    }
    const result = await scripts.readScript(auth, scriptId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'write') {
    if (!opts['file-name'] || !opts.content) {
      console.error('Error: --file-name and --content required');
      process.exit(1);
    }
    const scriptId = args[2];
    if (!scriptId) {
      console.error('Error: script_id required');
      process.exit(1);
    }
    const result = await scripts.writeScript(auth, scriptId, opts['file-name'], opts.content);
    console.log(`Wrote file "${result.file}" (${result.isNew ? 'created' : 'updated'})`);
    return;
  }

  console.error('Unknown scripts command');
  process.exit(1);
}

export async function handleGmailCommand(auth, args, gmail) {
  const cmd = args[0];
  const opts = parseArgs(args.slice(1));

  if (cmd === 'list') {
    const result = await gmail.listEmails(auth, parseInt(opts['max-results'] || '20', 10), opts.query);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'search') {
    const result = await gmail.searchEmails(auth, opts.query, parseInt(opts['max-results'] || '20', 10));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'send') {
    if (!opts.to || !opts.subject || !opts.body) {
      console.error('Error: --to, --subject, --body required');
      process.exit(1);
    }
    const result = await gmail.sendEmail(auth, opts.to, opts.subject, opts.body, opts.cc, opts.bcc);
    console.log(`Sent email to ${opts.to}\nMessage ID: ${result.id}`);
    return;
  }

  console.error('Unknown gmail command');
  process.exit(1);
}

export async function handleDriveCommand(auth, args) {
  const cmd = args[0];
  const opts = parseArgs(args.slice(1));

  if (cmd === 'search') {
    const query = args[1];
    if (!query) {
      console.error('Error: query required');
      process.exit(1);
    }
    const { callTool } = await import('./sdk.js');
    const result = await callTool('drive_search', {
      query,
      max_results: parseInt(opts['max-results'] || '20', 10)
    }, auth);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error('Unknown drive command');
  process.exit(1);
}
