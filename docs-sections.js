import { getDocsClient } from './google-clients.js';

function detectHeadingFromText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('######')) return { level: 6, name: trimmed.slice(6).trim() };
  if (trimmed.startsWith('#####')) return { level: 5, name: trimmed.slice(5).trim() };
  if (trimmed.startsWith('####')) return { level: 4, name: trimmed.slice(4).trim() };
  if (trimmed.startsWith('###')) return { level: 3, name: trimmed.slice(3).trim() };
  if (trimmed.startsWith('##')) return { level: 2, name: trimmed.slice(2).trim() };
  if (trimmed.startsWith('#')) return { level: 1, name: trimmed.slice(1).trim() };
  return null;
}

function findSectionIdentifier(sections, identifier) {
  if (typeof identifier === 'number') {
    const section = sections[identifier];
    if (!section) throw new Error(`Section index ${identifier} not found. Document has ${sections.length} sections.`);
    return section;
  }
  const section = sections.find(s => s.name.toLowerCase() === identifier.toLowerCase());
  if (!section) throw new Error(`Section "${identifier}" not found. Available sections: ${sections.map(s => s.name).join(', ')}`);
  return section;
}

function buildSectionIndex(content) {
  const sections = [];
  let currentSection = null;
  for (const elem of content) {
    if (!elem.paragraph) continue;
    const style = elem.paragraph.paragraphStyle?.namedStyleType;
    let isHeading = false, headingLevel = 0, headingName = '', headingStyle = style;
    const runs = () => (elem.paragraph.elements || []).filter(r => r.textRun).map(r => r.textRun.content).join('');
    if (style && (style.startsWith('HEADING') || style === 'TITLE')) {
      isHeading = true;
      headingLevel = style === 'TITLE' ? 0 : parseInt(style.replace('HEADING_', '')) || 1;
      headingName = runs().trim();
    } else {
      const mdHeading = detectHeadingFromText(runs());
      if (mdHeading) { isHeading = true; headingLevel = mdHeading.level; headingName = mdHeading.name; headingStyle = `MARKDOWN_H${mdHeading.level}`; }
    }
    if (isHeading) {
      if (currentSection) { currentSection.endIndex = elem.startIndex; sections.push(currentSection); }
      currentSection = { name: headingName, level: headingLevel, startIndex: elem.startIndex, endIndex: null, headingStyle };
    }
  }
  if (currentSection) {
    const lastElem = content[content.length - 1];
    currentSection.endIndex = lastElem?.endIndex || currentSection.startIndex + 1;
    sections.push(currentSection);
  }
  return sections.map((s, i) => ({ ...s, index: i }));
}

async function getDocEnd(docs, docId) {
  const doc = await docs.documents.get({ documentId: docId });
  const content = doc.data.body.content;
  return { doc, content, docEnd: content[content.length - 1]?.endIndex };
}

export async function getSections(auth, docId) {
  const docs = getDocsClient(auth);
  const doc = await docs.documents.get({ documentId: docId });
  return buildSectionIndex(doc.data.body.content || []);
}

export async function deleteSection(auth, docId, sectionIdentifier) {
  const sections = await getSections(auth, docId);
  const section = findSectionIdentifier(sections, sectionIdentifier);
  const docs = getDocsClient(auth);
  const { docEnd } = await getDocEnd(docs, docId);
  const docEndIndex = docEnd || section.endIndex;
  const endIndex = section.endIndex >= docEndIndex ? docEndIndex - 1 : section.endIndex;
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [{ deleteContentRange: { range: { startIndex: section.startIndex, endIndex } } }] }
  });
  return { deleted: section.name, startIndex: section.startIndex, endIndex };
}

export async function moveSection(auth, docId, sectionIdentifier, targetPosition) {
  const docs = getDocsClient(auth);
  const sections = await getSections(auth, docId);
  const section = findSectionIdentifier(sections, sectionIdentifier);

  let targetIndex;
  if (typeof targetPosition === 'number') {
    if (targetPosition < 0 || targetPosition > sections.length) {
      throw new Error(`Target position ${targetPosition} out of range (0-${sections.length}).`);
    }
    if (targetPosition === 0) {
      targetIndex = 1;
    } else if (targetPosition >= sections.length) {
      const { docEnd } = await getDocEnd(docs, docId);
      targetIndex = docEnd - 1;
    } else {
      targetIndex = sections[targetPosition].startIndex;
    }
  } else if (targetPosition === 'start') {
    targetIndex = 1;
  } else if (targetPosition === 'end') {
    const { docEnd } = await getDocEnd(docs, docId);
    targetIndex = docEnd - 1;
  } else {
    const targetSectionIdx = sections.findIndex(s => s.name.toLowerCase() === targetPosition.toLowerCase());
    if (targetSectionIdx === -1) throw new Error(`Target section "${targetPosition}" not found.`);
    targetIndex = sections[targetSectionIdx].startIndex;
  }

  const { content } = await getDocEnd(docs, docId);
  const sectionText = content
    .filter(e => e.startIndex >= section.startIndex && e.startIndex < section.endIndex && e.paragraph)
    .flatMap(e => (e.paragraph.elements || []).filter(r => r.textRun).map(r => r.textRun.content))
    .join('');

  const requests = [];
  if (targetIndex > section.endIndex) {
    requests.push({ insertText: { location: { index: targetIndex }, text: sectionText } });
    requests.push({ deleteContentRange: { range: { startIndex: section.startIndex, endIndex: section.endIndex } } });
  } else if (targetIndex < section.startIndex) {
    requests.push({ deleteContentRange: { range: { startIndex: section.startIndex, endIndex: section.endIndex } } });
    requests.push({ insertText: { location: { index: targetIndex }, text: sectionText } });
  } else {
    return { moved: section.name, message: 'Section already at target position' };
  }

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
  return { moved: section.name, from: section.startIndex, to: targetIndex };
}

export async function replaceSection(auth, docId, sectionIdentifier, newContent, preserveHeading = true) {
  const docs = getDocsClient(auth);
  const sections = await getSections(auth, docId);
  const section = findSectionIdentifier(sections, sectionIdentifier);
  const { content, docEnd } = await getDocEnd(docs, docId);

  const headingElem = content.find(e => e.startIndex === section.startIndex && e.paragraph);
  const deleteStart = preserveHeading ? (headingElem?.endIndex ?? section.startIndex) : section.startIndex;
  const docEndIndex = docEnd || section.endIndex;
  const deleteEnd = section.endIndex >= docEndIndex ? docEndIndex - 1 : section.endIndex;

  const requests = deleteStart >= deleteEnd
    ? [{ insertText: { location: { index: deleteStart }, text: newContent } }]
    : [
        { deleteContentRange: { range: { startIndex: deleteStart, endIndex: deleteEnd } } },
        { insertText: { location: { index: deleteStart }, text: newContent } }
      ];

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
  return { replaced: section.name, preservedHeading: preserveHeading };
}

export async function handleSection(auth, docId, opts) {
  if (opts.action === 'delete') return deleteSection(auth, docId, opts.section);
  if (opts.action === 'move') return moveSection(auth, docId, opts.section, opts.target);
  if (opts.action === 'replace') return replaceSection(auth, docId, opts.section, opts.content);
  throw new Error('Unknown section action: ' + opts.action + '. Use: delete, move, replace');
}
