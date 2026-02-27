#!/usr/bin/env node
/**
 * Browser Automation Tool
 * Launches Chrome directly without Playwright daemon issues
 */

import { spawn } from 'child_process';
import { homedir } from 'os';
import path from 'path';
import fs from 'fs';

const command = process.argv[2] || 'help';
const arg1 = process.argv[3] || '';
const PROFILE_DIR = path.join(process.cwd(), '.chrome-profile');

function ensureProfileDir() {
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }
}

async function launchChrome(url = 'https://docmcp.acc.l-inc.co.za') {
  ensureProfileDir();

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  if (!fs.existsSync(chromePath)) {
    console.error('❌ Chrome not found at:', chromePath);
    process.exit(1);
  }

  console.log(`🌐 Launching Chrome...`);
  console.log(`📄 Opening URL: ${url}`);

  const chrome = spawn(chromePath, [
    '--new-window',
    `--user-data-dir=${PROFILE_DIR}`,
    '--remote-debugging-port=9222',
    url
  ], {
    detached: true,
    stdio: 'ignore',
    shell: false
  });

  chrome.unref();

  console.log('✅ Browser launched successfully!');
  console.log(`\n💡 Chrome is running. You can see it on your screen.`);
  console.log(`📌 Remote debugging available on: http://localhost:9222\n`);
}

function showHelp() {
  console.log(`
Browser Automation Tool

Usage: browser-auto.js <command> [args]

Commands:
  open [URL]              Launch Chrome with URL
                         (default: https://docmcp.acc.l-inc.co.za)
  help                    Show this help message

Examples:
  node browser-auto.js open
  node browser-auto.js open https://example.com

Features:
  ✓ No daemon required
  ✓ Real Chrome browser launched
  ✓ Remote debugging enabled on port 9222
  ✓ Profile saved for reuse
  `);
}

async function main() {
  try {
    switch (command) {
      case 'open':
      case 'goto':
      case 'navigate':
        await launchChrome(arg1 || 'https://docmcp.acc.l-inc.co.za');
        break;
      case 'help':
      case '-h':
      case '--help':
        showHelp();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
