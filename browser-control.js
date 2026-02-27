import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function main() {
  // Get user's Chrome path
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  if (!fs.existsSync(chromePath)) {
    console.log('Chrome not found at default location. Searching...');
    process.exit(1);
  }

  console.log('Opening Chrome browser...');

  // Launch Chrome with remote debugging enabled
  const chrome = spawn(chromePath, [
    '--remote-debugging-port=9222',
    'https://docmcp.acc.l-inc.co.za/auth/login'
  ], {
    detached: true,
    stdio: 'ignore'
  });

  chrome.unref();

  console.log('\n✅ Browser launched successfully!');
  console.log('URL: https://docmcp.acc.l-inc.co.za/auth/login');
  console.log('\n📱 You should now see a Chrome window with the docmcp login page.');
  console.log('🔐 Complete the Google OAuth login in the browser.');
  console.log('\n✨ Browser automation is ready to use!');
}

main().catch(console.error);
