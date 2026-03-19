import * as sheets from './sheets.js';
import { formatJsonResponse, formatDocsResponse } from './handlers-utils.js';
import * as scripts from './scripts.js';

export async function handleSheetsToolCall(name, args, auth) {
  switch (name) {
    case 'scripts_search': {
      const result = await scripts.searchScripts(auth, args.query, args.max_results || 20);
      return formatJsonResponse(result);
    }
    case 'scripts_create': {
      const result = await scripts.createScript(auth, args.sheet_id, args.script_name);
      return formatDocsResponse(`Created script "${result.name}" with ID: ${result.scriptId}\nURL: ${result.url}`);
    }
    case 'scripts_list': {
      const result = await scripts.listScripts(auth, args.sheet_id);
      let text = JSON.stringify(result.scripts, null, 2);
      if (result.healed) text += `\n\n(Auto-healed: removed ${result.removedCount} stale script entries)`;
      return formatDocsResponse(text);
    }
    case 'scripts_sync': {
      const result = await scripts.syncScripts(auth, args.sheet_id);
      return formatDocsResponse(`Synced scripts: ${result.valid}/${result.total} valid, ${result.removed} removed`);
    }
    case 'scripts_read': {
      const result = await scripts.readScript(auth, args.sheet_id, args.script);
      return formatJsonResponse(result);
    }
    case 'scripts_write': {
      if (args.mode === 'edit') {
        const result = await scripts.editScript(auth, args.sheet_id, args.script, args.file_name, args.old_text, args.new_text, args.replace_all || false);
        return formatDocsResponse(`Replaced ${result.replacements} occurrence(s) in ${result.file}`);
      }
      const result = await scripts.writeScript(auth, args.sheet_id, args.script, args.file_name, args.content, args.file_type || 'SERVER_JS');
      return formatDocsResponse(`Wrote file "${result.file}" (${result.isNew ? 'created' : 'updated'})`);
    }
    case 'scripts_edit': {
      const result = await scripts.editScript(auth, args.sheet_id, args.script, args.file_name, args.old_text, args.new_text, args.replace_all || false);
      return formatDocsResponse(`Replaced ${result.replacements} occurrence(s) in ${result.file}`);
    }
    case 'scripts_delete': {
      const result = await scripts.deleteScript(auth, args.sheet_id, args.script);
      return formatDocsResponse(`Removed script "${result.name}" from tracking (${result.scriptId})\nNote: ${result.note}`);
    }
    case 'scripts_run': {
      const result = await scripts.runScript(auth, args.sheet_id, args.script, args.function_name, args.parameters || []);
      return formatDocsResponse(`Executed function "${result.function}"\nResult: ${JSON.stringify(result.result)}`);
    }
    case 'sheets_create': {
      const result = await sheets.createSheet(auth, args.title);
      return formatDocsResponse(`Created spreadsheet "${result.title}" with ID: ${result.sheetId}`);
    }
    case 'sheets_read': {
      const values = await sheets.readSheet(auth, args.sheet_id, args.range || 'Sheet1');
      return formatJsonResponse(values);
    }
    case 'sheets_edit': {
      await sheets.editSheet(auth, args.sheet_id, args.range, args.values);
      return formatDocsResponse(`Updated range ${args.range}`);
    }
    case 'sheets_insert': {
      await sheets.insertSheet(auth, args.sheet_id, args.range || 'Sheet1', args.values);
      return formatDocsResponse(`Appended rows`);
    }
    case 'sheets_get_cell': {
      const value = await sheets.getCell(auth, args.sheet_id, args.cell);
      return formatDocsResponse(value !== null ? String(value) : '(empty)');
    }
    case 'sheets_set_cell': {
      await sheets.setCell(auth, args.sheet_id, args.cell, args.value);
      return formatDocsResponse(`Set cell ${args.cell}`);
    }
    case 'sheets_edit_cell': {
      const result = await sheets.editCell(auth, args.sheet_id, args.cell, args.old_text, args.new_text, args.replace_all || false);
      return formatDocsResponse(`Replaced ${result.replacements} occurrence(s) in cell ${args.cell}`);
    }
    case 'sheets_find_replace': {
      const result = await sheets.findReplace(auth, args.sheet_id, args.find, args.replace, args.sheet_name || null);
      return formatDocsResponse(`Replaced ${result.replacements} occurrences`);
    }
    case 'sheets_get_info': {
      const info = await sheets.getSpreadsheetInfo(auth, args.sheet_id);
      return formatJsonResponse(info);
    }
    case 'sheets_list': {
      const sheetsList = await sheets.listSpreadsheets(auth, args.max_results || 20, args.query || null);
      return formatJsonResponse(sheetsList);
    }
    case 'sheets_tab': {
      if (args.action === 'add') {
        const result = await sheets.addSheetTab(auth, args.sheet_id, args.title);
        return formatDocsResponse(`Added sheet tab "${result.title}" with ID: ${result.sheetId}`);
      } else if (args.action === 'delete') {
        const result = await sheets.deleteSheetTab(auth, args.sheet_id, args.sheet_name);
        return formatDocsResponse(`Deleted sheet tab "${result.deleted}"`);
      } else if (args.action === 'rename') {
        const result = await sheets.renameSheetTab(auth, args.sheet_id, args.sheet_name, args.title);
        return formatDocsResponse(`Renamed sheet tab "${result.oldName}" to "${result.newName}"`);
      }
      throw new Error(`Unknown tab action: ${args.action}`);
    }
    case 'sheets_add_sheet': {
      const result = await sheets.addSheetTab(auth, args.sheet_id, args.title);
      return formatDocsResponse(`Added sheet tab "${result.title}" with ID: ${result.sheetId}`);
    }
    case 'sheets_delete_sheet': {
      const result = await sheets.deleteSheetTab(auth, args.sheet_id, args.sheet_name);
      return formatDocsResponse(`Deleted sheet tab "${result.deleted}"`);
    }
    case 'sheets_rename_sheet': {
      const result = await sheets.renameSheetTab(auth, args.sheet_id, args.old_name, args.new_name);
      return formatDocsResponse(`Renamed sheet tab "${result.oldName}" to "${result.newName}"`);
    }
    case 'sheets_clear': {
      const result = await sheets.clearRange(auth, args.sheet_id, args.range, args.clear_formats || false);
      return formatDocsResponse(`Cleared range ${result.cleared}`);
    }
    case 'sheets_format': {
      const formatting = {};
      const mapConfig = { background_color: 'backgroundColor', text_color: 'textColor', bold: 'bold', italic: 'italic', font_size: 'fontSize', font_family: 'fontFamily', horizontal_alignment: 'horizontalAlignment', vertical_alignment: 'verticalAlignment', wrap_strategy: 'wrapStrategy', number_format: 'numberFormat', borders: 'borders' };
      Object.entries(mapConfig).forEach(([k, v]) => { if (k in args && args[k] !== undefined) formatting[v] = args[k]; });
      const result = await sheets.formatRange(auth, args.sheet_id, args.range, formatting);
      return formatDocsResponse(`Formatted range ${result.formatted}`);
    }
    case 'sheets_merge': {
      const action = args.action || 'merge';
      const result = await sheets.mergeCells(auth, args.sheet_id, args.range, action);
      if (action === 'unmerge') return formatDocsResponse(`Unmerged cells in range ${result.unmerged}`);
      return formatDocsResponse(`Merged cells in range ${result.merged}`);
    }
    case 'sheets_unmerge': {
      const result = await sheets.unmergeCells(auth, args.sheet_id, args.range);
      return formatDocsResponse(`Unmerged cells in range ${result.unmerged}`);
    }
    case 'sheets_freeze': {
      const result = await sheets.setFrozen(auth, args.sheet_id, args.sheet_name, args.rows || 0, args.columns || 0);
      return formatDocsResponse(`Froze ${result.frozenRows} rows and ${result.frozenColumns} columns`);
    }
    case 'sheets_sort': {
      const result = await sheets.sortRange(auth, args.sheet_id, args.range, args.sort_column, args.ascending !== false);
      return formatDocsResponse(`Sorted range ${result.sorted} by column ${result.column} (${result.ascending ? 'ascending' : 'descending'})`);
    }
    case 'sheets_rows_cols': {
      const result = await sheets.modifyRowsColumns(auth, args.sheet_id, args.sheet_name, args.action, args.dimension, args.start_index, args.count);
      const actionPast = args.action === 'delete' ? 'Deleted' : 'Inserted';
      return formatDocsResponse(`${actionPast} ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}`);
    }
    case 'sheets_insert_rows_cols': {
      const result = await sheets.insertRowsColumns(auth, args.sheet_id, args.sheet_name, args.dimension, args.start_index, args.count);
      return formatDocsResponse(`Inserted ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}`);
    }
    case 'sheets_delete_rows_cols': {
      const result = await sheets.deleteRowsColumns(auth, args.sheet_id, args.sheet_name, args.dimension, args.start_index, args.count);
      return formatDocsResponse(`Deleted ${result.count} ${result.dimension.toLowerCase()}(s) at index ${result.startIndex}`);
    }
    case 'sheets_dimension_size': {
      const result = await sheets.setDimensionSize(auth, args.sheet_id, args.sheet_name, args.dimension, args.start, args.end, args.size);
      return formatDocsResponse(`Set ${result.dimension.toLowerCase()} size to ${result.size}px for ${result.start} to ${result.end}`);
    }
    case 'sheets_set_column_width': {
      const result = await sheets.setColumnWidth(auth, args.sheet_id, args.sheet_name, args.start_column, args.end_column, args.width);
      return formatDocsResponse(`Set column width to ${result.width}px for columns ${result.startColumn} to ${result.endColumn}`);
    }
    case 'sheets_set_row_height': {
      const result = await sheets.setRowHeight(auth, args.sheet_id, args.sheet_name, args.start_row, args.end_row, args.height);
      return formatDocsResponse(`Set row height to ${result.height}px for rows ${result.startRow} to ${result.endRow}`);
    }
    case 'sheets_get_formula': {
      const result = await sheets.getCellFormula(auth, args.sheet_id, args.cell);
      return formatJsonResponse(result);
    }
    case 'sheets_batch': {
      const result = await sheets.batchUpdate(auth, args.sheet_id, args.operations);
      return formatDocsResponse(`Updated ${result.valuesUpdated} values, applied ${result.formatsApplied} formats`);
    }
    default:
      return null;
  }
}
