import { parseArgs, parseJson } from './cli-utils.js';

export async function handleSheetsCommand(auth, args, sheets) {
  const cmd = args[0];
  const opts = parseArgs(args.slice(1));

  if (cmd === 'create') {
    const title = args[1];
    if (!title) {
      console.error('Error: title required');
      process.exit(1);
    }
    const result = await sheets.createSheet(auth, title);
    console.log(`Created spreadsheet "${result.title}" with ID: ${result.sheetId}`);
    return;
  }

  if (cmd === 'list') {
    const result = await sheets.listSpreadsheets(auth, parseInt(opts['max-results'] || '20', 10), opts.query);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const sheetId = args[1];
  if (!sheetId) {
    console.error('Error: sheet_id required');
    process.exit(1);
  }

  if (cmd === 'read') {
    const range = opts.range || 'Sheet1';
    const result = await sheets.readSheet(auth, sheetId, range);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'edit') {
    if (!opts.range || !opts.values) {
      console.error('Error: --range and --values required');
      process.exit(1);
    }
    await sheets.editSheet(auth, sheetId, opts.range, parseJson(opts.values));
    console.log(`Updated range ${opts.range}`);
    return;
  }

  if (cmd === 'get-info') {
    const result = await sheets.getSpreadsheetInfo(auth, sheetId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'insert') {
    if (!opts.values) {
      console.error('Error: --values required');
      process.exit(1);
    }
    await sheets.insertSheet(auth, sheetId, parseJson(opts.values));
    console.log('Rows inserted');
    return;
  }

  if (cmd === 'get-cell') {
    if (!opts.cell) {
      console.error('Error: --cell required');
      process.exit(1);
    }
    const result = await sheets.getCell(auth, sheetId, opts.cell);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'set-cell') {
    if (!opts.cell || opts.value === undefined) {
      console.error('Error: --cell and --value required');
      process.exit(1);
    }
    await sheets.setCell(auth, sheetId, opts.cell, opts.value);
    console.log(`Set cell ${opts.cell} to ${opts.value}`);
    return;
  }

  if (cmd === 'tab') {
    if (!opts.action) {
      console.error('Error: --action required (add, delete, rename)');
      process.exit(1);
    }
    let result;
    if (opts.action === 'add') result = await sheets.addSheetTab(auth, sheetId, opts.name);
    else if (opts.action === 'delete') result = await sheets.deleteSheetTab(auth, sheetId, opts.name);
    else if (opts.action === 'rename') result = await sheets.renameSheetTab(auth, sheetId, opts['old-name'] || opts.name, opts['new-name']);
    else { console.error('Error: --action must be add, delete, or rename'); process.exit(1); }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'clear') {
    const range = args[2];
    if (!range) {
      console.error('Error: range required');
      process.exit(1);
    }
    const result = await sheets.clearRange(auth, sheetId, range, opts['clear-formats']);
    console.log(`Cleared range ${result.cleared}`);
    return;
  }

  if (cmd === 'format') {
    const range = args[2];
    if (!range) {
      console.error('Error: range required');
      process.exit(1);
    }
    const formatting = {};
    if (opts['background-color']) formatting.backgroundColor = opts['background-color'];
    if (opts['text-color']) formatting.textColor = opts['text-color'];
    if (opts.bold) formatting.bold = opts.bold === 'true';
    if (opts['font-size']) formatting.fontSize = parseInt(opts['font-size'], 10);
    const result = await sheets.formatRange(auth, sheetId, range, formatting);
    console.log(`Formatted range ${result.formatted}`);
    return;
  }

  if (cmd === 'merge') {
    const range = args[2];
    if (!range) {
      console.error('Error: range required');
      process.exit(1);
    }
    const action = opts.action || 'merge';
    const result = await sheets.mergeCells(auth, sheetId, range, action);
    console.log(`${action === 'merge' ? 'Merged' : 'Unmerged'} cells in ${range}`);
    return;
  }

  if (cmd === 'batch') {
    if (!opts.operations) {
      console.error('Error: --operations required');
      process.exit(1);
    }
    const result = await sheets.batchUpdate(auth, sheetId, parseJson(opts.operations));
    console.log(`Updated ${result.valuesUpdated} values, ${result.formatsApplied} formats`);
    return;
  }

  console.error('Unknown sheets command');
  process.exit(1);
}
