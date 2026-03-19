import { google } from 'googleapis';

function parseColor(hex) {
  if (!hex) return null;
  hex = hex.replace('#', '');
  if (hex.length !== 6) return null;
  return { red: parseInt(hex.substring(0, 2), 16) / 255, green: parseInt(hex.substring(2, 4), 16) / 255, blue: parseInt(hex.substring(4, 6), 16) / 255 };
}

function parseA1(range) {
  const m = range.match(/^(?:([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!m) return null;
  const c2n = (col) => { let n = 0; for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  return { sheetName: m[1] || null, startCol: c2n(m[2]), startRow: parseInt(m[3]) - 1, endCol: m[4] ? c2n(m[4]) : c2n(m[2]), endRow: m[5] ? parseInt(m[5]) - 1 : parseInt(m[3]) - 1 };
}

function colToNum(col) { if (typeof col === 'number') return col; let n = 0; for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

async function resolveTab(s, sheet_id, name) {
  const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
  const tab = sp.data.sheets.find(t => t.properties.title === name);
  if (!tab) throw new Error(`Tab not found: ${name}`);
  return tab;
}

export async function create(auth, { title }) {
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.create({ requestBody: { properties: { title } } });
  return { sheetId: r.data.spreadsheetId, title: r.data.properties.title };
}

export async function read(auth, { sheet_id, range = 'Sheet1' }) {
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.values.get({ spreadsheetId: sheet_id, range });
  return r.data.values || [];
}

export async function edit(auth, { sheet_id, range, values }) {
  const s = google.sheets({ version: 'v4', auth });
  await s.spreadsheets.values.update({ spreadsheetId: sheet_id, range, valueInputOption: 'USER_ENTERED', requestBody: { values } });
  return { updated: range };
}

export async function insert(auth, { sheet_id, range = 'Sheet1', values }) {
  const s = google.sheets({ version: 'v4', auth });
  await s.spreadsheets.values.append({ spreadsheetId: sheet_id, range, valueInputOption: 'USER_ENTERED', requestBody: { values } });
  return { appended: true };
}

export async function getCell(auth, { sheet_id, cell }) {
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.values.get({ spreadsheetId: sheet_id, range: cell });
  return { value: r.data.values?.[0]?.[0] ?? null };
}

export async function setCell(auth, { sheet_id, cell, value }) {
  const s = google.sheets({ version: 'v4', auth });
  await s.spreadsheets.values.update({ spreadsheetId: sheet_id, range: cell, valueInputOption: 'USER_ENTERED', requestBody: { values: [[value]] } });
  return { set: cell };
}

export async function editCell(auth, { sheet_id, cell, old_text, new_text, replace_all = false }) {
  const { value } = await getCell(auth, { sheet_id, cell });
  if (value === null) throw new Error(`Cell ${cell} is empty`);
  const text = String(value);
  let count = 0, pos = 0;
  while ((pos = text.indexOf(old_text, pos)) !== -1) { count++; pos += old_text.length; }
  if (count === 0) throw new Error(`old_text not found in cell ${cell}`);
  if (count > 1 && !replace_all) throw new Error(`old_text appears ${count} times. Use replace_all.`);
  const updated = replace_all ? text.split(old_text).join(new_text) : text.replace(old_text, new_text);
  await setCell(auth, { sheet_id, cell, value: updated });
  return { replacements: replace_all ? count : 1 };
}

export async function findReplace(auth, { sheet_id, find, replace, sheet_name = null }) {
  const s = google.sheets({ version: 'v4', auth });
  const req = { findReplace: { find, replacement: replace, allSheets: !sheet_name, matchEntireCell: false, matchCase: false } };
  if (sheet_name) {
    const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
    const tab = sp.data.sheets.find(t => t.properties.title === sheet_name);
    if (!tab) throw new Error(`Sheet tab not found: ${sheet_name}`);
    req.findReplace.sheetId = tab.properties.sheetId;
  }
  const r = await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [req] } });
  return { replacements: r.data.replies?.[0]?.findReplace?.occurrencesChanged || 0 };
}

export async function getInfo(auth, { sheet_id }) {
  const s = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
  const info = { id: sp.data.spreadsheetId, title: sp.data.properties.title, sheets: sp.data.sheets.map(t => ({ sheetId: t.properties.sheetId, title: t.properties.title, index: t.properties.index, rowCount: t.properties.gridProperties.rowCount, columnCount: t.properties.gridProperties.columnCount, frozen: { rows: t.properties.gridProperties.frozenRowCount || 0, columns: t.properties.gridProperties.frozenColumnCount || 0 } })) };
  try { const f = await drive.files.get({ fileId: sheet_id, fields: 'id,name,createdTime,modifiedTime,owners' }); info.createdTime = f.data.createdTime; info.modifiedTime = f.data.modifiedTime; info.owners = f.data.owners?.map(o => ({ name: o.displayName, email: o.emailAddress })) || []; } catch (_) {}
  return info;
}

export async function list(auth, { max_results = 20, query = null } = {}) {
  const drive = google.drive({ version: 'v3', auth });
  let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  if (query) q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  const r = await drive.files.list({ q, pageSize: max_results, orderBy: 'modifiedTime desc', fields: 'files(id,name,createdTime,modifiedTime)' });
  return r.data.files || [];
}

export async function clear(auth, { sheet_id, range, clear_formats = false }) {
  const s = google.sheets({ version: 'v4', auth });
  if (clear_formats) {
    const parsed = parseA1(range);
    if (!parsed) throw new Error(`Invalid range: ${range}`);
    const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
    let tab = sp.data.sheets[0];
    if (parsed.sheetName) { tab = sp.data.sheets.find(t => t.properties.title === parsed.sheetName); if (!tab) throw new Error(`Tab not found: ${parsed.sheetName}`); }
    await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ updateCells: { range: { sheetId: tab.properties.sheetId, startRowIndex: parsed.startRow, endRowIndex: parsed.endRow + 1, startColumnIndex: parsed.startCol, endColumnIndex: parsed.endCol + 1 }, fields: 'userEnteredValue,userEnteredFormat' } }] } });
  } else { await s.spreadsheets.values.clear({ spreadsheetId: sheet_id, range }); }
  return { cleared: range };
}

export async function getFormula(auth, { sheet_id, cell }) {
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.get({ spreadsheetId: sheet_id, ranges: [cell], fields: 'sheets.data.rowData.values(userEnteredValue,effectiveValue,formattedValue)' });
  const d = r.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0];
  if (!d) return { value: null, formula: null };
  return { value: d.effectiveValue?.numberValue ?? d.effectiveValue?.stringValue ?? d.formattedValue ?? null, formula: d.userEnteredValue?.formulaValue || null, formattedValue: d.formattedValue || null };
}

export async function tab(auth, { sheet_id, action, title, sheet_name }) {
  const s = google.sheets({ version: 'v4', auth });
  if (action === 'add') {
    const r = await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
    const ns = r.data.replies[0].addSheet;
    return { sheetId: ns.properties.sheetId, title: ns.properties.title };
  }
  if (action === 'delete') {
    const t = await resolveTab(s, sheet_id, sheet_name);
    await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ deleteSheet: { sheetId: t.properties.sheetId } }] } });
    return { deleted: sheet_name };
  }
  if (action === 'rename') {
    const t = await resolveTab(s, sheet_id, sheet_name);
    await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: t.properties.sheetId, title }, fields: 'title' } }] } });
    return { oldName: sheet_name, newName: title };
  }
  throw new Error(`Unknown tab action: ${action}`);
}

export async function format(auth, { sheet_id, range, background_color, text_color, bold, italic, font_size, font_family, horizontal_alignment, vertical_alignment, wrap_strategy, number_format, borders }) {
  const s = google.sheets({ version: 'v4', auth });
  const parsed = parseA1(range);
  if (!parsed) throw new Error(`Invalid range: ${range}`);
  const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
  let t = sp.data.sheets[0];
  if (parsed.sheetName) { t = sp.data.sheets.find(x => x.properties.title === parsed.sheetName); if (!t) throw new Error(`Tab not found: ${parsed.sheetName}`); }
  const cf = {}, fields = [];
  if (background_color) { const c = parseColor(background_color); if (c) { cf.backgroundColor = c; fields.push('userEnteredFormat.backgroundColor'); } }
  if (text_color) { const c = parseColor(text_color); if (c) { cf.textFormat = cf.textFormat || {}; cf.textFormat.foregroundColor = c; fields.push('userEnteredFormat.textFormat.foregroundColor'); } }
  if (bold !== undefined) { cf.textFormat = cf.textFormat || {}; cf.textFormat.bold = bold; fields.push('userEnteredFormat.textFormat.bold'); }
  if (italic !== undefined) { cf.textFormat = cf.textFormat || {}; cf.textFormat.italic = italic; fields.push('userEnteredFormat.textFormat.italic'); }
  if (font_size) { cf.textFormat = cf.textFormat || {}; cf.textFormat.fontSize = font_size; fields.push('userEnteredFormat.textFormat.fontSize'); }
  if (font_family) { cf.textFormat = cf.textFormat || {}; cf.textFormat.fontFamily = font_family; fields.push('userEnteredFormat.textFormat.fontFamily'); }
  if (horizontal_alignment) { cf.horizontalAlignment = horizontal_alignment.toUpperCase(); fields.push('userEnteredFormat.horizontalAlignment'); }
  if (vertical_alignment) { cf.verticalAlignment = vertical_alignment.toUpperCase(); fields.push('userEnteredFormat.verticalAlignment'); }
  if (wrap_strategy) { cf.wrapStrategy = wrap_strategy.toUpperCase(); fields.push('userEnteredFormat.wrapStrategy'); }
  if (number_format) { cf.numberFormat = { type: number_format.type || 'NUMBER', pattern: number_format.pattern || '' }; fields.push('userEnteredFormat.numberFormat'); }
  const rangeObj = { sheetId: t.properties.sheetId, startRowIndex: parsed.startRow, endRowIndex: parsed.endRow + 1, startColumnIndex: parsed.startCol, endColumnIndex: parsed.endCol + 1 };
  const requests = [];
  if (fields.length > 0) requests.push({ repeatCell: { range: rangeObj, cell: { userEnteredFormat: cf }, fields: fields.join(',') } });
  if (borders) {
    const bs = { style: borders.style || 'SOLID', color: parseColor(borders.color) || { red: 0, green: 0, blue: 0 } };
    requests.push({ updateBorders: { range: rangeObj, top: bs, bottom: bs, left: bs, right: bs, innerHorizontal: borders.inner ? bs : undefined, innerVertical: borders.inner ? bs : undefined } });
  }
  if (requests.length === 0) throw new Error('No formatting options');
  await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests } });
  return { formatted: range };
}

export async function merge(auth, { sheet_id, range, action = 'merge' }) {
  const s = google.sheets({ version: 'v4', auth });
  const parsed = parseA1(range);
  if (!parsed) throw new Error(`Invalid range: ${range}`);
  const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
  let t = sp.data.sheets[0];
  if (parsed.sheetName) { t = sp.data.sheets.find(x => x.properties.title === parsed.sheetName); if (!t) throw new Error(`Tab not found`); }
  const r = { sheetId: t.properties.sheetId, startRowIndex: parsed.startRow, endRowIndex: parsed.endRow + 1, startColumnIndex: parsed.startCol, endColumnIndex: parsed.endCol + 1 };
  const req = action === 'unmerge' ? { unmergeCells: { range: r } } : { mergeCells: { range: r, mergeType: 'MERGE_ALL' } };
  await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [req] } });
  return action === 'unmerge' ? { unmerged: range } : { merged: range };
}

export async function freeze(auth, { sheet_id, sheet_name, rows = 0, columns = 0 }) {
  const s = google.sheets({ version: 'v4', auth });
  const t = await resolveTab(s, sheet_id, sheet_name);
  await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId: t.properties.sheetId, gridProperties: { frozenRowCount: rows, frozenColumnCount: columns } }, fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount' } }] } });
  return { frozenRows: rows, frozenColumns: columns };
}

export async function sort(auth, { sheet_id, range, sort_column, ascending = true }) {
  const s = google.sheets({ version: 'v4', auth });
  const parsed = parseA1(range);
  if (!parsed) throw new Error(`Invalid range: ${range}`);
  const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
  let t = sp.data.sheets[0];
  if (parsed.sheetName) { t = sp.data.sheets.find(x => x.properties.title === parsed.sheetName); if (!t) throw new Error(`Tab not found`); }
  const col = typeof sort_column === 'number' ? sort_column : colToNum(sort_column);
  await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ sortRange: { range: { sheetId: t.properties.sheetId, startRowIndex: parsed.startRow, endRowIndex: parsed.endRow + 1, startColumnIndex: parsed.startCol, endColumnIndex: parsed.endCol + 1 }, sortSpecs: [{ dimensionIndex: col, sortOrder: ascending ? 'ASCENDING' : 'DESCENDING' }] } }] } });
  return { sorted: range, column: sort_column, ascending };
}

export async function rowsCols(auth, { sheet_id, sheet_name, action, dimension, start_index, count }) {
  const s = google.sheets({ version: 'v4', auth });
  const t = await resolveTab(s, sheet_id, sheet_name);
  const dim = dimension.toUpperCase() === 'ROW' ? 'ROWS' : 'COLUMNS';
  const r = { sheetId: t.properties.sheetId, dimension: dim, startIndex: start_index, endIndex: start_index + count };
  const req = action === 'delete' ? { deleteDimension: { range: r } } : { insertDimension: { range: r, inheritFromBefore: start_index > 0 } };
  await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [req] } });
  return { action, dimension, startIndex: start_index, count };
}

export async function dimensionSize(auth, { sheet_id, sheet_name, dimension, start, end, size }) {
  const s = google.sheets({ version: 'v4', auth });
  const t = await resolveTab(s, sheet_id, sheet_name);
  let si, ei;
  if (dimension.toUpperCase() === 'COLUMN') { si = colToNum(start); ei = colToNum(end) + 1; }
  else { si = (typeof start === 'number' ? start : parseInt(start)) - 1; ei = typeof end === 'number' ? end : parseInt(end); }
  await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: [{ updateDimensionProperties: { range: { sheetId: t.properties.sheetId, dimension: dimension.toUpperCase() === 'COLUMN' ? 'COLUMNS' : 'ROWS', startIndex: si, endIndex: ei }, properties: { pixelSize: size }, fields: 'pixelSize' } }] } });
  return { dimension, start, end, size };
}

export async function batch(auth, { sheet_id, operations }) {
  const s = google.sheets({ version: 'v4', auth });
  const valueUpdates = [], formatRequests = [];
  for (const op of operations) {
    if (op.type === 'setValue') valueUpdates.push({ range: op.range, values: op.values });
    else if (op.type === 'format') {
      const parsed = parseA1(op.range);
      if (!parsed) continue;
      const sp = await s.spreadsheets.get({ spreadsheetId: sheet_id });
      let t = sp.data.sheets[0];
      if (parsed.sheetName) t = sp.data.sheets.find(x => x.properties.title === parsed.sheetName);
      const cf = {};
      if (op.backgroundColor) { const hex = op.backgroundColor.replace('#', ''); cf.backgroundColor = { red: parseInt(hex.substring(0, 2), 16) / 255, green: parseInt(hex.substring(2, 4), 16) / 255, blue: parseInt(hex.substring(4, 6), 16) / 255 }; }
      if (op.bold !== undefined) { cf.textFormat = cf.textFormat || {}; cf.textFormat.bold = op.bold; }
      formatRequests.push({ repeatCell: { range: { sheetId: t.properties.sheetId, startRowIndex: parsed.startRow, endRowIndex: parsed.endRow + 1, startColumnIndex: parsed.startCol, endColumnIndex: parsed.endCol + 1 }, cell: { userEnteredFormat: cf }, fields: 'userEnteredFormat' } });
    }
  }
  const results = { valuesUpdated: 0, formatsApplied: 0 };
  if (valueUpdates.length > 0) { await s.spreadsheets.values.batchUpdate({ spreadsheetId: sheet_id, requestBody: { valueInputOption: 'USER_ENTERED', data: valueUpdates } }); results.valuesUpdated = valueUpdates.length; }
  if (formatRequests.length > 0) { await s.spreadsheets.batchUpdate({ spreadsheetId: sheet_id, requestBody: { requests: formatRequests } }); results.formatsApplied = formatRequests.length; }
  return results;
}
