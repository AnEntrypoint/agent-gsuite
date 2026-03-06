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
    console.log(`Created spreadsheet "${result.title}" with ID: ${result.spreadsheetId}`);
    return;
  }

  if (cmd === 'list') {
    const result = await sheets.listSheets(auth, parseInt(opts['max-results'] || '20', 10), opts.query);
    console.log(JSON.stringify(result.spreadsheets, null, 2));
    return;
  }

  const sheetId = args[1];
  if (!sheetId) {
    console.error('Error: sheet_id required');
    process.exit(1);
  }

  if (cmd === 'read') {
    const range = opts.range || 'Sheet1';
    const result = await sheets.readRange(auth, sheetId, range);
    console.log(JSON.stringify(result.values, null, 2));
    return;
  }

  if (cmd === 'edit') {
    if (!opts.range || !opts.values) {
      console.error('Error: --range and --values required');
      process.exit(1);
    }
    const result = await sheets.editRange(auth, sheetId, opts.range, parseJson(opts.values));
    console.log(`Updated ${result.valuesUpdated} cells`);
    return;
  }

  if (cmd === 'get-info') {
    const result = await sheets.getSheetInfo(auth, sheetId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'insert') {
    if (!opts.values) {
      console.error('Error: --values required');
      process.exit(1);
    }
    const result = await sheets.insertRows(auth, sheetId, parseJson(opts.values));
    console.log(`Inserted ${result.inserted} rows`);
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
    const result = await sheets.setCell(auth, sheetId, opts.cell, opts.value);
    console.log(`Set cell ${result.cell} to ${result.value}`);
    return;
  }

  if (cmd === 'tab') {
    if (!opts.action) {
      console.error('Error: --action required (add, delete, rename)');
      process.exit(1);
    }
    const result = await sheets.handleSheetTab(auth, sheetId, opts);
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
    console.log(`Cleared ${result.clearedCells} cells`);
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
    console.log(`Updated ${result.replies?.length || 0} operations`);
    return;
  }

  console.error('Unknown sheets command');
  process.exit(1);
}
