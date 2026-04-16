import { getSlidesClient } from './google-clients.js';

export async function createPresentation(auth, title) {
  const svc = getSlidesClient(auth);
  const res = await svc.presentations.create({ requestBody: { title } });
  return { id: res.data.presentationId, title: res.data.title, slides: (res.data.slides || []).length };
}

export async function getPresentation(auth, presentationId) {
  const svc = getSlidesClient(auth);
  const res = await svc.presentations.get({ presentationId });
  const d = res.data;
  return {
    id: d.presentationId, title: d.title,
    slides: (d.slides || []).map((s, i) => ({
      index: i, objectId: s.objectId,
      layout: s.slideProperties?.layoutObjectId || null
    })),
    pageSize: d.pageSize
  };
}

export async function batchUpdatePresentation(auth, presentationId, requests) {
  const svc = getSlidesClient(auth);
  const res = await svc.presentations.batchUpdate({
    presentationId, requestBody: { requests }
  });
  return { replies: res.data.replies || [] };
}

export async function getPage(auth, presentationId, pageObjectId) {
  const svc = getSlidesClient(auth);
  const res = await svc.presentations.pages.get({ presentationId, pageObjectId });
  const p = res.data;
  return {
    objectId: p.objectId,
    elements: (p.pageElements || []).map(e => ({
      objectId: e.objectId, size: e.size, transform: e.transform,
      type: e.shape ? 'shape' : e.table ? 'table' : e.image ? 'image' : 'other'
    }))
  };
}

export async function getPageThumbnail(auth, presentationId, pageObjectId, mimeType = 'PNG') {
  const svc = getSlidesClient(auth);
  const res = await svc.presentations.pages.getThumbnail({
    presentationId, pageObjectId,
    'thumbnailProperties.mimeType': mimeType,
    'thumbnailProperties.thumbnailSize': 'LARGE'
  });
  return { contentUrl: res.data.contentUrl, width: res.data.width, height: res.data.height };
}
