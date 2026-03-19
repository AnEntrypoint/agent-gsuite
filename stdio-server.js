#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getAuth, withAuth } from './auth.js';
import { buildMcpServer } from './mcp-server.js';

const server = buildMcpServer(() => withAuth(() => getAuth()));
const transport = new StdioServerTransport();
await server.connect(transport);
