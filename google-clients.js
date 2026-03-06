import { google } from 'googleapis';

export function getDocsClient(auth) {
  return google.docs({ version: 'v1', auth });
}

export function getSheetsClient(auth) {
  return google.sheets({ version: 'v4', auth });
}

export function getGmailClient(auth) {
  return google.gmail({ version: 'v1', auth });
}

export function getScriptClient(auth) {
  return google.script({ version: 'v1', auth });
}

export function getDriveClient(auth) {
  return google.drive({ version: 'v3', auth });
}
