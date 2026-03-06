import { parseArgs, parseJson } from './cli-utils.js';

export async function handleDocsCommand(auth, args, docs, sections, media) {
  const cmd = args[0];
  const opts = parseArgs(args.slice(1));

  if (cmd === 'create') {
    const title = args[1];
    if (!title) {
      console.error('Error: title required');
      process.exit(1);
    }
    const result = await docs.createDoc(auth, title);
    console.log(`Created document "${result.title}" with ID: ${result.documentId}`);
    return;
  }

  const docId = args[1];
  if (!docId && cmd !== 'list') {
    console.error('Error: document_id required');
    process.exit(1);
  }

  if (cmd === 'read') {
    const result = await docs.readDoc(auth, docId);
    console.log(result.body);
    return;
  }

  if (cmd === 'edit') {
    if (!opts.old || !opts.new) {
      console.error('Error: --old and --new required');
      process.exit(1);
    }
    const result = await docs.editDoc(auth, docId, opts.old, opts.new, opts['replace-all']);
    console.log(`Updated ${result.modified} instances`);
    return;
  }

  if (cmd === 'insert') {
    const text = opts.text;
    if (!text) {
      console.error('Error: --text required');
      process.exit(1);
    }
    const result = await docs.insertText(auth, docId, text, opts.position || opts.after, opts.index);
    console.log(`Inserted text at position ${result.insertedIndex}`);
    return;
  }

  if (cmd === 'list') {
    const result = await docs.listDocs(auth, parseInt(opts['max-results'] || '20', 10), opts.query);
    console.log(JSON.stringify(result.documents, null, 2));
    return;
  }

  if (cmd === 'get-info') {
    const result = await docs.getDocInfo(auth, docId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'format') {
    if (!opts.search) {
      console.error('Error: --search required');
      process.exit(1);
    }
    const formatting = {};
    if (opts.bold !== undefined) formatting.bold = opts.bold === 'true';
    if (opts.italic !== undefined) formatting.italic = opts.italic === 'true';
    if (opts.heading) formatting.heading = opts.heading;
    const result = await docs.formatText(auth, docId, opts.search, formatting);
    console.log(`Formatted ${result.formatted} instances`);
    return;
  }

  if (cmd === 'insert-table') {
    if (!opts.rows || !opts.cols) {
      console.error('Error: --rows and --cols required');
      process.exit(1);
    }
    const result = await docs.insertTable(auth, docId, parseInt(opts.rows, 10), parseInt(opts.cols, 10), opts.position);
    console.log(`Inserted table with ${result.rows} rows and ${result.cols} columns`);
    return;
  }

  if (cmd === 'delete') {
    if (!opts.text) {
      console.error('Error: --text required');
      process.exit(1);
    }
    const result = await docs.deleteText(auth, docId, opts.text, opts['delete-all']);
    console.log(`Deleted ${result.deleted} instances`);
    return;
  }

  if (cmd === 'get-structure') {
    const result = await docs.getDocStructure(auth, docId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'get-sections') {
    const result = await sections.getSections(auth, docId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'section') {
    if (!opts.action) {
      console.error('Error: --action required (delete, move, replace)');
      process.exit(1);
    }
    const result = await sections.handleSection(auth, docId, opts);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === 'image') {
    if (!opts.action) {
      console.error('Error: --action required (insert, list, delete, replace)');
      process.exit(1);
    }
    const result = await media.handleImage(auth, docId, opts);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error('Unknown docs command');
  process.exit(1);
}
