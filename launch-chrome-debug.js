#!/usr/bin/env node
/**
 * Launch Chrome with remote debugging enabled
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PROFILE_DIR = path.join(process.cwd(), '.chrome-debug-profile');

async function launchChrome() {
  // Ensure profile directory exists
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  console.log('🚀 Launching Chrome with remote debugging...');
  console.log(`📁 Profile: ${PROFILE_DIR}`);
  console.log(`🔧 Debugging port: 9222\n`);

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--new-window',
      'https://docmcp.acc.l-inc.co.za/auth/login',
      '--remote-debugging-port=9222'
    ]
  });

  console.log('✅ Chrome launched successfully!');
  console.log('\n📋 Browser Info:');
  console.log('  - URL: https://docmcp.acc.l-inc.co.za/auth/login');
  console.log('  - Remote debugging: http://localhost:9222');
  console.log('\n💡 Browser will stay open. Press Ctrl+C to close.\n');

  // Keep process alive
  await new Promise(() => {});
}

launchChrome().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
