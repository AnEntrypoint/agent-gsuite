import { getDocsClient, getDriveClient } from './google-clients.js';
import { countOccurrences, getAllIndices } from './text-utils.js';
import fs from 'fs';
import path from 'path';

export function extractText(content) {
  let text = '';
  for (const elem of content || []) {
    if (elem.paragraph) {
      for (const run of elem.paragraph.elements || []) {
        if (run.textRun) {
          text += run.textRun.content;
        }
      }
    } else if (elem.table) {
      for (const row of elem.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          text += extractText(cell.content) + '\t';
        }
        text += '\n';
      }
    }
  }
  return text;
}

export { countOccurrences, getAllIndices, parseColor } from './text-utils.js';

export async function readDocument(auth, docId) {
  const docs = getDocsClient(auth);
  const result = await docs.documents.get({ documentId: docId });
  return extractText(result.data.body.content);
}

export async function createDocument(auth, title) {
  const docs = getDocsClient(auth);
  const result = await docs.documents.create({
    requestBody: { title }
  });
  return { docId: result.data.documentId, title: result.data.title };
}

export async function getDocumentInfo(auth, docId) {
  const docs = getDocsClient(auth);
  const drive = getDriveClient(auth);

  const doc = await docs.documents.get({ documentId: docId });
  
  const info = {
    id: doc.data.documentId,
    title: doc.data.title
  };

  try {
    const file = await drive.files.get({
      fileId: docId,
      fields: 'id,name,mimeType,createdTime,modifiedTime,owners,size'
    });
    info.createdTime = file.data.createdTime;
    info.modifiedTime = file.data.modifiedTime;
    info.owners = file.data.owners?.map(o => ({ name: o.displayName, email: o.emailAddress })) || [];
  } catch (e) {
    info.note = 'Drive metadata unavailable (requires drive scope)';
  }

  return info;
}

export async function listDocuments(auth, maxResults = 20, query = null) {
  const drive = getDriveClient(auth);

  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";
  if (query) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  const result = await drive.files.list({
    q,
    pageSize: maxResults,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,createdTime,modifiedTime)'
  });

  return result.data.files || [];
}

export async function getDocumentStructure(auth, docId) {
  const docs = getDocsClient(auth);
  const doc = await docs.documents.get({ documentId: docId });

  const structure = [];

  for (const elem of doc.data.body.content || []) {
    if (elem.paragraph) {
      const style = elem.paragraph.paragraphStyle?.namedStyleType;
      if (style && style.startsWith('HEADING')) {
        let text = '';
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) text += run.textRun.content;
        }
        structure.push({
          level: parseInt(style.replace('HEADING_', '')) || 0,
          text: text.trim(),
          index: elem.startIndex
        });
      } else if (style === 'TITLE') {
        let text = '';
        for (const run of elem.paragraph.elements || []) {
          if (run.textRun) text += run.textRun.content;
        }
        structure.push({
          level: 0,
          text: text.trim(),
          index: elem.startIndex,
          isTitle: true
        });
      }
    }
  }

  return structure;
}

export async function searchDrive(auth, query, type = 'all', maxResults = 20) {
  const drive = getDriveClient(auth);

  const mimeTypes = {
    docs: "mimeType='application/vnd.google-apps.document'",
    sheets: "mimeType='application/vnd.google-apps.spreadsheet'",
    all: "(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet')"
  };

  const mimeFilter = mimeTypes[type] || mimeTypes.all;
  const escapedQuery = query.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `${mimeFilter} and trashed=false and name contains '${escapedQuery}'`;

  const result = await drive.files.list({
    q,
    pageSize: maxResults,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,createdTime,modifiedTime,owners)'
  });

  return (result.data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    type: f.mimeType === 'application/vnd.google-apps.document' ? 'doc' : 'sheet',
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    owners: f.owners?.map(o => ({ name: o.displayName, email: o.emailAddress })) || []
  }));
}

const MIME_MAP = {
  '.pdf': 'application/pdf',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};
export async function uploadFile(auth, filePath, mimeType = null, parentFolderId = null, fileName = null) {
  const drive = getDriveClient(auth);
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const detectedMime = mimeType || MIME_MAP[ext] || 'application/octet-stream';
  const name = fileName || path.basename(resolvedPath);

  const requestBody = { name };
  if (parentFolderId) requestBody.parents = [parentFolderId];

  const media = { mimeType: detectedMime, body: fs.createReadStream(resolvedPath) };

  const result = await drive.files.create({
    requestBody,
    media,
    fields: 'id,name,mimeType,webViewLink,size'
  });

  return {
    id: result.data.id,
    name: result.data.name,
    mimeType: result.data.mimeType,
    webViewLink: result.data.webViewLink,
    size: result.data.size
  };
}
