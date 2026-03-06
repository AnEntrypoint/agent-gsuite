import * as docs from './docs.js';
import * as sheets from './sheets.js';
import * as gmail from './gmail.js';

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
      trash: (messageId) => gmail.trashEmail(auth, messageId, userContext)
    }
  };
}

function createOAuthClient(tokens, clientId, clientSecret) {
  const { OAuth2Client } = require('google-auth-library');
  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

function createADCClient(scopes = DEFAULT_SCOPES) {
  const { GoogleAuth } = require('google-auth-library');
  return new GoogleAuth({ scopes });
}

function createTokenClient(accessToken) {
  const { OAuth2Client } = require('google-auth-library');
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
