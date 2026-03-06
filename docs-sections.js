import { google } from 'googleapis';
import { detectHeadingFromText, findSectionIdentifier, buildSectionIndex } from './docs-sections-helpers.js';

export async function getSections(auth, docId) {
  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });
  return buildSectionIndex(auth, docId, doc.data.body.content || []);
}

export async function deleteSection(auth, docId, sectionIdentifier) {
  const sections = await getSections(auth, docId);
  const section = await findSectionIdentifier(sections, sectionIdentifier);

  const docs = google.docs({ version: 'v1', auth });
  const doc = await docs.documents.get({ documentId: docId });
  const lastElem = doc.data.body.content[doc.data.body.content.length - 1];
  const docEndIndex = lastElem?.endIndex || section.endIndex;
  let endIndex = section.endIndex;
  if (endIndex >= docEndIndex) {
    endIndex = docEndIndex - 1;
  }

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{
        deleteContentRange: {
          range: { startIndex: section.startIndex, endIndex }
        }
      }]
    }
  });

  return { deleted: section.name, startIndex: section.startIndex, endIndex };
}

export async function moveSection(auth, docId, sectionIdentifier, targetPosition) {
  const docs = google.docs({ version: 'v1', auth });
  const sections = await getSections(auth, docId);
  const section = await findSectionIdentifier(sections, sectionIdentifier);
  const sectionIndex = sections.indexOf(section);

  let targetIndex;
  if (typeof targetPosition === 'number') {
    if (targetPosition < 0 || targetPosition > sections.length) {
      throw new Error(`Target position ${targetPosition} out of range (0-${sections.length}).`);
    }
    if (targetPosition === 0) {
      targetIndex = 1;
    } else if (targetPosition >= sections.length) {
      const doc = await docs.documents.get({ documentId: docId });
      const lastElem = doc.data.body.content[doc.data.body.content.length - 1];
      targetIndex = lastElem.endIndex - 1;
    } else {
      targetIndex = sections[targetPosition].startIndex;
    }
  } else if (targetPosition === 'start') {
    targetIndex = 1;
  } else if (targetPosition === 'end') {
    const doc = await docs.documents.get({ documentId: docId });
    const lastElem = doc.data.body.content[doc.data.body.content.length - 1];
    targetIndex = lastElem.endIndex - 1;
  } else {
    const targetSectionIdx = sections.findIndex(s => s.name.toLowerCase() === targetPosition.toLowerCase());
    if (targetSectionIdx === -1) throw new Error(`Target section "${targetPosition}" not found.`);
    targetIndex = sections[targetSectionIdx].startIndex;
  }

  const doc = await docs.documents.get({ documentId: docId });
  let sectionText = '';
  for (const elem of doc.data.body.content) {
    if (elem.startIndex >= section.startIndex && elem.startIndex < section.endIndex) {
      if (elem.paragraph) {
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) sectionText += run.textRun.content;
        }
      }
    }
  }

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
  const docs = google.docs({ version: 'v1', auth });
  const sections = await getSections(auth, docId);
  const section = await findSectionIdentifier(sections, sectionIdentifier);

  const doc = await docs.documents.get({ documentId: docId });
  let headingEndIndex = section.startIndex;
  for (const elem of doc.data.body.content) {
    if (elem.startIndex === section.startIndex && elem.paragraph) {
      headingEndIndex = elem.endIndex;
      break;
    }
  }

  const deleteStart = preserveHeading ? headingEndIndex : section.startIndex;
  let deleteEnd = section.endIndex;

  const docContent = doc.data.body.content;
  const lastElem = docContent[docContent.length - 1];
  const docEndIndex = lastElem?.endIndex || deleteEnd;
  if (deleteEnd >= docEndIndex) {
    deleteEnd = docEndIndex - 1;
  }

  if (deleteStart >= deleteEnd) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{ insertText: { location: { index: deleteStart }, text: newContent } }]
      }
    });
  } else {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          { deleteContentRange: { range: { startIndex: deleteStart, endIndex: deleteEnd } } },
          { insertText: { location: { index: deleteStart }, text: newContent } }
        ]
      }
    });
  }

  return { replaced: section.name, preservedHeading: preserveHeading };
}
