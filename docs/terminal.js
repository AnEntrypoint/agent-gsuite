const PAGES = {
  home: [
    { type: 'ascii', text:
` ___  __ _ ___ _ __ | |_    __ _ ___ _   _ (_)| |_ ___
/ _  \\/ _\` |/ _ \\ '_ \\| __|  / _\` |/ __| | | || || __/ _ \\
| (_| | (_| |  __/ | | | |_ | (_| |\\__ \\ |_| || || ||  __/
\\__,_|\\__, |\\___|_| |_|\\__|  \\__, ||___/\\__,_||_| \\__\\___|
      |___/                  |___/` },
    { type: 'line' },
    { type: 'info', text: '  Google Workspace MCP Server v1.0.16' },
    { type: 'info', text: '  106 tools | 12 services | JS/Bun runtime' },
    { type: 'line' },
    { type: 'dim', text: '  Type a command or click a section below.' },
    { type: 'line' },
    { type: 'nav', items: ['services', 'install', 'auth', 'tools', 'api', 'about'] },
    { type: 'line' },
    { type: 'dim', text: '  $ agent-gsuite --help' },
  ],
  services: [
    { type: 'cyan', text: '=== SUPPORTED SERVICES ===' },
    { type: 'line' },
    { type: 'table', headers: ['Service', 'Tools', 'Description'], rows: [
      ['Calendar', '7', 'Events, freebusy, OOO, focus time, RSVP'],
      ['Contacts', '8', 'People, groups, search, batch operations'],
      ['Chat',     '6', 'Spaces, messages, reactions, attachments'],
      ['Docs',     '14','Create, read, edit, format, sections, images, markdown, PDF'],
      ['Drive',    '5', 'Search, upload, copy, download, permissions'],
      ['Gmail',    '22','Messages, threads, drafts, labels, filters, bulk ops'],
      ['Sheets',   '20','Read, write, format, merge, sort, formulas, tabs'],
      ['Scripts',  '8', 'Apps Script CRUD, execution, sync'],
      ['Slides',   '5', 'Presentations, pages, thumbnails, batch update'],
      ['Tasks',    '6', 'Task lists, CRUD, move, subtasks'],
      ['Search',   '2', 'Google Custom Search API'],
      ['Forms',    '3', 'Coming soon'],
    ]},
    { type: 'line' },
    { type: 'dim', text: '  Total: 106 tools across 12 Google services' },
    { type: 'nav', items: ['home', 'install', 'tools'] },
  ],
  install: [
    { type: 'cyan', text: '=== INSTALLATION ===' },
    { type: 'line' },
    { type: 'yellow', text: '  # Install globally' },
    { type: 'white', text: '  npm install -g agent-gsuite' },
    { type: 'line' },
    { type: 'yellow', text: '  # Or run directly' },
    { type: 'white', text: '  npx agent-gsuite auth login' },
    { type: 'line' },
    { type: 'yellow', text: '  # Start MCP server (stdio)' },
    { type: 'white', text: '  agent-gsuite-mcp' },
    { type: 'line' },
    { type: 'yellow', text: '  # Start HTTP server' },
    { type: 'white', text: '  agent-gsuite-http --port 3000 --host 0.0.0.0' },
    { type: 'line' },
    { type: 'yellow', text: '  # Claude Desktop config (~/.claude/claude_desktop_config.json)' },
    { type: 'white', text: `  {
    "mcpServers": {
      "agent-gsuite": {
        "command": "npx",
        "args": ["-y", "agent-gsuite-mcp"]
      }
    }
  }` },
    { type: 'line' },
    { type: 'cyan', text: '=== PREREQUISITES ===' },
    { type: 'line' },
    { type: 'info', text: '  1. Node.js >= 20 (or Bun)' },
    { type: 'info', text: '  2. Google Cloud project with OAuth 2.0 credentials' },
    { type: 'info', text: '  3. Enable APIs: Docs, Sheets, Drive, Gmail, Calendar, etc.' },
    { type: 'line' },
    { type: 'nav', items: ['home', 'auth', 'services'] },
  ],
  auth: [
    { type: 'cyan', text: '=== AUTHENTICATION ===' },
    { type: 'line' },
    { type: 'yellow', text: '  # Interactive OAuth login' },
    { type: 'white', text: '  agent-gsuite auth login' },
    { type: 'line' },
    { type: 'yellow', text: '  # Token-based auth (no files needed)' },
    { type: 'white', text: '  export GSUITE_TOKENS=\'{"access_token":"...","refresh_token":"..."}\'' },
    { type: 'line' },
    { type: 'yellow', text: '  # Application Default Credentials' },
    { type: 'white', text: '  gcloud auth application-default login' },
    { type: 'line' },
    { type: 'yellow', text: '  # Relay proxy (bypass CORS/firewall)' },
    { type: 'white', text: '  export GSUITE_RELAY_URL=https://your-relay.example.com' },
    { type: 'line' },
    { type: 'cyan', text: '  OAuth Scopes requested:' },
    { type: 'dim', text: '    drive, documents, spreadsheets, script.projects,' },
    { type: 'dim', text: '    gmail.modify, gmail.settings.basic, calendar,' },
    { type: 'dim', text: '    tasks, contacts, chat, presentations, forms' },
    { type: 'line' },
    { type: 'nav', items: ['home', 'install', 'services'] },
  ],
  tools: [
    { type: 'cyan', text: '=== TOOL INDEX ===' },
    { type: 'line' },
    { type: 'yellow', text: '  Calendar (7)' },
    { type: 'dim', text: '    calendar_list  calendar_get_events  calendar_manage_event' },
    { type: 'dim', text: '    calendar_freebusy  calendar_create  calendar_out_of_office' },
    { type: 'dim', text: '    calendar_focus_time' },
    { type: 'line' },
    { type: 'yellow', text: '  Docs (14)' },
    { type: 'dim', text: '    docs_create  docs_read  docs_edit  docs_insert  docs_delete' },
    { type: 'dim', text: '    docs_format  docs_insert_table  docs_get_info  docs_list' },
    { type: 'dim', text: '    docs_get_structure  docs_batch  docs_find_replace' },
    { type: 'dim', text: '    docs_export_pdf  docs_as_markdown' },
    { type: 'line' },
    { type: 'yellow', text: '  Sheets (20)' },
    { type: 'dim', text: '    sheets_create  sheets_read  sheets_edit  sheets_insert' },
    { type: 'dim', text: '    sheets_get_cell  sheets_set_cell  sheets_edit_cell' },
    { type: 'dim', text: '    sheets_find_replace  sheets_get_info  sheets_list  sheets_tab' },
    { type: 'dim', text: '    sheets_clear  sheets_format  sheets_merge  sheets_freeze' },
    { type: 'dim', text: '    sheets_sort  sheets_rows_cols  sheets_dimension_size' },
    { type: 'dim', text: '    sheets_get_formula  sheets_batch' },
    { type: 'line' },
    { type: 'yellow', text: '  Gmail (22)' },
    { type: 'dim', text: '    gmail_list  gmail_search  gmail_read  gmail_send  gmail_draft' },
    { type: 'dim', text: '    gmail_get_thread  gmail_batch_get  gmail_delete  gmail_trash' },
    { type: 'dim', text: '    gmail_modify_labels  gmail_bulk_modify_labels' },
    { type: 'dim', text: '    gmail_get_attachments  gmail_download_attachment' },
    { type: 'dim', text: '    gmail_get_labels  gmail_create_label  gmail_update_label' },
    { type: 'dim', text: '    gmail_delete_label  gmail_list_filters  gmail_get_filter' },
    { type: 'dim', text: '    gmail_create_filter  gmail_delete_filter  gmail_replace_filter' },
    { type: 'line' },
    { type: 'yellow', text: '  Drive (5)' },
    { type: 'dim', text: '    drive_search  drive_upload  drive_get_download_url' },
    { type: 'dim', text: '    drive_copy  drive_manage_access' },
    { type: 'line' },
    { type: 'yellow', text: '  Tasks (6) | Slides (5) | Contacts (8) | Chat (6)' },
    { type: 'dim', text: '    tasks_list_lists  tasks_get_list  tasks_manage_list' },
    { type: 'dim', text: '    tasks_list  tasks_get  tasks_manage' },
    { type: 'dim', text: '    slides_create  slides_get  slides_batch_update' },
    { type: 'dim', text: '    slides_get_page  slides_get_thumbnail' },
    { type: 'dim', text: '    contacts_list  contacts_get  contacts_search  contacts_manage' },
    { type: 'dim', text: '    contacts_list_groups  contacts_get_group  contacts_batch' },
    { type: 'dim', text: '    contacts_manage_group' },
    { type: 'dim', text: '    chat_list_spaces  chat_get_messages  chat_send_message' },
    { type: 'dim', text: '    chat_search_messages  chat_create_reaction' },
    { type: 'dim', text: '    chat_download_attachment' },
    { type: 'line' },
    { type: 'yellow', text: '  Scripts (8) | Search (2)' },
    { type: 'dim', text: '    scripts_search  scripts_create  scripts_list  scripts_read' },
    { type: 'dim', text: '    scripts_write  scripts_delete  scripts_run  scripts_sync' },
    { type: 'dim', text: '    search_custom  search_engine_info' },
    { type: 'line' },
    { type: 'nav', items: ['home', 'services', 'api'] },
  ],
  api: [
    { type: 'cyan', text: '=== TRANSPORT MODES ===' },
    { type: 'line' },
    { type: 'yellow', text: '  stdio (default MCP)' },
    { type: 'dim', text: '    agent-gsuite-mcp' },
    { type: 'dim', text: '    Standard MCP stdio transport for Claude Desktop, VS Code, etc.' },
    { type: 'line' },
    { type: 'yellow', text: '  HTTP/SSE server' },
    { type: 'dim', text: '    agent-gsuite-http --port 3000' },
    { type: 'dim', text: '    StreamableHTTP + SSE transport with OAuth session management.' },
    { type: 'dim', text: '    Endpoints: /mcp, /sse/:sessionId, /login, /auth/callback' },
    { type: 'line' },
    { type: 'yellow', text: '  Relay proxy' },
    { type: 'dim', text: '    GSUITE_RELAY_URL=https://relay.example.com' },
    { type: 'dim', text: '    Routes all googleapis requests through a proxy server.' },
    { type: 'dim', text: '    Useful for environments with restricted network access.' },
    { type: 'line' },
    { type: 'cyan', text: '=== SDK CLIENT ===' },
    { type: 'line' },
    { type: 'white', text: `  import { createClient } from 'agent-gsuite';
  const client = createClient({ configDir: '~/.config/agent-gsuite' });
  const docs = await client.docs.list({ max_results: 10 });
  const email = await client.gmail.send({ to: '...', subject: '...', body: '...' });` },
    { type: 'line' },
    { type: 'nav', items: ['home', 'install', 'tools'] },
  ],
  about: [
    { type: 'cyan', text: '=== ABOUT ===' },
    { type: 'line' },
    { type: 'info', text: '  agent-gsuite is an MCP server that gives AI agents' },
    { type: 'info', text: '  full access to Google Workspace — Docs, Sheets, Gmail,' },
    { type: 'info', text: '  Calendar, Drive, Slides, Tasks, Contacts, Chat, and more.' },
    { type: 'line' },
    { type: 'info', text: '  Built for Claude Code, Claude Desktop, and any MCP client.' },
    { type: 'info', text: '  Designed for compound agentic workflows — not just CRUD.' },
    { type: 'line' },
    { type: 'yellow', text: '  Architecture highlights:' },
    { type: 'dim', text: '    - Relay proxy for restricted networks' },
    { type: 'dim', text: '    - Multi-transport: stdio, HTTP/SSE, StreamableHTTP' },
    { type: 'dim', text: '    - OAuth session management with auto-refresh' },
    { type: 'dim', text: '    - GSUITE_TOKENS env var for containerized deployment' },
    { type: 'dim', text: '    - Claude Code skills integration' },
    { type: 'line' },
    { type: 'info', text: '  GitHub:  https://github.com/AnEntrypoint/agent-gsuite' },
    { type: 'info', text: '  npm:     https://www.npmjs.com/package/agent-gsuite' },
    { type: 'info', text: '  License: MIT' },
    { type: 'line' },
    { type: 'nav', items: ['home', 'services', 'install'] },
  ],
};

const COMMANDS = {
  help: () => [
    { type: 'cyan', text: 'Available commands:' },
    { type: 'info', text: '  home       - Main page' },
    { type: 'info', text: '  services   - List all 12 Google services' },
    { type: 'info', text: '  install    - Installation guide' },
    { type: 'info', text: '  auth       - Authentication setup' },
    { type: 'info', text: '  tools      - Full tool index (106 tools)' },
    { type: 'info', text: '  api        - Transport modes & SDK' },
    { type: 'info', text: '  about      - Project info' },
    { type: 'info', text: '  clear      - Clear terminal' },
  ],
  clear: () => 'CLEAR',
};

const output = document.getElementById('output');
const terminal = document.getElementById('terminal');
let currentPage = 'home';
let typing = false;

function span(cls, text) {
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
  return `<span class="${cls}">${linked}</span>`;
}

function renderTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i]||'').length)));
  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
  let html = span('table-header', '  ' + headers.map((h, i) => pad(h, widths[i])).join('  ')) + '\n';
  html += span('dim', '  ' + widths.map(w => '-'.repeat(w)).join('  ')) + '\n';
  for (const row of rows) {
    html += span('table-row', '  ' + row.map((c, i) => pad(c || '', widths[i])).join('  ')) + '\n';
  }
  return html;
}

function renderNav(items) {
  return items.map(item =>
    `<a class="nav-item${item === currentPage ? ' active' : ''}" data-page="${item}">[${item}]</a>`
  ).join(' ');
}

async function renderPage(name) {
  const page = PAGES[name];
  if (!page) return;
  currentPage = name;
  output.innerHTML = '';

  for (const block of page) {
    let html = '';
    switch (block.type) {
      case 'ascii': html = span('ascii', block.text); break;
      case 'info': html = span('info', block.text); break;
      case 'dim': html = span('dim', block.text); break;
      case 'cyan': html = span('cyan bold', block.text); break;
      case 'yellow': html = span('yellow', block.text); break;
      case 'white': html = span('white', block.text); break;
      case 'red': html = span('red', block.text); break;
      case 'line': html = ''; break;
      case 'table': html = renderTable(block.headers, block.rows); break;
      case 'nav': html = '  ' + renderNav(block.items); break;
      default: html = span('info', block.text || ''); break;
    }

    const line = document.createElement('div');
    line.className = 'line';
    line.innerHTML = html;
    output.appendChild(line);

    await sleep(15);
  }

  terminal.scrollTop = terminal.scrollHeight;
  bindNav();
}

function bindNav() {
  for (const el of document.querySelectorAll('.nav-item')) {
    el.onclick = (e) => {
      e.preventDefault();
      const page = el.dataset.page;
      if (page && PAGES[page]) renderPage(page);
    };
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

document.addEventListener('keydown', (e) => {
  if (typing) return;
  const key = e.key.toLowerCase();
  if (key === 'h') renderPage('home');
  else if (key === 's') renderPage('services');
  else if (key === 'i') renderPage('install');
  else if (key === 'a' && !e.ctrlKey) renderPage('auth');
  else if (key === 't') renderPage('tools');
  else if (key === 'p') renderPage('api');
  else if (key === 'b') renderPage('about');
  else if (key === 'c' && !e.ctrlKey) { output.innerHTML = ''; }
});

renderPage('home');
