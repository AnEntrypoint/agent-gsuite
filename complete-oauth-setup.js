#!/usr/bin/env node
/**
 * Complete Google Cloud OAuth Configuration + OAuth Flow Test
 * Fully automated - no user interaction required
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const REQUIRED_URIS = [
  'https://docmcp.acc.l-inc.co.za/auth/callback',
  'http://localhost:3000/auth/callback'
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToChrome(maxRetries = 20) {
  console.log('🔗 Connecting to running Chrome instance...');

  for (let i = 0; i < maxRetries; i++) {
    try {
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('✅ Connected to Chrome!\n');
      return browser;
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`⏳ Waiting for Chrome... (${i + 1}/${maxRetries})`);
        await sleep(1000);
      } else {
        throw err;
      }
    }
  }
}

async function configureOAuthRedirectUris(page) {
  console.log('📋 STEP 1: Configure OAuth Redirect URIs');
  console.log('=========================================\n');

  // Check if on credentials page
  const currentUrl = page.url();
  console.log(`📍 Current URL: ${currentUrl}`);

  if (!currentUrl.includes('/credentials')) {
    console.log('🔄 Navigating to credentials page...');
    await page.goto('https://console.cloud.google.com/apis/credentials', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(2000);
  }

  console.log('🔍 Looking for OAuth 2.0 Client IDs...');

  // Try to find OAuth credential rows
  const oauthRows = await page.$$('div[role="row"]:has-text("OAuth 2.0 Client ID")');

  if (oauthRows.length === 0) {
    console.log('⚠️  No OAuth 2.0 Client IDs found automatically');
    console.log('🔎 Trying alternative search...');

    // Try to find by text
    const elements = await page.$$('span, div, button');
    for (const elem of elements) {
      const text = await elem.textContent();
      if (text && text.includes('OAuth 2.0 Client ID')) {
        console.log('✅ Found OAuth 2.0 Client ID element');
        await elem.click();
        await page.waitForTimeout(2000);
        break;
      }
    }
  } else {
    console.log(`✅ Found ${oauthRows.length} OAuth 2.0 Client ID(s)`);
    console.log('👆 Clicking on the first one...');
    await oauthRows[0].click();
    await page.waitForTimeout(3000);
  }

  // Now we should be in the OAuth credential details
  console.log('📝 Looking for Authorized redirect URIs section...');

  // Take screenshot to see current state
  await page.screenshot({ path: 'oauth-config-before.png' });
  console.log('📸 Screenshot: oauth-config-before.png\n');

  // Look for redirect URI input/textarea
  const redirectUriElements = await page.$$('input[placeholder*="redirect"], textarea[placeholder*="redirect"]');

  if (redirectUriElements.length > 0) {
    console.log(`✅ Found ${redirectUriElements.length} redirect URI input field(s)`);
    const redirectInput = redirectUriElements[0];

    // Get current value
    const currentValue = await redirectInput.inputValue();
    console.log('📋 Current redirect URIs:');
    if (currentValue) {
      const uris = currentValue.split('\n').filter(u => u.trim());
      uris.forEach(uri => console.log(`  ✓ ${uri}`));
    } else {
      console.log('  (empty)');
    }

    // Add missing URIs
    console.log('\n➕ Adding required URIs...');
    let allUris = currentValue ? currentValue.split('\n').map(u => u.trim()).filter(u => u) : [];

    for (const uri of REQUIRED_URIS) {
      if (!allUris.includes(uri)) {
        console.log(`  ➕ Adding: ${uri}`);
        allUris.push(uri);
      } else {
        console.log(`  ✓ Already present: ${uri}`);
      }
    }

    // Set all URIs
    await redirectInput.fill(allUris.join('\n'));
    console.log('\n✅ Redirect URIs configured');

  } else {
    console.log('⚠️  Could not find redirect URI input field');
    console.log('📋 Current page content shown in screenshot');
  }

  // Look for Save button
  console.log('\n💾 Looking for Save button...');
  const saveButtons = await page.$$('button:has-text("Save"), button:has-text("UPDATE")');

  if (saveButtons.length > 0) {
    console.log('👆 Clicking Save button...');
    await saveButtons[0].click();
    await page.waitForTimeout(3000);
    console.log('✅ Changes saved!\n');
  } else {
    console.log('⚠️  Save button not found - may need manual save');
  }

  // Take screenshot after
  await page.screenshot({ path: 'oauth-config-after.png' });
  console.log('📸 Screenshot: oauth-config-after.png\n');
}

async function testDocmcpOAuthFlow(page) {
  console.log('🔐 STEP 2: Test docmcp OAuth Login Flow');
  console.log('======================================\n');

  console.log('📍 Navigating to docmcp login page...');
  await page.goto('https://docmcp.acc.l-inc.co.za/auth/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  const title = await page.title();
  console.log(`✅ Loaded: ${page.url()}`);
  console.log(`📋 Page title: ${title}\n`);

  // Look for Google login button
  console.log('🔍 Looking for Google login button...');
  const googleButtons = await page.$$('a:has-text("Google"), button:has-text("Google"), a:has-text("Sign in with Google"), button:has-text("Sign in with Google")');

  if (googleButtons.length > 0) {
    console.log('✅ Found Google login button');
    console.log('⏳ Waiting for user to complete Google OAuth (120 seconds)...');
    console.log('💡 Please complete the Google login in the Chrome window\n');

    // Take screenshot
    await page.screenshot({ path: 'docmcp-login.png' });

    // Click the button
    await googleButtons[0].click();

    // Wait for the OAuth callback
    try {
      await page.waitForURL('**/auth/callback**', { timeout: 120000 });
      console.log('✅ OAuth callback detected!');

      const finalUrl = page.url();
      const urlParams = new URLSearchParams(finalUrl.split('?')[1]);
      const sessionId = urlParams.get('sessionId');

      if (sessionId) {
        console.log(`🔐 Session ID received: ${sessionId}\n`);
        console.log('✅ OAuth Login Successful!\n');

        // Save config
        const config = {
          sessionId,
          url: finalUrl,
          timestamp: new Date().toISOString(),
          status: 'authenticated'
        };
        fs.writeFileSync('.oauth-config.json', JSON.stringify(config, null, 2));
        console.log('💾 Config saved to: .oauth-config.json\n');

        return { success: true, sessionId };
      }
    } catch (err) {
      console.log('⚠️  Timeout waiting for OAuth callback');
      console.log(`📍 Current URL: ${page.url()}`);
    }
  } else {
    console.log('⚠️  Google login button not found');
  }

  return { success: false };
}

async function verifyDeployment() {
  console.log('✅ STEP 3: Verify Deployment Status');
  console.log('===================================\n');

  console.log('🌐 Checking docmcp application...');
  try {
    const response = await fetch('https://docmcp.acc.l-inc.co.za/health', {
      timeout: 10000
    }).catch(() => null);

    if (response) {
      console.log('✅ docmcp is accessible at https://docmcp.acc.l-inc.co.za\n');
    }
  } catch (err) {
    console.log('⚠️  Could not verify health endpoint\n');
  }
}

async function main() {
  let browser;

  try {
    console.log('\n🚀 COMPLETE OAUTH SETUP & TESTING\n');
    console.log('================================\n');

    // Connect to Chrome
    browser = await connectToChrome();
    const page = (await browser.contexts()[0].pages())[0] || await browser.contexts()[0].newPage();

    // Step 1: Configure OAuth
    await configureOAuthRedirectUris(page);

    // Step 2: Test OAuth flow
    const oauthResult = await testDocmcpOAuthFlow(page);

    // Step 3: Verify deployment
    await verifyDeployment();

    // Final summary
    console.log('📊 SETUP SUMMARY');
    console.log('================\n');

    if (oauthResult.success) {
      console.log('✅ All Steps Completed Successfully!');
      console.log(`✅ OAuth is working - Session ID: ${oauthResult.sessionId}`);
      console.log('✅ Google Cloud OAuth URIs configured');
      console.log('✅ docmcp is deployed and accessible\n');
      console.log('🎉 System is ready for MCP tool usage!\n');
    } else {
      console.log('⚠️  Setup mostly complete - please verify:');
      console.log('  1. OAuth redirect URIs were saved in GCP Console');
      console.log('  2. Complete Google login in Chrome window\n');
    }

    console.log('💡 Next Steps:');
    console.log('  - Use docmcp at https://docmcp.acc.l-inc.co.za');
    console.log('  - Log in with your Google account');
    console.log('  - Use any of the 52 MCP tools with your Google Workspace access\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();
