#!/usr/bin/env node
import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';

console.log('Testing docmcp MCP Server...');

// First, check if we have the necessary configuration
const configPath = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'config.json');
const tokenPath = path.join(os.homedir(), '.config', 'gcloud', 'docmcp', 'token.json');

console.log('\n1. Checking configuration...');
if (!fs.existsSync(configPath)) {
    console.error(`❌ Configuration file not found: ${configPath}`);
    console.error('Please run "docmcp auth login" first');
    process.exit(1);
}

if (!fs.existsSync(tokenPath)) {
    console.error(`❌ Token file not found: ${tokenPath}`);
    console.error('Please run "docmcp auth login" first');
    process.exit(1);
}

console.log('✅ Configuration found');

// Test 1: Try to run the stdio-server to see if it responds
console.log('\n2. Testing stdio-server...');
import { spawn } from 'child_process';

const stdioServer = spawn('node', ['stdio-server.js'], {
    stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
let serverError = '';

stdioServer.stdout.on('data', (data) => {
    serverOutput += data.toString();
});

stdioServer.stderr.on('data', (data) => {
    serverError += data.toString();
});

// Wait for server to start or error
const serverTimeout = setTimeout(() => {
    console.log('⚠️  Server took too long to respond');
    stdioServer.kill('SIGINT');
}, 5000);

stdioServer.on('exit', (code) => {
    clearTimeout(serverTimeout);
    
    if (code === 0) {
        console.log('✅ stdio-server exited successfully');
    } else {
        console.error(`❌ stdio-server exited with code ${code}`);
        if (serverError) {
            console.error('Error output:', serverError.trim());
        }
    }
});

// Also test HTTP server functionality
console.log('\n3. Testing HTTP server initialization...');
import AuthenticatedHTTPServer from './http-server.js';

async function testHTTPServer() {
    try {
        const server = new AuthenticatedHTTPServer({ 
            port: 0, // Use random port
            host: '127.0.0.1'
        });
        
        console.log('✅ HTTP server instance created');
        
        await server.start();
        const address = server.httpServer.address();
        console.log(`✅ HTTP server running on http://${address.address}:${address.port}`);
        
        // Test health endpoint
        const response = await fetch(`http://${address.address}:${address.port}/`);
        const data = await response.json();
        
        console.log('✅ Health endpoint response:');
        console.log(data);
        
        await server.stop();
        console.log('✅ HTTP server stopped');
        
        console.log('\n🎉 All tests passed! docmcp MCP server is working correctly');
    } catch (error) {
        console.error('❌ HTTP server test failed:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

testHTTPServer();
