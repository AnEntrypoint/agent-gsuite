import http from 'http';
import https from 'https';

async function getSessionId() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'docmcp.acc.l-inc.co.za',
      port: 443,
      path: '/auth/login',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Extract sessionId from the HTML response
        const match = data.match(/sessionId.*?<code>([^<]+)<\/code>/);
        if (match && match[1]) {
          console.log('Session ID found:', match[1]);
          resolve(match[1]);
        } else {
          reject(new Error('Session ID not found in response'));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

async function testSession(sessionId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'docmcp.acc.l-inc.co.za',
      port: 443,
      path: `/mcp?sessionId=${sessionId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('Test response:', result);
          resolve(result);
        } catch (err) {
          console.log('Response not JSON:', data);
          resolve(data);
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.end();
  });
}

async function main() {
  try {
    console.log('Creating new session...');
    const sessionId = await getSessionId();
    
    console.log('\nTesting session...');
    const response = await testSession(sessionId);
    
    console.log('\n✅ Session created and tested successfully!');
    console.log('Session ID:', sessionId);
    console.log('MCP Endpoint:', `https://docmcp.acc.l-inc.co.za/mcp?sessionId=${sessionId}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

main();
