# docmcp MCP Client Setup Guide

## Overview

docmcp is an **OAuth-authenticated HTTP Streaming MCP Server** that provides access to 52 Google Workspace tools. Each user authenticates with their own Google account, ensuring per-user credential isolation and secure tool access.

## Authentication Flow

### For Browser Users

**Quick Start:**
```bash
1. Visit: https://docmcp.acc.l-inc.co.za/auth/login
2. Click "Sign in with Google"
3. Authenticate with your Google account
4. Approve access to Google Workspace
5. Receive sessionId for MCP connection
```

**What Happens:**
- User redirected to Google OAuth consent screen
- User approves access to Drive, Docs, Sheets, Gmail, Apps Script
- User receives sessionId from callback
- sessionId is valid for the user's authenticated session

### For External MCP Clients (CLI Tools, Claude Code, etc.)

**Authentication Flow:**

```
┌─────────────┐
│  MCP Client │
└──────┬──────┘
       │
       ├─→ Step 1: GET /auth/login
       │   (Open in browser or get authUrl)
       │
       │   ↓ User authenticates with Google
       │
       ├─→ Step 2: Capture authorization code from OAuth response
       │
       ├─→ Step 3: POST /auth/token
       │   Payload: { "code": "...", "state": "..." }
       │
       └─→ Step 4: Receive sessionId
           Use sessionId for SSE streaming connection
```

## API Endpoints

### GET /auth/login
- **Purpose:** Start OAuth authentication flow
- **Usage:** Browser or client redirects user here
- **Response:** Redirects to Google OAuth consent screen
- **Returns:** sessionId (via redirect to /auth/callback)

### POST /auth/token
- **Purpose:** Exchange OAuth authorization code for sessionId
- **For:** External MCP clients, CLI tools, and programmatic access
- **Request:**
  ```json
  {
    "code": "oauth_authorization_code",
    "state": "optional_state_parameter"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "sessionId": "unique_session_id",
    "sse_endpoint": "/sse/sessionId",
    "credentials": {
      "access_token": "google_access_token",
      "refresh_token": "google_refresh_token",
      "token_type": "Bearer"
    }
  }
  ```

### GET /auth/info
- **Purpose:** Learn authentication methods and configuration
- **Response:** Detailed authentication guide and setup instructions

### GET /sse/:sessionId
- **Purpose:** SSE streaming connection for MCP protocol
- **Headers:**
  - `X-Session-Id: sessionId` (alternative to URL param)
- **Query Params:**
  - `sessionId=...` (alternative to URL param)
- **Connection:** Server-Sent Events stream
- **Usage:** MCP client connects here after authentication

### POST /message
- **Purpose:** Send MCP messages to the server
- **Headers:**
  - `X-Session-Id: sessionId` OR
  - `Content-Type: application/json`
- **Query Params:**
  - `sessionId=...` (alternative)
- **Body:** MCP message JSON

## Setting Up External MCP Clients

### For Claude Code

**Configuration:**

1. **User logs in:**
   ```bash
   # Direct user to OAuth login
   https://docmcp.acc.l-inc.co.za/auth/login
   ```

2. **After OAuth approval, user receives sessionId**

3. **Configure MCP server in Claude Code:**
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

### For Command-Line Tools

**Authentication Flow:**

```bash
#!/bin/bash

SERVER="https://docmcp.acc.l-inc.co.za"

# Step 1: Open browser for user to authenticate
echo "Opening Google OAuth login..."
open "$SERVER/auth/login"

# Step 2: Capture authorization code from callback
# (This is typically handled by the OAuth library)

# Step 3: Exchange code for sessionId
RESPONSE=$(curl -X POST "$SERVER/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"code\": \"$AUTHORIZATION_CODE\", \"state\": \"$STATE\"}")

SESSION_ID=$(echo $RESPONSE | jq -r '.sessionId')

# Step 4: Use sessionId for MCP connection
curl "https://docmcp.acc.l-inc.co.za/sse/$SESSION_ID"
```

### For Custom MCP Client Implementation

**Minimal Python Example:**

```python
import requests
import json
from sseclient import SSEClient

# Step 1: Start OAuth flow
auth_url = "https://docmcp.acc.l-inc.co.za/auth/login"
print(f"Direct user to: {auth_url}")

# Step 2: After user approves, exchange code for sessionId
authorization_code = input("Enter authorization code: ")
response = requests.post(
    "https://docmcp.acc.l-inc.co.za/auth/token",
    json={"code": authorization_code}
)
session_id = response.json()["sessionId"]

# Step 3: Connect to SSE endpoint
url = f"https://docmcp.acc.l-inc.co.za/sse/{session_id}"
client = SSEClient(url)

# Step 4: Send MCP messages
for event in client:
    print(f"Received: {event.data}")
```

## Security Architecture

### Per-User Session Isolation

- **Each user gets a unique sessionId** after Google OAuth authentication
- **Each sessionId has isolated credentials** (user's Google tokens)
- **AsyncLocalStorage context** ensures thread-safe credential access
- **Tool calls execute with user's own credentials** (not shared)

### Session Storage

```
sessionMap[sessionId] = {
  status: "authenticated",
  tokens: {
    access_token: "...",      // User's Google access token
    refresh_token: "...",     // For token refresh
    expiry_date: "..."        // Token expiration
  },
  createdAt: timestamp,
  authMethod: "oauth"
}

userAuthMap[sessionId] = OAuth2Client  // Configured with user's tokens
```

### Tool Execution

```javascript
// When tool is called:
1. Extract sessionId from request context (AsyncLocalStorage)
2. Get user's OAuth2Client with their tokens
3. Execute tool using user's credentials
4. Result contains user's Google Workspace data
```

## Available Tools

**52 Google Workspace Tools:**

- **Google Docs** (8 tools): Create, read, edit, format documents
- **Google Sheets** (12 tools): Create, read, edit, format spreadsheets
- **Google Drive** (8 tools): List, search, manage files and folders
- **Gmail** (6 tools): Send, receive, manage email messages
- **Apps Script** (5 tools): Create, deploy, execute scripts
- **Section Management** (7 tools): Manage document sections
- **Media Tools** (6 tools): Embed media in documents

**Each tool request includes:**
- User's sessionId (for context)
- OAuth-authenticated credentials
- User's Google account access

## Error Handling

### Authentication Errors

```json
{
  "error": "Invalid session",
  "message": "Session not found or expired",
  "resolution": "Authenticate again at /auth/login"
}
```

### Expired Sessions

- Sessions don't explicitly expire
- Refresh tokens allow long-term access
- If access token expires, server automatically refreshes using refresh token

### Tool Execution Errors

```json
{
  "error": "Authentication required",
  "message": "Please login first",
  "session_expired": true
}
```

## Troubleshooting

### Problem: "Session not found"
- **Cause:** sessionId is invalid or expired
- **Solution:** Authenticate again at `/auth/login`

### Problem: "Missing authorization code"
- **Cause:** POST /auth/token called without code
- **Solution:** User must complete OAuth flow at `/auth/login` first

### Problem: Tools return "Permission denied"
- **Cause:** User hasn't granted access to specific Google Workspace API
- **Solution:** Re-authenticate and grant full access to Drive, Docs, Sheets, Gmail, Apps Script

## Configuration for Your MCP Server

**Environment Variables:**

```bash
GOOGLE_OAUTH_CLIENT_ID=your_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
REDIRECT_URI=https://docmcp.acc.l-inc.co.za/auth/callback
CORS_ORIGIN=https://docmcp.acc.l-inc.co.za
```

**Or via Coolify:**
- Set in application environment variables
- Server auto-detects from Coolify deployment

## API Response Examples

### Successful OAuth Callback

```json
{
  "success": true,
  "message": "Authentication successful! You can now use the MCP server.",
  "sessionId": "78b58faf56dbb3c2bfc7683a887dad85",
  "user": {
    "email": "user@example.com",
    "expiry_date": 1709041234,
    "token_type": "Bearer",
    "scope": "drive documents spreadsheets script.projects gmail.modify"
  }
}
```

### Successful Token Exchange

```json
{
  "success": true,
  "message": "OAuth authentication successful",
  "sessionId": "unique_session_id_here",
  "sse_endpoint": "/sse/unique_session_id_here",
  "message_endpoint": "/message",
  "credentials": {
    "access_token": "ya29.a0...",
    "refresh_token": "1//0gx...",
    "expiry_date": 1709041234,
    "token_type": "Bearer"
  }
}
```

## Summary

✅ **Each user authenticates with Google OAuth**
✅ **Each sessionId is isolated with unique credentials**
✅ **Tools execute using user's own Google Workspace access**
✅ **Browser users: One-click OAuth login**
✅ **External clients: OAuth code exchange for programmatic access**
✅ **All connections are OAuth-authenticated (no bearer tokens)**
