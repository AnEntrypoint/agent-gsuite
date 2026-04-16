import * as search from './search.js';
import { formatJsonResponse } from './handlers-utils.js';

export async function handleSearchToolCall(name, args, auth) {
  switch (name) {
    case 'search_custom': return formatJsonResponse(await search.searchCustom(auth, args));
    case 'search_engine_info': return formatJsonResponse(await search.getSearchEngineInfo(auth, args));
    default: return null;
  }
}
