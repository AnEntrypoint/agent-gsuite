#!/usr/bin/env node
import { createServer } from 'http';

console.log('Testing remote docmcp MCP Server...');

// Test 1: Check if server responds
console.log('\n1. Checking main endpoint...');
try {
    const response = await fetch('https://docmcp.acc.l-inc.co.za');
    const data = await response.json();
    console.log('✅ Server is running');
    console.log('   Status:', data.status);
    console.log('   Version:', data.version);
    console.log('   Service:', data.service);
    console.log('   Endpoints:', Object.keys(data.endpoints));
    console.log('   Active Sessions:', data.activeSessions);
    console.log('   Active Connections:', data.activeConnections);
} catch (err) {
    console.error('❌ Failed to connect:', err.message);
    process.exit(1);
}

// Test 2: Check SSE endpoint structure
console.log('\n2. Checking SSE endpoint...');
try {
    const sessionId = 'test-session-' + Math.random().toString(36).substr(2, 9);
    const response = await fetch(`https://docmcp.acc.l-inc.co.za/sse/${sessionId}`);
    console.log('✅ SSE endpoint responds');
    console.log('   Status:', response.status);
    console.log('   Content-Type:', response.headers.get('content-type'));
} catch (err) {
    console.error('❌ SSE endpoint test failed:', err.message);
}

// Test 3: Check if we can send a message
console.log('\n3. Testing message endpoint...');
try {
    const sessionId = 'test-session-' + Math.random().toString(36).substr(2, 9);
    const response = await fetch('https://docmcp.acc.l-inc.co.za/message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': sessionId
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'test',
            method: 'mcp/listTools'
        })
    });
    
    const data = await response.json();
    console.log('✅ Message endpoint responds');
    console.log('   Status:', response.status);
    console.log('   Response:', JSON.stringify(data, null, 2));
} catch (err) {
    console.error('❌ Message endpoint test failed:', err.message);
    if (err.stack) console.error(err.stack);
}

console.log('\n🎉 All basic tests completed!');
