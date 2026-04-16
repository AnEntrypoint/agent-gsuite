import { google } from 'googleapis';

export async function searchCustom(auth, opts) {
  const { query, search_engine_id, num = 10, start, site_search, date_restrict, file_type, language } = opts;
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cx = search_engine_id || process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey) throw new Error('GOOGLE_API_KEY or GOOGLE_CUSTOM_SEARCH_API_KEY env var required for custom search');
  if (!cx) throw new Error('search_engine_id param or GOOGLE_SEARCH_ENGINE_ID env var required');

  const svc = google.customsearch({ version: 'v1', auth: apiKey });
  const params = { cx, q: query, num };
  if (start) params.start = start;
  if (site_search) params.siteSearch = site_search;
  if (date_restrict) params.dateRestrict = date_restrict;
  if (file_type) params.fileType = file_type;
  if (language) params.lr = language;

  const res = await svc.cse.list(params);
  return {
    totalResults: res.data.searchInformation?.totalResults || '0',
    items: (res.data.items || []).map(i => ({
      title: i.title, link: i.link, snippet: i.snippet,
      displayLink: i.displayLink, fileFormat: i.fileFormat || null
    }))
  };
}

export async function getSearchEngineInfo(auth, opts) {
  const { search_engine_id } = opts;
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cx = search_engine_id || process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey) throw new Error('GOOGLE_API_KEY or GOOGLE_CUSTOM_SEARCH_API_KEY env var required');
  if (!cx) throw new Error('search_engine_id param or GOOGLE_SEARCH_ENGINE_ID env var required');

  const svc = google.customsearch({ version: 'v1', auth: apiKey });
  const res = await svc.cse.list({ cx, q: 'test', num: 1 });
  const ctx = res.data.context || {};
  return { title: ctx.title || cx, totalResults: res.data.searchInformation?.totalResults || '0' };
}
