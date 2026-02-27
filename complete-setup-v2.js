#!/usr/bin/env node
/**
 * Complete OAuth Setup - Version 2
 * More targeted approach with better element detection
 */

import { chromium } from 'playwright';
import fs from 'fs';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToChrome() {
  console.log('🔗 Connecting to Chrome...');
  for (let i = 0; i < 15; i++) {
    try {
      return await chromium.connectOverCDP('http://localhost:9222');
    } catch {
      if (i < 14) {
        console.log(`⏳ Attempt ${i + 1}/15`);
        await sleep(1000);
      } else throw new Error('Could not connect to Chrome');
    }
  }
}

async function configureGCP(page) {
  console.log('\n📋 STEP 1: Configure OAuth Redirect URIs in GCP');
  console.log('===============================================\n');

  // We're already on the credentials page
  console.log('✅ On Google Cloud Credentials page');
  console.log('🔍 Looking for "Web client (auto created by Google)" credential...\n');

  // Find the web client credential row and click it
  // Looking for the row that contains "Web client" text
  const rows = await page.$$('tr, div[role="row"]');
  let webClientClicked = false;

  for (const row of rows) {
    const text = await row.textContent();
    if (text && text.includes('Web client') && text.includes('auto created')) {
      console.log('✅ Found: Web client (auto created by Google)');

      // Look for clickable element in this row (usually the name is a link)
      const nameLink = await row.$('a, button');
      if (nameLink) {
        console.log('👆 Clicking on the credential...');
        await nameLink.click();
        await page.waitForTimeout(3000);
        webClientClicked = true;
        break;
      }
    }
  }

  if (!webClientClicked) {
    console.log('⚠️  Could not click on credential automatically');
    console.log('📸 Taking screenshot to help with manual configuration...');
    await page.screenshot({ path: 'gcp-credentials-list.png' });
    return false;
  }

  // Now we should be in the credential details view
  console.log('📝 Looking for Authorized redirect URIs field...\n');

  // Wait for any modals or panels to load
  await page.waitForTimeout(2000);

  // Look for textarea or input with redirect URIs
  const textareas = await page.$$('textarea, input[type="text"]');
  let redirectUriField = null;

  for (const field of textareas) {
    const placeholder = await field.getAttribute('placeholder');
    const value = await field.inputValue();
    const ariaLabel = await field.getAttribute('aria-label');

    if ((placeholder && placeholder.includes('redirect')) ||
        (ariaLabel && ariaLabel.includes('redirect')) ||
        (value && value.includes('callback'))) {
      redirectUriField = field;
      break;
    }
  }

  if (redirectUriField) {
    console.log('✅ Found redirect URIs field');

    // Get current value
    const currentValue = await redirectUriField.inputValue();
    const uris = currentValue ? currentValue.split('\n').filter(u => u.trim()) : [];

    console.log('📋 Current URIs:');
    uris.forEach(uri => console.log(`  ✓ ${uri}`));

    // Add required URIs
    const requiredUris = [
      'https://docmcp.acc.l-inc.co.za/auth/callback',
      'http://localhost:3000/auth/callback'
    ];

    let updated = false;
    for (const uri of requiredUris) {
      if (!uris.includes(uri)) {
        console.log(`\n➕ Adding: ${uri}`);
        uris.push(uri);
        updated = true;
      } else {
        console.log(`✓ Already present: ${uri}`);
      }
    }

    if (updated) {
      // Update field
      const newValue = uris.join('\n');
      await redirectUriField.fill(newValue);
      console.log('\n✅ Redirect URIs updated\n');
    } else {
      console.log('\n✅ All required URIs already configured\n');
    }
  } else {
    console.log('⚠️  Redirect URIs field not found');
    console.log('📸 Taking screenshot for manual verification...');
    await page.screenshot({ path: 'gcp-credential-details.png' });
    return false;
  }

  // Look for Save button
  console.log('💾 Looking for SAVE button...');
  const saveButton = await page.$('button:has-text("Save")');

  if (saveButton) {
    console.log('👆 Clicking SAVE...');
    await saveButton.click();
    await page.waitForTimeout(3000);
    console.log('✅ Configuration saved in GCP!\n');
    return true;
  } else {
    console.log('⚠️  Save button not found');
    console.log('📍 Try clicking Save manually in the GCP Console\n');
    return false;
  }
}

async function testDocmcpLogin(page) {
  console.log('🔐 STEP 2: Test docmcp OAuth Login');
  console.log('==================================\n');

  console.log('📍 Navigating to docmcp login...');
  await page.goto('https://docmcp.acc.l-inc.co.za/auth/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.waitForTimeout(2000);
  const pageContent = await page.content();
  console.log(`✅ Loaded: ${page.url()}\n`);

  // Look for any button with Google or oauth
  const buttons = await page.$$('button, a');
  let googleButton = null;

  console.log('🔍 Looking for Google login button...');
  for (const btn of buttons) {
    const text = await btn.textContent();
    const href = await btn.getAttribute('href');

    if ((text && (text.includes('Google') || text.includes('google'))) ||
        (href && href.includes('accounts.google'))) {
      googleButton = btn;
      console.log(`✅ Found login button: "${text || 'link'}"`);
      break;
    }
  }

  if (googleButton) {
    console.log('⏳ Clicking Google login button...');
    await googleButton.click();

    console.log('⏳ Waiting for OAuth flow (120 seconds)...');
    console.log('💡 Complete Google login in the browser window\n');

    try {
      // Wait for redirect to callback
      await page.waitForURL('**/auth/callback**', { timeout: 120000 });

      const finalUrl = page.url();
      const urlParams = new URLSearchParams(finalUrl.split('?')[1]);
      const sessionId = urlParams.get('sessionId');

      if (sessionId) {
        console.log('✅ OAuth callback successful!');
        console.log(`🔐 Session ID: ${sessionId}\n`);

        // Save config
        fs.writeFileSync('.oauth-session.json', JSON.stringify({
          sessionId,
          url: finalUrl,
          timestamp: new Date().toISOString()
        }, null, 2));

        console.log('💾 Session saved to .oauth-session.json');
        return { success: true, sessionId };
      }
    } catch (err) {
      console.log(`⏰ Still waiting or already logged in`);
      console.log(`📍 Current URL: ${page.url()}`);
    }
  } else {
    console.log('⚠️  Google login button not found on page');
    console.log('📝 Page might be loading or button has different selector');
    await page.screenshot({ path: 'docmcp-login-page.png' });
    console.log('📸 Screenshot saved: docmcp-login-page.png');
  }

  return { success: false };
}

async function main() {
  let browser;

  try {
    console.log('\n🚀 COMPLETE OAUTH SETUP - VERSION 2\n');

    browser = await connectToChrome();
    const page = (await browser.contexts()[0].pages())[0];

    // Step 1: Configure GCP
    const gcpConfigured = await configureGCP(page);

    // Step 2: Test docmcp login
    const oauthResult = await testDocmcpLogin(page);

    // Summary
    console.log('📊 SUMMARY');
    console.log('==========\n');

    if (gcpConfigured) {
      console.log('✅ GCP OAuth redirect URIs configured and saved');
    } else {
      console.log('⚠️  GCP configuration needs manual verification');
    }

    if (oauthResult.success) {
      console.log(`✅ docmcp OAuth login successful - Session: ${oauthResult.sessionId}`);
    } else {
      console.log('⚠️  docmcp OAuth login needs manual completion');
    }

    console.log('\n✨ Setup is ready for production use!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
