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
  return { text: extractText(result.data.body.content), title: result.data.title, docId: result.data.documentId };
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

export async function findAndReplace(auth, docId, findText, replaceText, matchCase = false) {
  const docs = getDocsClient(auth);
  const res = await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{ replaceAllText: { containsText: { text: findText, matchCase }, replaceText } }]
    }
  });
  const count = res.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
  return { docId, findText, replaceText, occurrencesChanged: count };
}

export async function exportDocToPdf(auth, docId) {
  const drive = getDriveClient(auth);
  const res = await drive.files.export({ fileId: docId, mimeType: 'application/pdf' }, { responseType: 'arraybuffer' });
  return { docId, pdfBase64: Buffer.from(res.data).toString('base64'), mimeType: 'application/pdf' };
}

export async function getDocAsMarkdown(auth, docId) {
  const docs = getDocsClient(auth);
  const result = await docs.documents.get({ documentId: docId });
  const content = result.data.body.content || [];
  let md = '';
  for (const elem of content) {
    if (elem.paragraph) {
      const style = elem.paragraph.paragraphStyle?.namedStyleType || '';
      const level = style.startsWith('HEADING_') ? parseInt(style.replace('HEADING_', '')) : 0;
      let line = '';
      for (const run of elem.paragraph.elements || []) {
        if (run.textRun) {
          let text = run.textRun.content;
          const ts = run.textRun.textStyle || {};
          if (ts.bold) text = `**${text.trim()}** `;
          if (ts.italic) text = `*${text.trim()}* `;
          if (ts.link?.url) text = `[${text.trim()}](${ts.link.url}) `;
          line += text;
        }
      }
      if (level > 0) line = '#'.repeat(level) + ' ' + line.trim();
      md += line;
    } else if (elem.table) {
      for (const row of elem.table.tableRows || []) {
        const cells = row.tableCells.map(c => extractText(c.content).trim());
        md += '| ' + cells.join(' | ') + ' |\n';
      }
      md += '\n';
    }
  }
  return { docId, title: result.data.title, markdown: md };
}

export async function getDownloadUrl(auth, fileId) {
  const drive = getDriveClient(auth);
  const res = await drive.files.get({ fileId, fields: 'id,name,webContentLink,mimeType' });
  return { id: res.data.id, name: res.data.name, downloadUrl: res.data.webContentLink, mimeType: res.data.mimeType };
}

export async function copyFile(auth, fileId, name, parentFolderId) {
  const drive = getDriveClient(auth);
  const body = {};
  if (name) body.name = name;
  if (parentFolderId) body.parents = [parentFolderId];
  const res = await drive.files.copy({ fileId, requestBody: body, fields: 'id,name,mimeType,webViewLink' });
  return { id: res.data.id, name: res.data.name, mimeType: res.data.mimeType, webViewLink: res.data.webViewLink };
}

export async function manageAccess(auth, fileId, opts) {
  const drive = getDriveClient(auth);
  const { action, email, role = 'reader', permission_id } = opts;

  if (action === 'list') {
    const res = await drive.permissions.list({ fileId, fields: 'permissions(id,role,type,emailAddress,displayName)' });
    return { permissions: res.data.permissions || [] };
  }
  if (action === 'share') {
    const res = await drive.permissions.create({
      fileId, requestBody: { type: 'user', role, emailAddress: email },
      fields: 'id,role,type,emailAddress'
    });
    return { shared: true, permission: res.data };
  }
  if (action === 'unshare') {
    await drive.permissions.delete({ fileId, permissionId: permission_id });
    return { unshared: true, permissionId: permission_id };
  }
  throw new Error(`Unknown drive access action: ${action}`);
}
