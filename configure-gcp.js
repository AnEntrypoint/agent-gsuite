#!/usr/bin/env node
/**
 * Configure Google Cloud OAuth redirect URIs
 * Connects to running Chrome and automates the GCP configuration
 */

import { chromium } from 'playwright';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToChrome() {
  console.log('🔗 Connecting to Chrome via CDP...');

  for (let i = 0; i < 15; i++) {
    try {
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('✅ Connected to Chrome!\n');
      return browser;
    } catch (err) {
      if (i < 14) {
        console.log(`⏳ Waiting for Chrome... (${i + 1}/15)`);
        await sleep(1000);
      } else {
        throw err;
      }
    }
  }
}

async function configureGCP() {
  let browser;

  try {
    browser = await connectToChrome();

    // Get or create page
    const context = browser.contexts()[0];
    let page = context.pages()[0];

    if (!page) {
      page = await context.newPage();
    }

    console.log('📍 Navigating to Google Cloud Console...\n');
    await page.goto('https://console.cloud.google.com/apis/credentials', {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    });

    // Wait for page to load and show content
    await page.waitForTimeout(3000);

    console.log('✅ Google Cloud Console loaded');
    console.log(`📍 Current URL: ${page.url()}\n`);

    // Check if we need to login
    const loginButton = await page.$('button:has-text("Sign in")');
    if (loginButton) {
      console.log('⚠️  Google Cloud Console requires login');
      console.log('📝 Please sign in with your Google account in the Chrome window');
      console.log('⏳ Waiting for login...\n');

      try {
        await page.waitForURL('**/credentials', { timeout: 120000 });
        console.log('✅ Login successful!\n');
      } catch (err) {
        console.log('⏰ Login timeout. Please log in manually and refresh.');
        process.exit(1);
      }
    }

    // Wait for page to fully load
    await page.waitForTimeout(2000);

    // Look for OAuth 2.0 Client IDs
    console.log('🔍 Looking for OAuth 2.0 Client ID credentials...\n');

    // Try to find and click on an OAuth credential
    const oauthCredentials = await page.$$('div:has-text("OAuth 2.0 Client ID")');

    if (oauthCredentials.length > 0) {
      console.log(`✅ Found ${oauthCredentials.length} OAuth 2.0 Client ID(s)`);
      console.log('📌 Clicking on the first one to configure...\n');

      // Click on the first OAuth credential
      await oauthCredentials[0].click();
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️  No OAuth 2.0 Client IDs found');
      console.log('📝 You may need to create one manually');
      console.log('🔗 Or check that you\'re viewing the correct project\n');
    }

    // Take a screenshot of the current state
    const screenshotPath = 'gcp-config-screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Screenshot saved: ${screenshotPath}\n`);

    // Look for the redirect URIs section
    console.log('🔎 Checking for Authorized redirect URIs section...\n');

    const redirectUrisText = await page.evaluate(() => {
      return document.body.innerText;
    });

    if (redirectUrisText.includes('Authorized redirect URIs') || redirectUrisText.includes('redirect')) {
      console.log('✅ Found redirect URIs section');
      console.log('\n📋 Required redirect URIs:');
      console.log('  1. https://docmcp.acc.l-inc.co.za/auth/callback (PRODUCTION)');
      console.log('  2. http://localhost:3000/auth/callback (DEVELOPMENT)\n');

      console.log('📝 Instructions:');
      console.log('  1. Look for "Authorized redirect URIs" field');
      console.log('  2. Add the URIs listed above (if not already present)');
      console.log('  3. Click "SAVE" to apply changes\n');
    }

    console.log('💡 The Chrome window is still open for you to complete the configuration manually');
    console.log('✋ When done, close this script with Ctrl+C\n');

    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET')) {
      console.error('💡 Chrome may have closed. Please relaunch with: browser-auto open https://console.cloud.google.com/apis/credentials');
    }
    process.exit(1);
  }
}

configureGCP().catch(console.error);
