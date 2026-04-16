import * as chat from './chat.js';
import { formatJsonResponse } from './handlers-utils.js';

export async function handleChatToolCall(name, args, auth) {
  switch (name) {
    case 'chat_list_spaces': return formatJsonResponse(await chat.listSpaces(auth, args));
    case 'chat_get_messages': return formatJsonResponse(await chat.getMessages(auth, args));
    case 'chat_send_message': return formatJsonResponse(await chat.sendMessage(auth, args));
    case 'chat_search_messages': return formatJsonResponse(await chat.searchMessages(auth, args));
    case 'chat_create_reaction': return formatJsonResponse(await chat.createReaction(auth, args));
    case 'chat_download_attachment': return formatJsonResponse(await chat.downloadAttachment(auth, args));
    default: return null;
  }
}
