#!/usr/bin/env node
/**
 * Claude Code MCP Configuration Setup
 * Captures OAuth sessionId and creates MCP config
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForSessionId(port = 4444) {
  console.log('\n⏳ Waiting for OAuth callback...');
  console.log('💡 Complete the Google login in the browser window\n');

  // Check the server logs for sessionId
  // In a real scenario, we'd poll /status or use a webhook

  // For now, provide manual instructions
  console.log('📝 Manual Steps:');
  console.log('1. Complete Google OAuth in the browser');
  console.log('2. You will receive a sessionId in the callback URL');
  console.log('3. Copy the sessionId from the URL or callback response');
  console.log('4. Paste it below\n');

  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('🔑 Paste your sessionId here: ', (sessionId) => {
      rl.close();
      resolve(sessionId.trim());
    });
  });
}

function createClaudeCodeConfig(sessionId, port = 4444) {
  const config = {
    mcpServers: {
      docmcp: {
        command: 'sse',
        url: `http://127.0.0.1:${port}/sse/${sessionId}`,
        headers: {
          'X-Session-Id': sessionId
        },
        transport: 'sse',
        env: {
          'DOCMCP_SESSION_ID': sessionId
        }
      }
    }
  };

  return config;
}

function getClaudeCodeConfigPath() {
  const platform = os.platform();

  if (platform === 'darwin') {
    // macOS
    return path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  } else if (platform === 'win32') {
    // Windows
    return path.join(os.homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json');
  } else if (platform === 'linux') {
    // Linux
    return path.join(os.homedir(), '.config/Claude/claude_desktop_config.json');
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

async function saveConfig(config, configPath) {
  // Create directory if it doesn't exist
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Read existing config if present
  let existingConfig = {};
  if (fs.existsSync(configPath)) {
    existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  // Merge with new config
  const mergedConfig = {
    ...existingConfig,
    mcpServers: {
      ...existingConfig.mcpServers,
      ...config.mcpServers
    }
  };

  // Write config
  fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
  console.log(`\n✅ Configuration saved to: ${configPath}`);
}

async function main() {
  try {
    console.log('\n🚀 Claude Code MCP Configuration Setup');
    console.log('=====================================\n');

    console.log('📊 Server Information:');
    console.log('  Server: http://127.0.0.1:4444');
    console.log('  Transport: SSE (Server-Sent Events)');
    console.log('  Tools: 52 Google Workspace operations');
    console.log('  Auth: OAuth 2.0 per-user\n');

    // Wait for sessionId
    const sessionId = await waitForSessionId(4444);

    if (!sessionId || sessionId.length < 16) {
      console.error('\n❌ Invalid sessionId format');
      process.exit(1);
    }

    console.log(`\n✅ SessionId captured: ${sessionId}`);

    // Create config
    console.log('\n📝 Creating Claude Code configuration...');
    const config = createClaudeCodeConfig(sessionId, 4444);

    // Get config path
    const configPath = getClaudeCodeConfigPath();
    console.log(`📁 Configuration path: ${configPath}`);

    // Save config
    await saveConfig(config, configPath);

    // Show next steps
    console.log('\n✅ Setup Complete!\n');
    console.log('📋 Next Steps:');
    console.log('1. Restart Claude Code application');
    console.log('2. The "docmcp" MCP server will be available');
    console.log('3. Use @docmcp in prompts to access Google Workspace tools');
    console.log('4. All operations use your authenticated Google account\n');

    console.log('📚 Available Tools:');
    console.log('  - Google Docs (create, read, edit, format)');
    console.log('  - Google Sheets (create, read, edit, format)');
    console.log('  - Google Drive (list, search, manage)');
    console.log('  - Gmail (send, receive, manage)');
    console.log('  - Apps Script (create, deploy, execute)\n');

    console.log('💡 Example Usage in Claude Code:');
    console.log('  "Create a Google Doc with the title \'Project Notes\' and add some content"');
    console.log('  "List all files in my Google Drive"');
    console.log('  "Send an email to user@example.com with subject \'Hello\'"');
    console.log('  "Create a Google Sheet and populate it with data"\n');

    // Save configuration to local file for reference
    const localConfigPath = path.join(__dirname, '.claude-code-config.json');
    fs.writeFileSync(localConfigPath, JSON.stringify(config, null, 2));
    console.log(`📄 Configuration also saved locally to: ${localConfigPath}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
