import { google } from 'googleapis';

export function detectHeadingFromText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('######')) return { level: 6, name: trimmed.slice(6).trim() };
  if (trimmed.startsWith('#####')) return { level: 5, name: trimmed.slice(5).trim() };
  if (trimmed.startsWith('####')) return { level: 4, name: trimmed.slice(4).trim() };
  if (trimmed.startsWith('###')) return { level: 3, name: trimmed.slice(3).trim() };
  if (trimmed.startsWith('##')) return { level: 2, name: trimmed.slice(2).trim() };
  if (trimmed.startsWith('#')) return { level: 1, name: trimmed.slice(1).trim() };
  return null;
}

export async function findSectionIdentifier(sections, identifier) {
  if (typeof identifier === 'number') {
    const section = sections[identifier];
    if (!section) throw new Error(`Section index ${identifier} not found. Document has ${sections.length} sections.`);
    return section;
  }
  const section = sections.find(s => s.name.toLowerCase() === identifier.toLowerCase());
  if (!section) {
    const available = sections.map(s => s.name).join(', ');
    throw new Error(`Section "${identifier}" not found. Available sections: ${available}`);
  }
  return section;
}

export async function buildSectionIndex(auth, docId, content) {
  const sections = [];
  let currentSection = null;
  for (const elem of content) {
    if (elem.paragraph) {
      const style = elem.paragraph.paragraphStyle?.namedStyleType;
      let isHeading = false, headingLevel = 0, headingName = '', headingStyle = style;
      if (style && (style.startsWith('HEADING') || style === 'TITLE')) {
        isHeading = true;
        headingLevel = style === 'TITLE' ? 0 : parseInt(style.replace('HEADING_', '')) || 1;
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) headingName += run.textRun.content;
        }
        headingName = headingName.trim();
      } else {
        let text = '';
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) text += run.textRun.content;
        }
        const mdHeading = detectHeadingFromText(text);
        if (mdHeading) {
          isHeading = true;
          headingLevel = mdHeading.level;
          headingName = mdHeading.name;
          headingStyle = `MARKDOWN_H${mdHeading.level}`;
        }
      }
      if (isHeading) {
        if (currentSection) {
          currentSection.endIndex = elem.startIndex;
          sections.push(currentSection);
        }
        currentSection = { name: headingName, level: headingLevel, startIndex: elem.startIndex, endIndex: null, headingStyle };
      }
    }
  }
  if (currentSection) {
    const lastElem = content[content.length - 1];
    currentSection.endIndex = lastElem?.endIndex || currentSection.startIndex + 1;
    sections.push(currentSection);
  }
  return sections.map((s, i) => ({ ...s, index: i }));
}
