#!/usr/bin/env node
/**
 * Test and Configure Google Cloud OAuth with agent-browser
 * Opens Chrome and navigates through OAuth configuration
 */

import { spawn } from 'child_process';

async function runAgentBrowserCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn('agent-browser', [command, ...args], {
      cwd: '/c/dev/docmcp',
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  console.log('🚀 Starting Google Cloud OAuth Configuration Test\n');
  console.log('Step 1: Navigate to Google Cloud Console');
  console.log('========================================\n');

  try {
    // Open the Google Cloud Console credentials page
    console.log('📍 Opening Google Cloud Console...');
    const output = await runAgentBrowserCommand('open', [
      'https://console.cloud.google.com/apis/credentials'
    ]);

    console.log('✅ Page loaded successfully\n');

    // Take a screenshot
    console.log('Step 2: Capture Current State');
    console.log('=============================\n');
    console.log('📸 Taking screenshot...');
    await runAgentBrowserCommand('screenshot', ['gcp-oauth-test.png']);
    console.log('✅ Screenshot saved: gcp-oauth-test.png\n');

    // Get page snapshot
    console.log('Step 3: Analyze Page Content');
    console.log('============================\n');
    console.log('📋 Getting page structure...');
    const snapshot = await runAgentBrowserCommand('snapshot', ['-i']);

    console.log('\n📄 Interactive Elements Found:');
    console.log(snapshot);

    // Check for OAuth credentials
    if (snapshot.includes('OAuth') || snapshot.includes('Client ID')) {
      console.log('\n✅ OAuth 2.0 credentials section detected\n');
    } else {
      console.log('\n⚠️  OAuth section not immediately visible\n');
    }

    console.log('Step 4: Instructions');
    console.log('===================\n');
    console.log('✅ Google Cloud Console is now open in agent-browser\n');
    console.log('📝 Manual Configuration Steps:');
    console.log('  1. Find "OAuth 2.0 Client ID" credential (e.g., "docmcp-web-app")');
    console.log('  2. Click on it to open the configuration');
    console.log('  3. In "Authorized redirect URIs", add:');
    console.log('     - https://docmcp.acc.l-inc.co.za/auth/callback');
    console.log('     - http://localhost:3000/auth/callback (optional)');
    console.log('  4. Click SAVE\n');
    console.log('💡 For automation, you can provide element references from the snapshot above\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
