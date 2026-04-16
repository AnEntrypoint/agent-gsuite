import * as slides from './slides.js';
import { formatJsonResponse } from './handlers-utils.js';

export async function handleSlidesToolCall(name, args, auth) {
  switch (name) {
    case 'slides_create': return formatJsonResponse(await slides.createPresentation(auth, args.title));
    case 'slides_get': return formatJsonResponse(await slides.getPresentation(auth, args.presentation_id));
    case 'slides_batch_update': return formatJsonResponse(await slides.batchUpdatePresentation(auth, args.presentation_id, args.requests));
    case 'slides_get_page': return formatJsonResponse(await slides.getPage(auth, args.presentation_id, args.page_id));
    case 'slides_get_thumbnail': return formatJsonResponse(await slides.getPageThumbnail(auth, args.presentation_id, args.page_id, args.mime_type || 'PNG'));
    default: return null;
  }
}
