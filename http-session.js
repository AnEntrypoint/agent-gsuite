import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SESSION_FILE = process.env.SESSION_FILE || (() => {
  try {
    fs.mkdirSync('/data', { recursive: true });
    return '/data/sessions.json';
  } catch (e) {
    return path.join(path.dirname(fileURLToPath(import.meta.url)), 'sessions.json');
  }
})();

export class SessionManager {
  constructor() {
    this.sessionMap = new Map();
    this.loadSessions();
  }

  loadSessions() {
    try {
      if (!fs.existsSync(SESSION_FILE)) return;
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      for (const [id, session] of Object.entries(data)) {
        this.sessionMap.set(id, session);
      }
      console.log(`[sessions] Loaded ${this.sessionMap.size} sessions`);
    } catch (err) {
      console.error('[sessions] Load failed:', err.message);
    }
  }

  saveSessions() {
    try {
      const dir = path.dirname(SESSION_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = {};
      for (const [id, session] of this.sessionMap.entries()) {
        data[id] = session;
      }
      fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[sessions] Save failed:', err.message);
    }
  }

  setSession(id, session) {
    this.sessionMap.set(id, session);
    this.saveSessions();
  }

  getSession(id) {
    return this.sessionMap.get(id);
  }

  size() {
    return this.sessionMap.size;
  }

  entries() {
    return this.sessionMap.entries();
  }

  has(id) {
    return this.sessionMap.has(id);
  }
}
