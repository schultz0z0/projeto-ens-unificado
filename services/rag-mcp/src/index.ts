import type { Request, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadDotEnv } from './config/loadEnv.js';
import { loadConfig } from './config/loadConfig.js';
import { createNexusRagMcpServer } from './mcp/createServer.js';
import { createSupabaseRepository } from './rag/ragRepository.js';

loadDotEnv();

const config = loadConfig();
const repository = createSupabaseRepository({
  url: process.env[config.supabase.url_env],
  serviceRoleKey: process.env[config.supabase.service_role_key_env]
});

const app = createMcpExpressApp({ host: config.server.host });

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'nexusai-rag-mcp',
    transport: 'streamable-http'
  });
});

app.post('/mcp', async (req: Request, res: Response) => {
  const server = createNexusRagMcpServer({ config, repository });

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on('close', () => {
      void transport.close();
      void server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
  }
});

app.get('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null
  });
});

app.delete('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null
  });
});

app.listen(config.server.port, config.server.host, () => {
  console.log(`NexusAI RAG MCP listening on ${config.server.host}:${config.server.port}`);
});
