#!/usr/bin/env node
import { getAuth, runAuthFlow } from './auth.mjs';
import * as docs from './docs.mjs';
import * as sheets from './sheets.mjs';
import * as scripts from './scripts.mjs';
import * as gmail from './gmail.mjs';

const COMMANDS = {
  'docs.create': (a, p) => docs.create(a, p),
  'docs.read': (a, p) => docs.read(a, p),
  'docs.edit': (a, p) => docs.edit(a, p),
  'docs.insert': (a, p) => docs.insert(a, p),
  'docs.delete': (a, p) => docs.deleteText(a, p),
  'docs.format': (a, p) => docs.format(a, p),
  'docs.insert_table': (a, p) => docs.insertTable(a, p),
  'docs.get_info': (a, p) => docs.getInfo(a, p),
  'docs.get_structure': (a, p) => docs.getStructure(a, p),
  'docs.list': (a, p) => docs.list(a, p),
  'docs.get_sections': (a, p) => docs.getSections(a, p),
  'docs.section': (a, p) => docs.section(a, p),
  'docs.image': (a, p) => docs.image(a, p),
  'docs.batch': (a, p) => docs.batch(a, p),
  'docs_create': (a, p) => docs.create(a, p),
  'docs_read': (a, p) => docs.read(a, p),
  'docs_edit': (a, p) => docs.edit(a, p),
  'docs_insert': (a, p) => docs.insert(a, p),
  'docs_delete': (a, p) => docs.deleteText(a, p),
  'docs_format': (a, p) => docs.format(a, p),
  'docs_insert_table': (a, p) => docs.insertTable(a, p),
  'docs_get_info': (a, p) => docs.getInfo(a, p),
  'docs_get_structure': (a, p) => docs.getStructure(a, p),
  'docs_list': (a, p) => docs.list(a, p),
  'docs_get_sections': (a, p) => docs.getSections(a, p),
  'docs_section': (a, p) => docs.section(a, p),
  'docs_image': (a, p) => docs.image(a, p),
  'docs_batch': (a, p) => docs.batch(a, p),
  'drive.search': (a, p) => docs.searchDrive(a, p),
  'drive_search': (a, p) => docs.searchDrive(a, p),
  'sheets.create': (a, p) => sheets.create(a, p),
  'sheets.read': (a, p) => sheets.read(a, p),
  'sheets.edit': (a, p) => sheets.edit(a, p),
  'sheets.insert': (a, p) => sheets.insert(a, p),
  'sheets.get_cell': (a, p) => sheets.getCell(a, p),
  'sheets.set_cell': (a, p) => sheets.setCell(a, p),
  'sheets.edit_cell': (a, p) => sheets.editCell(a, p),
  'sheets.find_replace': (a, p) => sheets.findReplace(a, p),
  'sheets.get_info': (a, p) => sheets.getInfo(a, p),
  'sheets.list': (a, p) => sheets.list(a, p),
  'sheets.clear': (a, p) => sheets.clear(a, p),
  'sheets.get_formula': (a, p) => sheets.getFormula(a, p),
  'sheets.tab': (a, p) => sheets.tab(a, p),
  'sheets.format': (a, p) => sheets.format(a, p),
  'sheets.merge': (a, p) => sheets.merge(a, p),
  'sheets.freeze': (a, p) => sheets.freeze(a, p),
  'sheets.sort': (a, p) => sheets.sort(a, p),
  'sheets.rows_cols': (a, p) => sheets.rowsCols(a, p),
  'sheets.dimension_size': (a, p) => sheets.dimensionSize(a, p),
  'sheets.batch': (a, p) => sheets.batch(a, p),
  'sheets_create': (a, p) => sheets.create(a, p),
  'sheets_read': (a, p) => sheets.read(a, p),
  'sheets_edit': (a, p) => sheets.edit(a, p),
  'sheets_insert': (a, p) => sheets.insert(a, p),
  'sheets_get_cell': (a, p) => sheets.getCell(a, p),
  'sheets_set_cell': (a, p) => sheets.setCell(a, p),
  'sheets_edit_cell': (a, p) => sheets.editCell(a, p),
  'sheets_find_replace': (a, p) => sheets.findReplace(a, p),
  'sheets_get_info': (a, p) => sheets.getInfo(a, p),
  'sheets_list': (a, p) => sheets.list(a, p),
  'sheets_clear': (a, p) => sheets.clear(a, p),
  'sheets_get_formula': (a, p) => sheets.getFormula(a, p),
  'sheets_tab': (a, p) => sheets.tab(a, p),
  'sheets_format': (a, p) => sheets.format(a, p),
  'sheets_merge': (a, p) => sheets.merge(a, p),
  'sheets_freeze': (a, p) => sheets.freeze(a, p),
  'sheets_sort': (a, p) => sheets.sort(a, p),
  'sheets_rows_cols': (a, p) => sheets.rowsCols(a, p),
  'sheets_dimension_size': (a, p) => sheets.dimensionSize(a, p),
  'sheets_batch': (a, p) => sheets.batch(a, p),
  'scripts.create': (a, p) => scripts.createScript(a, p),
  'scripts.list': (a, p) => scripts.listScripts(a, p),
  'scripts.read': (a, p) => scripts.readScript(a, p),
  'scripts.write': (a, p) => scripts.writeScript(a, p),
  'scripts.edit': (a, p) => scripts.writeScript(a, { ...p, mode: 'edit' }),
  'scripts.delete': (a, p) => scripts.deleteScript(a, p),
  'scripts.run': (a, p) => scripts.runScript(a, p),
  'scripts.sync': (a, p) => scripts.syncScripts(a, p),
  'scripts_search': (a, p) => scripts.searchScripts(a, p),
  'scripts_create': (a, p) => scripts.createScript(a, p),
  'scripts_list': (a, p) => scripts.listScripts(a, p),
  'scripts_read': (a, p) => scripts.readScript(a, p),
  'scripts_write': (a, p) => scripts.writeScript(a, p),
  'scripts_delete': (a, p) => scripts.deleteScript(a, p),
  'scripts_run': (a, p) => scripts.runScript(a, p),
  'scripts_sync': (a, p) => scripts.syncScripts(a, p),
  'gmail.list_messages': (a, p) => gmail.listMessages(a, p),
  'gmail.get_message': (a, p) => gmail.getMessage(a, p),
  'gmail.send_message': (a, p) => gmail.sendMessage(a, p),
  'gmail.list_threads': (a, p) => gmail.listThreads(a, p),
  'gmail.get_thread': (a, p) => gmail.getThread(a, p),
  'gmail.modify_message': (a, p) => gmail.modifyMessage(a, p),
  'gmail.delete_message': (a, p) => gmail.deleteMessage(a, p),
  'gmail.trash_message': (a, p) => gmail.trashMessage(a, p),
  'gmail.list_labels': (a, p) => gmail.getLabels(a, p),
  'gmail_list': (a, p) => gmail.listMessages(a, p),
  'gmail_search': (a, p) => gmail.searchMessages(a, p),
  'gmail_read': (a, p) => gmail.getMessage(a, p),
  'gmail_get_attachments': (a, p) => gmail.getAttachments(a, p),
  'gmail_download_attachment': (a, p) => gmail.downloadAttachment(a, p),
  'gmail_get_labels': (a, p) => gmail.getLabels(a),
  'gmail_create_label': (a, p) => gmail.createLabel(a, p),
  'gmail_update_label': (a, p) => gmail.updateLabel(a, p),
  'gmail_delete_label': (a, p) => gmail.deleteLabel(a, p),
  'gmail_list_filters': (a, p) => gmail.listFilters(a),
  'gmail_get_filter': (a, p) => gmail.getFilter(a, p),
  'gmail_create_filter': (a, p) => gmail.createFilter(a, p),
  'gmail_delete_filter': (a, p) => gmail.deleteFilter(a, p),
  'gmail_replace_filter': (a, p) => gmail.replaceFilter(a, p),
  'gmail_send': (a, p) => gmail.sendMessage(a, p),
  'gmail_delete': (a, p) => gmail.deleteMessage(a, p),
  'gmail_trash': (a, p) => gmail.trashMessage(a, p),
  'gmail_modify_labels': (a, p) => gmail.modifyMessage(a, p),
  'gmail_bulk_modify_labels': (a, p) => gmail.bulkModifyLabels(a, p),
};

async function main() {
  const [command, argsJson] = process.argv.slice(2);

  if (!command || command === 'help') {
    console.log(JSON.stringify({ commands: Object.keys(COMMANDS).filter(k => k.includes('.')), usage: 'gsuite.mjs <command> \'<json-args>\'' }));
    return;
  }

  if (command === 'auth') {
    const result = await runAuthFlow();
    console.log(JSON.stringify(result));
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.log(JSON.stringify({ error: `Unknown command: ${command}`, available: Object.keys(COMMANDS).filter(k => k.includes('.')) }));
    process.exit(1);
  }

  let params = {};
  if (argsJson) {
    try { params = JSON.parse(argsJson); }
    catch (_) { console.log(JSON.stringify({ error: `Invalid JSON: ${argsJson}` })); process.exit(1); }
  }

  const auth = await getAuth();
  const result = await handler(auth, params);
  console.log(JSON.stringify(result));
}

main().catch(err => {
  console.log(JSON.stringify({ error: err.message }));
  process.exit(1);
});
