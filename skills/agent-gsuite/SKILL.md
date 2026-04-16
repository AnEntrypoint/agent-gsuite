---
name: agent-gsuite
description: Google Workspace operations — Docs, Sheets, Drive, Apps Script, Gmail, Calendar, Tasks, Slides, Contacts, Chat, and Search. Use for creating, reading, editing Google Docs/Sheets/Slides. Use for Drive file management. Use for Calendar events and scheduling. Use for Gmail messages, labels, and filters. Use for Tasks, Contacts, and Chat.
allowed-tools: Bash(node *), Bash(npx *), Read, Glob
---

# Google Workspace — 12 Services, 106 Tools

You have access to a CLI tool that performs all Google Workspace operations. Run it via:

```bash
node ~/.claude/skills/agent-gsuite/scripts/gsuite.mjs <command> '<json-args>'
```

All commands accept a single JSON argument. Output is always JSON.

## Authentication

Tokens are stored at `~/.config/agent-gsuite/token.json`. If tokens are missing, tell the user to run:

```bash
bun x agent-gsuite auth login
```

Or if bun is unavailable:

```bash
node ~/.claude/skills/agent-gsuite/scripts/gsuite.mjs auth
```

## Commands Reference

### Google Docs

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `docs.create` | `{"title": "..."}` | Create a new doc |
| `docs.read` | `{"doc_id": "..."}` | Read doc text content |
| `docs.edit` | `{"doc_id": "...", "old_text": "...", "new_text": "...", "replace_all": false}` | Replace text in doc |
| `docs.insert` | `{"doc_id": "...", "text": "...", "position": "end"}` | Insert text (position: "end", text-to-insert-after, or index number) |
| `docs.delete` | `{"doc_id": "...", "text": "...", "delete_all": false}` | Delete text from doc |
| `docs.format` | `{"doc_id": "...", "search_text": "...", ...formatting}` | Format text (bold, italic, underline, strikethrough, font_size, font_family, foreground_color, background_color, heading, alignment) |
| `docs.insert_table` | `{"doc_id": "...", "rows": 3, "cols": 3, "position": "end"}` | Insert table |
| `docs.get_info` | `{"doc_id": "..."}` | Get doc metadata |
| `docs.get_structure` | `{"doc_id": "..."}` | Get headings hierarchy |
| `docs.get_sections` | `{"doc_id": "..."}` | Parse sections with indices |
| `docs.section` | `{"doc_id": "...", "action": "delete\|move\|replace", "section": "name-or-index", ...}` | Manage sections (target for move, content + preserve_heading for replace) |
| `docs.image` | `{"doc_id": "...", "action": "insert\|list\|delete\|replace", ...}` | Manage images (image_url, image_index, position, width, height) |
| `docs.batch` | `{"doc_id": "...", "operations": [...]}` | Batch operations (type: insert/delete/format with params) |
| `docs.list` | `{"max_results": 20, "query": "..."}` | List docs |
| `docs_find_replace` | `{"doc_id": "...", "find_text": "...", "replace_text": "...", "match_case": false}` | Find and replace all |
| `docs_export_pdf` | `{"doc_id": "..."}` | Export doc as PDF (base64) |
| `docs_as_markdown` | `{"doc_id": "..."}` | Get doc as markdown |

### Google Sheets

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `sheets.create` | `{"title": "..."}` | Create spreadsheet |
| `sheets.read` | `{"sheet_id": "...", "range": "Sheet1"}` | Read values from range |
| `sheets.edit` | `{"sheet_id": "...", "range": "A1:B2", "values": [[...]]}` | Update range values |
| `sheets.insert` | `{"sheet_id": "...", "values": [[...]], "range": "Sheet1"}` | Append rows |
| `sheets.get_cell` | `{"sheet_id": "...", "cell": "A1"}` | Get cell value |
| `sheets.set_cell` | `{"sheet_id": "...", "cell": "A1", "value": "..."}` | Set cell value |
| `sheets.edit_cell` | `{"sheet_id": "...", "cell": "A1", "old_text": "...", "new_text": "...", "replace_all": false}` | Replace text in cell |
| `sheets.find_replace` | `{"sheet_id": "...", "find": "...", "replace": "...", "sheet_name": null}` | Find/replace across sheet |
| `sheets.get_info` | `{"sheet_id": "..."}` | Get spreadsheet metadata |
| `sheets.list` | `{"max_results": 20, "query": "..."}` | List spreadsheets |
| `sheets.tab` | `{"sheet_id": "...", "action": "add\|delete\|rename", "title": "...", "sheet_name": "..."}` | Manage tabs |
| `sheets.clear` | `{"sheet_id": "...", "range": "A1:B2", "clear_formats": false}` | Clear range |
| `sheets.format` | `{"sheet_id": "...", "range": "A1:B2", ...formatting}` | Format range (background_color, text_color, bold, italic, font_size, font_family, horizontal_alignment, vertical_alignment, wrap_strategy, number_format, borders) |
| `sheets.merge` | `{"sheet_id": "...", "range": "A1:B2", "action": "merge\|unmerge"}` | Merge/unmerge cells |
| `sheets.freeze` | `{"sheet_id": "...", "sheet_name": "...", "rows": 1, "columns": 0}` | Freeze rows/columns |
| `sheets.sort` | `{"sheet_id": "...", "range": "A1:C10", "sort_column": "A", "ascending": true}` | Sort range |
| `sheets.rows_cols` | `{"sheet_id": "...", "sheet_name": "...", "action": "insert\|delete", "dimension": "ROW\|COLUMN", "start_index": 0, "count": 1}` | Insert/delete rows or columns |
| `sheets.dimension_size` | `{"sheet_id": "...", "sheet_name": "...", "dimension": "COLUMN\|ROW", "start": "A", "end": "C", "size": 150}` | Set column width or row height |
| `sheets.get_formula` | `{"sheet_id": "...", "cell": "A1"}` | Get cell formula and value |
| `sheets.batch` | `{"sheet_id": "...", "operations": [...]}` | Batch operations (type: setValue/format) |

### Google Drive

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `drive.search` | `{"query": "...", "type": "all\|docs\|sheets", "max_results": 20}` | Search Drive |
| `drive_get_download_url` | `{"file_id": "..."}` | Get download URL |
| `drive_copy` | `{"file_id": "...", "name": "...", "parent_folder_id": "..."}` | Copy a file |
| `drive_manage_access` | `{"file_id": "...", "action": "share\|unshare\|list", "email": "...", "role": "reader\|writer"}` | Manage file permissions |

### Apps Script

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `scripts.create` | `{"sheet_id": "...", "script_name": "..."}` | Create script project |
| `scripts.list` | `{"sheet_id": "..."}` | List scripts |
| `scripts.read` | `{"sheet_id": "...", "script": "name-or-index"}` | Read script files |
| `scripts.write` | `{"sheet_id": "...", "script": "...", "file_name": "...", "content": "...", "file_type": "SERVER_JS\|HTML"}` | Write script file (full overwrite) |
| `scripts.edit` | `{"sheet_id": "...", "script": "...", "file_name": "...", "old_text": "...", "new_text": "...", "replace_all": false}` | Edit script file (text replacement) |
| `scripts.delete` | `{"sheet_id": "...", "script": "..."}` | Remove script tracking |
| `scripts.run` | `{"sheet_id": "...", "script": "...", "function_name": "...", "parameters": []}` | Execute script function |
| `scripts.sync` | `{"sheet_id": "..."}` | Sync and verify scripts |

### Gmail — Messages

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `gmail.list_messages` | `{"query": "...", "max_results": 20, "label_ids": [...]}` | List messages (query: "from:x@x.com", "is:unread", "subject:meeting") |
| `gmail.get_message` | `{"message_id": "...", "format": "full"}` | Get message details (format: full, minimal, metadata) |
| `gmail.send_message` | `{"to": "...", "subject": "...", "body": "...", "from": "...", "cc": "...", "bcc": "..."}` | Send email |
| `gmail.list_threads` | `{"query": "...", "max_results": 10}` | List threads |
| `gmail.get_thread` | `{"thread_id": "...", "format": "full"}` | Get thread details |
| `gmail.modify_message` | `{"message_id": "...", "add_labels": [...], "remove_labels": [...]}` | Modify message labels |
| `gmail.trash_message` | `{"message_id": "..."}` | Move message to trash |
| `gmail.delete_message` | `{"message_id": "..."}` | Permanently delete message |
| `gmail_get_attachments` | `{"message_id": "..."}` | List message attachments |
| `gmail_download_attachment` | `{"message_id": "...", "attachment_id": "..."}` | Download attachment as base64 |
| `gmail_bulk_modify_labels` | `{"query": "...", "add_labels": [...], "remove_labels": [...], "max_results": 2000}` | Bulk label modification by query |

### Gmail — Labels

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `gmail.list_labels` | `{}` | List all Gmail labels with counts and metadata |
| `gmail_create_label` | `{"name": "...", "label_list_visibility": "...", "message_list_visibility": "...", "color": {"text_color": "#000", "background_color": "#fff"}}` | Create label |
| `gmail_update_label` | `{"label_id": "...", "name": "...", ...}` | Update label |
| `gmail_delete_label` | `{"label_id": "..."}` | Delete label |

### Gmail — Filters

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `gmail_list_filters` | `{}` | List all Gmail filters |
| `gmail_get_filter` | `{"filter_id": "..."}` | Get filter details |
| `gmail_create_filter` | `{"criteria": {"from": "...", "subject": "...", "has_attachment": true, ...}, "action": {"add_label_ids": [...], "remove_label_ids": [...], "forward": "..."}}` | Create filter |
| `gmail_delete_filter` | `{"filter_id": "..."}` | Delete filter |
| `gmail_replace_filter` | `{"filter_id": "...", "criteria": {...}, "action": {...}}` | Replace filter (Gmail has no native update API) |
| `gmail_draft` | `{"to": "...", "subject": "...", "body": "...", "cc": "...", "bcc": "..."}` | Create draft email |
| `gmail_get_thread` | `{"thread_id": "...", "format": "full"}` | Get full thread content |
| `gmail_batch_get` | `{"message_ids": [...], "format": "full"}` | Batch get messages |

### Google Calendar

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `calendar_list` | `{}` | List all calendars |
| `calendar_get_events` | `{"calendar_id": "primary", "time_min": "...", "time_max": "...", "query": "...", "max_results": 25, "detailed": false}` | Get events |
| `calendar_manage_event` | `{"action": "create\|update\|delete\|rsvp", "summary": "...", "start_time": "...", "end_time": "...", "event_id": "...", "attendees": [...], "add_google_meet": true}` | Manage events |
| `calendar_freebusy` | `{"time_min": "...", "time_max": "...", "calendar_ids": ["primary"]}` | Query free/busy |
| `calendar_create` | `{"summary": "...", "description": "...", "timezone": "..."}` | Create calendar |
| `calendar_out_of_office` | `{"action": "list\|create\|delete", "start_time": "...", "end_time": "..."}` | Manage OOO |
| `calendar_focus_time` | `{"action": "list\|create\|delete", "start_time": "...", "end_time": "..."}` | Manage focus time |

### Google Tasks

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `tasks_list_lists` | `{}` | List task lists |
| `tasks_get_list` | `{"tasklist_id": "..."}` | Get task list |
| `tasks_manage_list` | `{"action": "create\|update\|delete\|clear", "title": "..."}` | Manage task lists |
| `tasks_list` | `{"tasklist_id": "@default", "show_completed": true}` | List tasks |
| `tasks_get` | `{"tasklist_id": "...", "task_id": "..."}` | Get task |
| `tasks_manage` | `{"action": "create\|update\|delete\|move", "title": "...", "due": "...", "status": "needsAction\|completed"}` | Manage tasks |

### Google Slides

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `slides_create` | `{"title": "..."}` | Create presentation |
| `slides_get` | `{"presentation_id": "..."}` | Get presentation metadata |
| `slides_batch_update` | `{"presentation_id": "...", "requests": [...]}` | Batch update |
| `slides_get_page` | `{"presentation_id": "...", "page_id": "..."}` | Get page elements |
| `slides_get_thumbnail` | `{"presentation_id": "...", "page_id": "...", "mime_type": "PNG"}` | Get slide thumbnail |

### Google Contacts

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `contacts_list` | `{"page_size": 100}` | List contacts |
| `contacts_get` | `{"resource_name": "people/c123"}` | Get contact |
| `contacts_search` | `{"query": "..."}` | Search contacts |
| `contacts_manage` | `{"action": "create\|update\|delete", "given_name": "...", "emails": [...], "phones": [...]}` | Manage contacts |
| `contacts_list_groups` | `{}` | List groups |
| `contacts_get_group` | `{"resource_name": "..."}` | Get group |
| `contacts_batch` | `{"action": "add_to_group\|remove_from_group", "resource_names": [...], "group_resource_name": "..."}` | Batch group ops |
| `contacts_manage_group` | `{"action": "create\|update\|delete", "name": "..."}` | Manage groups |

### Google Chat

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `chat_list_spaces` | `{}` | List Chat spaces |
| `chat_get_messages` | `{"space_name": "spaces/AAAA", "page_size": 25}` | Get messages |
| `chat_send_message` | `{"space_name": "...", "text": "...", "thread_key": "..."}` | Send message |
| `chat_search_messages` | `{"query": "..."}` | Search messages |
| `chat_create_reaction` | `{"message_name": "...", "emoji": "👍"}` | Add reaction |
| `chat_download_attachment` | `{"attachment_name": "..."}` | Download attachment |

### Google Custom Search

| Command | JSON Args | Description |
|---------|-----------|-------------|
| `search_custom` | `{"query": "...", "num": 10, "site_search": "...", "file_type": "pdf"}` | Web search (requires GOOGLE_API_KEY) |
| `search_engine_info` | `{"search_engine_id": "..."}` | Get search engine info |

## Usage Pattern

Always use this exact invocation pattern:

```bash
node ~/.claude/skills/agent-gsuite/scripts/gsuite.mjs <command> '<json-args>'
```

Example: Create a document:
```bash
node ~/.claude/skills/agent-gsuite/scripts/gsuite.mjs docs.create '{"title":"Meeting Notes"}'
```

Example: Read a spreadsheet:
```bash
node ~/.claude/skills/agent-gsuite/scripts/gsuite.mjs sheets.read '{"sheet_id":"1abc...xyz","range":"Sheet1!A1:D10"}'
```

Example: Format text bold in a doc:
```bash
node ~/.claude/skills/agent-gsuite/scripts/gsuite.mjs docs.format '{"doc_id":"1abc...xyz","search_text":"Important","bold":true}'
```

Example: Search Gmail for unread emails:
```bash
node ~/.claude/skills/agent-gsuite/scripts/gsuite.mjs gmail.list_messages '{"query":"is:unread","max_results":10}'
```

Example: Create a Gmail filter:
```bash
node ~/.claude/skills/agent-gsuite/scripts/gsuite.mjs gmail_create_filter '{"criteria":{"from":"newsletter@example.com"},"action":{"add_label_ids":["Label_123"],"remove_label_ids":["INBOX"]}}'
```
