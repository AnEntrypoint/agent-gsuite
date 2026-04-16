import * as gmail from './gmail.js';
import { formatJsonResponse, formatDocsResponse, buildLabelConfig } from './handlers-utils.js';

export async function handleGmailToolCall(name, args, auth) {
  switch (name) {
    case 'gmail_list': return formatJsonResponse(await gmail.listEmails(auth, args.max_results || 20, args.query || null, args.label_ids || null));
    case 'gmail_search': return formatJsonResponse(await gmail.searchEmails(auth, args.query, args.max_results || 20));
    case 'gmail_read': return formatJsonResponse(await gmail.readEmail(auth, args.message_id, args.format || 'full'));
    case 'gmail_get_attachments': return formatJsonResponse(await gmail.getEmailAttachments(auth, args.message_id));
    case 'gmail_download_attachment': return formatJsonResponse(await gmail.downloadAttachment(auth, args.message_id, args.attachment_id));
    case 'gmail_get_labels': return formatJsonResponse(await gmail.getLabels(auth));
    case 'gmail_create_label': return formatJsonResponse(await gmail.createLabel(auth, buildLabelConfig(args)));
    case 'gmail_update_label': {
      const config = buildLabelConfig(args);
      delete config.name; if (args.name) config.name = args.name;
      return formatJsonResponse(await gmail.updateLabel(auth, args.label_id, config));
    }
    case 'gmail_delete_label': return formatDocsResponse(`Deleted label ${(await gmail.deleteLabel(auth, args.label_id)).deleted}`);
    case 'gmail_list_filters': return formatJsonResponse(await gmail.listFilters(auth));
    case 'gmail_get_filter': return formatJsonResponse(await gmail.getFilter(auth, args.filter_id));
    case 'gmail_create_filter':
      return formatJsonResponse(await gmail.createFilter(auth, args.criteria || {}, args.action || {}));
    case 'gmail_delete_filter': return formatDocsResponse(`Deleted filter ${(await gmail.deleteFilter(auth, args.filter_id)).deleted}`);
    case 'gmail_replace_filter':
      return formatJsonResponse(await gmail.replaceFilter(auth, args.filter_id, args.criteria || {}, args.action || {}));
    case 'gmail_send': {
      const result = await gmail.sendEmail(auth, args.to, args.subject, args.body, args.cc || null, args.bcc || null);
      return formatDocsResponse(`Sent email to ${args.to}\nMessage ID: ${result.id}`);
    }
    case 'gmail_delete': return formatDocsResponse(`Permanently deleted email ${(await gmail.deleteEmail(auth, args.message_id)).deleted}`);
    case 'gmail_trash': return formatDocsResponse(`Moved email ${(await gmail.trashEmail(auth, args.message_id)).id} to trash`);
    case 'gmail_modify_labels': return formatDocsResponse(`Modified labels for email ${(await gmail.modifyLabels(auth, args.message_id, args.add_labels || [], args.remove_labels || [])).id}`);
    case 'gmail_bulk_modify_labels': return formatJsonResponse(await gmail.bulkModifyLabelsByQuery(auth, args.query, args.add_labels || [], args.remove_labels || [], args.max_results || 2000));
    case 'gmail_draft': return formatJsonResponse(await gmail.draftEmail(auth, args.to, args.subject, args.body, args.cc || null, args.bcc || null));
    case 'gmail_get_thread': return formatJsonResponse(await gmail.getThreadContent(auth, args.thread_id, args.format || 'full'));
    case 'gmail_batch_get': return formatJsonResponse(await gmail.getMessagesBatch(auth, args.message_ids, args.format || 'full'));
    default: return null;
  }
}
