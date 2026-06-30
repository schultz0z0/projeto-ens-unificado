import type { Request, Response } from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Neo4jGraphRepository } from './graph/repository.js';
import { resolveGraphContext } from './graph/schema.js';
import { createNexusGraphMcpServer } from './mcp/createServer.js';

const config = {
  host: process.env.GRAPH_MCP_HOST || '0.0.0.0',
  port: Number(process.env.GRAPH_MCP_PORT || 8010),
  neo4jUri: process.env.NEXUS_GRAPH_URL || 'bolt://neo4j:7687',
  neo4jUser: process.env.NEXUS_NEO4J_USER || 'neo4j',
  neo4jPassword: process.env.NEXUS_NEO4J_PASSWORD || 'change-me',
  bootstrapOnStart: process.env.NEXUS_GRAPH_BOOTSTRAP_ON_START !== 'false'
};

const repository = new Neo4jGraphRepository({
  uri: config.neo4jUri,
  username: config.neo4jUser,
  password: config.neo4jPassword
});

const app = createMcpExpressApp({ host: config.host });

app.get('/health', async (_req: Request, res: Response) => {
  try {
    const context = resolveGraphContext();
    const health = await repository.health(context);
    res.json({
      ok: true,
      service: 'nexus-graph-mcp',
      transport: 'streamable-http',
      ...health
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: 'nexus-graph-mcp',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/mcp', async (req: Request, res: Response) => {
  const server = createNexusGraphMcpServer({ repository });

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
    console.error('[graph-mcp] Error handling MCP request:', error);
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

async function bootstrapIfNeeded() {
  if (!config.bootstrapOnStart) return;
  const context = resolveGraphContext();
  const result = await repository.bootstrap(context);
  console.log('[graph-mcp] bootstrap complete', JSON.stringify(result));
}

async function main() {
  try {
    await bootstrapIfNeeded();
  } catch (error) {
    console.warn('[graph-mcp] bootstrap skipped/failed', error instanceof Error ? error.message : String(error));
  }

  app.listen(config.port, config.host, () => {
    console.log(`Nexus Graph MCP listening on ${config.host}:${config.port}`);
  });
}

process.on('SIGTERM', () => {
  void repository.close().finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  void repository.close().finally(() => process.exit(0));
});

void main();
