export function looksLikeHtml(s) {
  if (!s || typeof s !== 'string') return false;
  return /<\/?(?:h[1-6]|p|br|hr|ul|ol|li|strong|em|b|i|u|table|tr|td|th|div|span|a|blockquote|pre|code)\b/i.test(s) || /<!DOCTYPE/i.test(s);
}

export function looksLikeMarkdown(s) {
  if (!s || typeof s !== 'string') return false;
  return /^#{1,6}\s+\S/m.test(s) || /^\s*[-*+]\s+\S/m.test(s) || /\*\*[^*\n]+\*\*/.test(s) || /^>\s+/m.test(s);
}

export function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = null;
  const inline = s => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  const closeList = () => { if (inList) { out.push(`</${inList}>`); inList = null; } };
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    const bq = line.match(/^>\s+(.+)$/);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); }
    else if (ul) { if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); }
    else if (ol) { if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); }
    else if (bq) { closeList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); }
    else if (line.trim() === '') { closeList(); }
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return out.join('\n');
}

export function wrapHtmlDocument(html) {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
}

export function plainTextToHtml(text) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
}

export function contentToHtml(content) {
  if (looksLikeHtml(content)) return content;
  if (looksLikeMarkdown(content)) return markdownToHtml(content);
  return plainTextToHtml(content);
}
