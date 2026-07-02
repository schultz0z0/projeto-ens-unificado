import type { Request, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadDotEnv } from './config/loadEnv.js';
import { loadConfig } from './config/loadConfig.js';
import { createEnsRagMcpServer } from './mcp/createServer.js';
import { createSupabaseRepository } from './rag/ragRepository.js';
import { buildGraphSyncSourcesPayload, parseGraphSyncCollections } from './rag/graphSync.js';

loadDotEnv();

const config = loadConfig();
const repository = createSupabaseRepository({
  url: process.env[config.supabase.url_env],
  serviceRoleKey: process.env[config.supabase.service_role_key_env]
});
const internalSyncKey = process.env.NEXUS_INTERNAL_SYNC_KEY || '';

const app = createMcpExpressApp({ host: config.server.host });

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'ens-rag-mcp',
    transport: 'streamable-http'
  });
});

app.get('/internal/graph-sync/sources', async (req: Request, res: Response) => {
  if (internalSyncKey && req.headers['x-nexus-internal-key'] !== internalSyncKey) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const tenant = String(req.query.tenant ?? config.policy.common_tenant).trim() || config.policy.common_tenant;
  if (tenant !== config.policy.common_tenant) {
    res.status(403).json({ error: 'tenant_not_available', tenant });
    return;
  }

  try {
    const sources = await repository.listSources(config.policy.common_tenant);
    res.json(buildGraphSyncSourcesPayload({
      tenant,
      collections: parseGraphSyncCollections(req.query.collections),
      limit: Number(req.query.limit ?? 100),
      sources
    }));
  } catch (error) {
    res.status(503).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/mcp', async (req: Request, res: Response) => {
  const server = createEnsRagMcpServer({ config, repository });

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
  console.log(`ENS RAG MCP listening on ${config.server.host}:${config.server.port}`);
});
