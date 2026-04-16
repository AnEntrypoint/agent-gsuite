import * as contacts from './contacts.js';
import { formatJsonResponse } from './handlers-utils.js';

export async function handleContactsToolCall(name, args, auth) {
  switch (name) {
    case 'contacts_list': return formatJsonResponse(await contacts.listContacts(auth, args));
    case 'contacts_get': return formatJsonResponse(await contacts.getContact(auth, args.resource_name));
    case 'contacts_search': return formatJsonResponse(await contacts.searchContacts(auth, args.query, args));
    case 'contacts_manage': return formatJsonResponse(await contacts.manageContact(auth, args));
    case 'contacts_list_groups': return formatJsonResponse(await contacts.listContactGroups(auth, args));
    case 'contacts_get_group': return formatJsonResponse(await contacts.getContactGroup(auth, args.resource_name));
    case 'contacts_batch': return formatJsonResponse(await contacts.manageContactsBatch(auth, args));
    case 'contacts_manage_group': return formatJsonResponse(await contacts.manageContactGroup(auth, args));
    default: return null;
  }
}
