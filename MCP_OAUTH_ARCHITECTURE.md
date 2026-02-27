# docmcp MCP Server - OAuth Architecture

## Overview

docmcp is an **OAuth-authenticated MCP server** where:
- **Users authenticate with Google OAuth**
- **Each user gets MCP access to THEIR OWN files**
- **No shared credentials** - each user's Google account is isolated
- **Per-user session isolation** via sessionId

## Authentication Flow

### 1. User Authenticates with Google OAuth

```
User → /auth/login
         ↓
    Google OAuth Consent Screen
         ↓
    User approves access to:
    - Google Drive
    - Google Docs
    - Google Sheets
    - Gmail
    - Apps Script
         ↓
    /auth/callback with authorization code
         ↓
    Server exchanges code for tokens
         ↓
    User receives sessionId
```

### 2. MCP Server Authentication

```
sessionId = unique identifier for user's Google OAuth session
            ↓
Contains: {
  access_token: user's Google access token
  refresh_token: for token refresh
  expiry_date: token expiration time
  user_email: authenticated user's email
}
            ↓
MCP Client connects to /sse/:sessionId
            ↓
All tool calls execute with user's credentials
```

### 3. Tool Execution - Per-User Access

```
User A authenticates
  ├─ Gets sessionId-A
  ├─ Connects to /sse/sessionId-A
  └─ Can only access User A's Google files

User B authenticates
  ├─ Gets sessionId-B
  ├─ Connects to /sse/sessionId-B
  └─ Can only access User B's Google files

User A cannot access User B's files
User B cannot access User A's files
```

## MCP OAuth Credentials

**Google OAuth App (for docmcp):**
```
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret

Scopes Requested:
- https://www.googleapis.com/auth/drive (Google Drive access)
- https://www.googleapis.com/auth/documents (Google Docs access)
- https://www.googleapis.com/auth/spreadsheets (Google Sheets access)
- https://www.googleapis.com/auth/script.projects (Apps Script access)
- https://www.googleapis.com/auth/gmail.modify (Gmail access)

Redirect URI:
- https://docmcp.acc.l-inc.co.za/auth/callback (production)
- http://localhost:4444/auth/callback (local development)
```

## Session-Based MCP Access

### What is a sessionId?

A **sessionId** is a unique identifier that represents:
- A user's authenticated Google OAuth session
- Their Google tokens (access + refresh)
- Their credential context
- Their file access permissions

### How sessionId Enables Per-User Access

```javascript
// When tool is called with sessionId:

1. Extract sessionId from request
   ↓
2. Look up session in sessionMap
   ↓
3. Get user's Google OAuth tokens from session
   ↓
4. Create OAuth2Client with user's tokens
   ↓
5. Execute tool using user's credentials
   ↓
6. Result contains ONLY user's data
   (e.g., User A's files, User A's emails, User A's sheets)
```

### No Token Sharing

```
sessionId-A ←→ User A's tokens (only User A can use)
sessionId-B ←→ User B's tokens (only User B can use)

Even if User A knows User B's sessionId:
- They cannot use it to access User B's files
- Session validation ensures they can only use their own sessionId
- All access is tied to the authenticated user
```

## MCP Endpoints

### GET /auth/login
- **Purpose:** Start Google OAuth authentication
- **For:** Browser or MCP client to initiate login
- **Returns:** Redirects to Google OAuth consent screen
- **Result:** sessionId from /auth/callback

### POST /auth/token
- **Purpose:** Exchange OAuth code for sessionId
- **For:** Programmatic/CLI clients that captured OAuth code
- **Request:** `{ "code": "oauth_code", "state": "state" }`
- **Response:** `{ "sessionId": "...", "credentials": {...} }`

### GET /sse/:sessionId
- **Purpose:** MCP streaming endpoint
- **For:** MCP clients to connect after authentication
- **Authentication:** sessionId in URL or X-Session-Id header
- **Connection:** SSE stream for bidirectional MCP communication
- **Data:** All operations use authenticated user's credentials

### POST /message
- **Purpose:** Send MCP messages
- **For:** MCP clients to call tools
- **Authentication:** sessionId in header or query
- **Execution:** Using authenticated user's Google credentials

## Security Model

### Per-User Isolation

```
AsyncLocalStorage Context
         ↓
sessionId is stored in request context
         ↓
When tool executes:
  - Retrieve sessionId from context
  - Get user's OAuth2Client from sessionId
  - Execute tool with user's credentials only
  - Context prevents cross-session access
```

### Token Management

```
Automatic Token Refresh:
  - If access_token expires
  - Server uses refresh_token to get new token
  - User doesn't need to re-authenticate
  - Session continues transparently

Token Storage:
  - Stored in-memory in sessionMap
  - Never exposed to other users
  - Never logged or persisted
  - Cleared when session ends
```

### Access Control

```
✓ User can access only their own Google files
✓ User cannot access other users' files
✓ User cannot impersonate other users
✓ User cannot use other users' sessionIds
✓ All API calls require valid sessionId
✓ All tool execution uses authenticated credentials
```

## Claude Code Configuration

### Setup

```json
{
  "mcpServers": {
    "docmcp": {
      "command": "sse",
      "url": "https://docmcp.acc.l-inc.co.za/sse/:sessionId",
      "headers": {
        "X-Session-Id": ":sessionId"
      },
      "transport": "sse"
    }
  }
}
```

### Each User

1. User logs in: `https://docmcp.acc.l-inc.co.za/auth/login`
2. Gets their unique `sessionId`
3. Configures Claude Code with that `sessionId`
4. Claude Code uses that sessionId to connect to `/sse/:sessionId`
5. All operations access that user's Google files

## Example: Multi-User Scenario

### User A (alice@example.com)

```
1. Visits https://docmcp.acc.l-inc.co.za/auth/login
2. Authenticates as alice@example.com
3. Approves Google Workspace access
4. Gets sessionId: "alice_session_123..."
5. Configures Claude Code with sessionId
6. Can now:
   - Create docs in Alice's Drive
   - Read Alice's Sheets
   - Send emails from Alice's Gmail
   - Access only Alice's files
```

### User B (bob@example.com)

```
1. Visits https://docmcp.acc.l-inc.co.za/auth/login
2. Authenticates as bob@example.com
3. Approves Google Workspace access
4. Gets sessionId: "bob_session_456..."
5. Configures Claude Code with sessionId
6. Can now:
   - Create docs in Bob's Drive
   - Read Bob's Sheets
   - Send emails from Bob's Gmail
   - Access only Bob's files
```

### Isolation

```
Alice (sessionId: alice_session_123...)
  ├─ Cannot access Bob's files
  ├─ Cannot use Bob's sessionId
  └─ Gets "Session not authenticated" if attempting cross-session access

Bob (sessionId: bob_session_456...)
  ├─ Cannot access Alice's files
  ├─ Cannot use Alice's sessionId
  └─ Gets "Session not authenticated" if attempting cross-session access
```

## Environment Variables

### Required (Google OAuth App)

```bash
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxxxxxxx
```

### Optional (Auto-detected from Coolify)

```bash
REDIRECT_URI=https://docmcp.acc.l-inc.co.za/auth/callback
CORS_ORIGIN=https://docmcp.acc.l-inc.co.za
```

### No additional MCP-specific credentials needed!

The MCP server **uses Google OAuth for authentication**.
Each user's Google credentials **become the MCP authentication**.

## Summary

✅ **Google OAuth** - Users log in with their Google accounts
✅ **Per-user access** - Each user can only access their own files
✅ **sessionId-based** - MCP connections use OAuth sessionId
✅ **No token sharing** - Each user's tokens are isolated
✅ **Automatic refresh** - Tokens refresh transparently
✅ **Secure** - AsyncLocalStorage prevents cross-session access
✅ **Scalable** - Multiple users with independent sessions
✅ **No additional credentials** - Only Google OAuth needed

**The MCP server IS OAuth-authenticated through Google OAuth.**
