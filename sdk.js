import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as gmail from './gmail.js';
import * as scripts from './scripts.js';
import { OAuth2Client, GoogleAuth } from 'google-auth-library';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/script.projects'
];

function createClient(auth, userContext = {}) {
  return {
    auth,
    userContext: userContext || {},
    docs: {
      read: (docId) => docs.readDocument(auth, docId, userContext),
      create: (title) => docs.createDocument(auth, title, userContext),
      info: (docId) => docs.getDocumentInfo(auth, docId, userContext),
      list: () => docs.listDocuments(auth, userContext),
      search: (query) => docs.searchDrive(auth, query, userContext),
      edit: (docId, oldText, newText) => docs.editDocument(auth, docId, oldText, newText, userContext),
      insert: (docId, text, position) => docs.insertDocument(auth, docId, text, position, userContext),
      delete: (docId, text, deleteAll) => docs.deleteText(auth, docId, text, deleteAll, userContext),
      format: (docId, searchText, format) => docs.formatDocument(auth, docId, searchText, format, userContext),
      batch: (docId, operations) => docs.batchUpdate(auth, docId, operations, userContext),
      sections: {
        get: (docId) => docs.getSections(auth, docId, userContext),
        delete: (docId, section) => docs.deleteSection(auth, docId, section, userContext),
        move: (docId, section, target) => docs.moveSection(auth, docId, section, target, userContext),
        replace: (docId, section, content) => docs.replaceSection(auth, docId, section, content, userContext)
      },
      media: {
        insert: (docId, imageUrl, position, width, height) => docs.insertImage(auth, docId, imageUrl, position, width, height, userContext),
        list: (docId) => docs.listImages(auth, docId, userContext),
        delete: (docId, imageIndex) => docs.deleteImage(auth, docId, imageIndex, userContext),
        replace: (docId, imageIndex, imageUrl, width, height) => docs.replaceImage(auth, docId, imageIndex, imageUrl, width, height, userContext)
      }
    },
    sheets: {
      create: (title) => sheets.createSheet(auth, title, userContext),
      read: (sheetId, range) => sheets.readSheet(auth, sheetId, range, userContext),
      info: (sheetId) => sheets.getSpreadsheetInfo(auth, sheetId, userContext),
      list: () => sheets.listSpreadsheets(auth, userContext),
      edit: (sheetId, range, values) => sheets.editSheet(auth, sheetId, range, values, userContext),
      insert: (sheetId, values, range) => sheets.insertSheet(auth, sheetId, values, range, userContext),
      getCell: (sheetId, cell) => sheets.getCell(auth, sheetId, cell, userContext),
      setCell: (sheetId, cell, value) => sheets.setCell(auth, sheetId, cell, value, userContext),
      batch: (sheetId, ops) => sheets.batchUpdate(auth, sheetId, ops, userContext),
      tabs: {
        add: (sheetId, name) => sheets.addSheetTab(auth, sheetId, name, userContext),
        delete: (sheetId, name) => sheets.deleteSheetTab(auth, sheetId, name, userContext),
        rename: (sheetId, oldName, newName) => sheets.renameSheetTab(auth, sheetId, oldName, newName, userContext)
      },
      scripts: {
        create: (sheetId, scriptName) => sheets.createScript(auth, sheetId, scriptName, userContext),
        list: (sheetId) => sheets.listScripts(auth, sheetId, userContext),
        read: (sheetId, script) => sheets.readScript(auth, sheetId, script, userContext),
        write: (sheetId, script, fileName, content) => sheets.writeScript(auth, sheetId, script, fileName, content, userContext),
        delete: (sheetId, script) => sheets.deleteScript(auth, sheetId, script, userContext),
        run: (sheetId, script, functionName, parameters) => sheets.runScript(auth, sheetId, script, functionName, parameters, userContext)
      }
    },
    gmail: {
      list: (query, maxResults) => gmail.listEmails(auth, query, maxResults, userContext),
      search: (query, maxResults) => gmail.searchEmails(auth, query, maxResults, userContext),
      read: (messageId) => gmail.readEmail(auth, messageId, userContext),
      send: (to, subject, body, cc, bcc) => gmail.sendEmail(auth, to, subject, body, cc, bcc, userContext),
      delete: (messageId) => gmail.deleteEmail(auth, messageId, userContext),
      trash: (messageId) => gmail.trashEmail(auth, messageId, userContext),
      modify: (messageId, addLabels, removeLabels) => gmail.modifyLabels(auth, messageId, addLabels, removeLabels, userContext),
      labels: {
        list: () => gmail.getLabels(auth),
        create: (requestBody) => gmail.createLabel(auth, requestBody),
        update: (labelId, requestBody) => gmail.updateLabel(auth, labelId, requestBody),
        delete: (labelId) => gmail.deleteLabel(auth, labelId),
        bulkModify: (messageIds, addLabels, removeLabels) => gmail.bulkModifyLabels(auth, messageIds, addLabels, removeLabels),
      },
      filters: {
        list: () => gmail.listFilters(auth),
        get: (filterId) => gmail.getFilter(auth, filterId),
        create: (criteria, action) => gmail.createFilter(auth, criteria, action),
        delete: (filterId) => gmail.deleteFilter(auth, filterId),
        replace: (filterId, criteriaPatch, actionPatch) => gmail.replaceFilter(auth, filterId, criteriaPatch, actionPatch),
      },
      attachments: {
        list: (messageId) => gmail.getEmailAttachments(auth, messageId),
        download: (messageId, attachmentId) => gmail.downloadAttachment(auth, messageId, attachmentId),
      }
    },
    scripts: {
      create: (sheetId, name) => scripts.createScript(auth, sheetId, name, userContext),
      list: (sheetId) => scripts.listScripts(auth, sheetId, userContext),
      read: (sheetId, id) => scripts.readScript(auth, sheetId, id, userContext),
      write: (sheetId, id, file, content) => scripts.writeScript(auth, sheetId, id, file, content, userContext),
      delete: (sheetId, id) => scripts.deleteScript(auth, sheetId, id, userContext),
      run: (sheetId, id, fn, params) => scripts.runScript(auth, sheetId, id, fn, params, userContext),
      search: (query, max) => scripts.searchScripts(auth, query, max, userContext),
      sync: (sheetId) => scripts.syncScripts(auth, sheetId, userContext),
    },
    drive: {
      search: (query) => docs.searchDrive(auth, query, userContext),
      list: () => docs.listDocuments(auth, userContext),
      upload: (filePath, mimeType, parentFolderId, fileName) => docs.uploadFile(auth, filePath, mimeType, parentFolderId, fileName),
    }
  };
}

function createOAuthClient(tokens, clientId, clientSecret) {
  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

function createADCClient(scopes = DEFAULT_SCOPES) {
  return new GoogleAuth({ scopes });
}

function createTokenClient(accessToken) {
  const oauth2Client = new OAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

async function callTool(toolName, parameters, auth, userContext = {}) {
  const client = createClient(auth, userContext);
  const parts = toolName.split('_');
  
  if (parts.length < 2) {
    throw new Error(`Invalid tool name: ${toolName}`);
  }
  
  const namespace = parts[0];
  const operation = parts.slice(1).join('_');
  
  if (client[namespace] && typeof client[namespace][operation] === 'function') {
    return client[namespace][operation](...Object.values(parameters));
  }
  
  throw new Error(`Unknown tool: ${toolName}`);
}

export {
  createClient,
  createOAuthClient,
  createADCClient,
  createTokenClient,
  callTool,
  DEFAULT_SCOPES
};
