#!/usr/bin/env node
/**
 * Claude Code MCP Configuration for Production
 * Connects to docmcp.acc.l-inc.co.za with OAuth authentication
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createClaudeCodeConfig(sessionId) {
  const config = {
    mcpServers: {
      docmcp: {
        command: 'sse',
        url: `https://docmcp.acc.l-inc.co.za/sse/${sessionId}`,
        headers: {
          'X-Session-Id': sessionId,
          'Content-Type': 'application/json'
        },
        transport: 'sse',
        env: {
          'DOCMCP_SESSION_ID': sessionId,
          'DOCMCP_SERVER': 'https://docmcp.acc.l-inc.co.za'
        }
      }
    }
  };

  return config;
}

function getClaudeCodeConfigPath() {
  const platform = os.platform();

  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  } else if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json');
  } else if (platform === 'linux') {
    return path.join(os.homedir(), '.config/Claude/claude_desktop_config.json');
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

async function saveConfig(config, configPath) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existingConfig = {};
  if (fs.existsSync(configPath)) {
    existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  const mergedConfig = {
    ...existingConfig,
    mcpServers: {
      ...existingConfig.mcpServers,
      ...config.mcpServers
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
  return configPath;
}

function askQuestion(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  try {
    console.log('\n🚀 Claude Code MCP Setup - Production Server');
    console.log('==========================================\n');

    console.log('📊 Production Server Information:');
    console.log('  Server: https://docmcp.acc.l-inc.co.za');
    console.log('  Transport: SSE (Server-Sent Events)');
    console.log('  Tools: 52 Google Workspace operations');
    console.log('  Auth: OAuth 2.0 per-user authentication');
    console.log('  Deployment: Auto-deploys on git push\n');

    console.log('🔐 Authentication Flow:');
    console.log('  1. You will authenticate with your Google account');
    console.log('  2. Receive a sessionId for secure access');
    console.log('  3. Claude Code connects using your authenticated session');
    console.log('  4. All operations use YOUR Google credentials\n');

    // Get sessionId from user
    const sessionId = await askQuestion('🔑 Enter your sessionId (from auth/callback): ');

    if (!sessionId || sessionId.length < 16) {
      console.error('\n❌ Invalid sessionId - must be at least 16 characters');
      console.error('💡 Get a sessionId by visiting: https://docmcp.acc.l-inc.co.za/auth/login\n');
      process.exit(1);
    }

    console.log(`\n✅ SessionId captured: ${sessionId}`);

    // Create config
    console.log('\n📝 Creating Claude Code configuration...');
    const config = createClaudeCodeConfig(sessionId);

    // Get config path
    const configPath = getClaudeCodeConfigPath();
    console.log(`📁 Configuration will be saved to: ${configPath}`);

    // Ask for confirmation
    const confirm = await askQuestion('\nProceed with configuration? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Configuration cancelled.');
      process.exit(1);
    }

    // Save config
    const savedPath = await saveConfig(config, configPath);

    // Show success
    console.log(`\n✅ Configuration saved successfully!\n`);

    console.log('📋 Next Steps:');
    console.log('  1. Restart Claude Code application');
    console.log('  2. The "docmcp" MCP server will be available');
    console.log('  3. Use @docmcp in prompts to access tools');
    console.log('  4. All operations authenticate with your Google account\n');

    console.log('📚 Available Google Workspace Tools:');
    console.log('  ✓ Google Docs (create, read, edit, format, manage sections)');
    console.log('  ✓ Google Sheets (create, read, edit, format, manage tabs)');
    console.log('  ✓ Google Drive (list, search, copy, move, share files)');
    console.log('  ✓ Gmail (send, receive, manage, search messages)');
    console.log('  ✓ Apps Script (create, deploy, execute projects)\n');

    console.log('💬 Example Prompts in Claude Code:');
    console.log('  • "Create a Google Doc with my project roadmap"');
    console.log('  • "List all PDFs in my Google Drive from 2024"');
    console.log('  • "Send an email to my team with today\'s summary"');
    console.log('  • "Create a Google Sheet and add expense data to it"');
    console.log('  • "Find all emails from my boss from the last week"\n');

    // Save reference config
    const localConfigPath = path.join(__dirname, '.claude-code-prod-config.json');
    fs.writeFileSync(localConfigPath, JSON.stringify(config, null, 2));
    console.log(`📄 Reference copy saved to: ${localConfigPath}\n`);

    console.log('🎉 Claude Code is ready to use docmcp!');
    console.log('🔒 Your Google credentials are secure - stored only in your authenticated session\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
