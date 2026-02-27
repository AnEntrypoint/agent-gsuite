#!/usr/bin/env node
/**
 * OAuth Login Test
 * Connects to running Chrome via CDP and tests the Google OAuth flow
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), '.oauth-test.json');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToChrome() {
  console.log('🔗 Connecting to Chrome via remote debugging...');

  // Try to connect to the running Chrome instance
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('✅ Connected to Chrome successfully!');
      return browser;
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`⏳ Waiting for Chrome... (${i + 1}/${maxRetries})`);
        await sleep(500);
      } else {
        throw err;
      }
    }
  }
}

async function testOAuthFlow() {
  let browser;

  try {
    // Connect to Chrome
    browser = await connectToChrome();

    // Get the first page or create new one
    const pages = browser.contexts()[0]?.pages() || [];
    const page = pages[0] || await browser.contexts()[0].newPage();

    console.log('\n📄 Testing OAuth Login Flow...\n');

    // Navigate to login page
    console.log('1️⃣  Navigating to login page...');
    await page.goto('https://docmcp.acc.l-inc.co.za/auth/login', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log(`✅ Loaded: ${page.url()}`);
    const title = await page.title();
    console.log(`📋 Page title: ${title}`);

    // Check for login button
    console.log('\n2️⃣  Checking for Google login button...');
    const loginButton = await page.$('a[href*="accounts.google.com"], button:has-text("Google"), a:has-text("Sign in with Google")');

    if (loginButton) {
      console.log('✅ Found Google login button');
      console.log('📌 You can now click the Google login button to complete OAuth flow');
      console.log('🔑 After login, the page should redirect to /auth/callback with your session');
    } else {
      console.log('⚠️  Could not find Google login button');
      console.log('📸 Taking screenshot to see current page state...');
      await page.screenshot({ path: 'oauth-test-screenshot.png', fullPage: true });
      console.log('Screenshot saved to: oauth-test-screenshot.png');
    }

    // Wait for user to complete login
    console.log('\n⏳ Waiting for authentication...');
    console.log('💡 Please complete the Google OAuth login in the Chrome window');
    console.log('✋ This script will wait for redirect to /auth/callback (timeout: 5 minutes)\n');

    try {
      await page.waitForURL('**/auth/callback/**', { timeout: 300000 });
      console.log('✅ OAuth callback detected!');

      const finalUrl = page.url();
      console.log(`📍 Final URL: ${finalUrl}`);

      // Extract session ID if present
      const urlParams = new URL(finalUrl).searchParams;
      const sessionId = urlParams.get('sessionId');

      if (sessionId) {
        console.log(`🔐 Session ID: ${sessionId}`);
        console.log('\n✅ OAuth Login Successful!');

        // Save config
        const config = { sessionId, url: finalUrl, timestamp: new Date().toISOString() };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log(`📁 Config saved to: ${CONFIG_FILE}`);
      } else {
        console.log('⚠️  No session ID found in callback');
      }
    } catch (err) {
      console.log('⏰ Timeout waiting for callback');
      console.log('Current URL:', page.url());
    }

    console.log('\n💾 Browser is still open. You can continue testing from here.');
    console.log('Press Ctrl+C to close when done.\n');

    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the test
testOAuthFlow().catch(console.error);
