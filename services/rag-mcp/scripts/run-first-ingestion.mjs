import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const mcpUrl = process.env.MCP_URL ?? 'http://127.0.0.1:8123/mcp';

const calls = [
  { source_id: 'nexusai_manual', tenant_id: 'nexusai', actor_profile: 'ceo', admin_mode: true },
  { source_id: 'ens_courses', tenant_id: 'ens', actor_profile: 'ceo', admin_mode: true }
];

const client = new Client({ name: 'nexusai-first-ingestion', version: '0.1.0' }, { capabilities: {} });
const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

await client.connect(transport);

for (const args of calls) {
  const result = await client.callTool({
    name: 'nexus_rag_ingest_source',
    arguments: args
  });
  console.log(`INGEST_RESULT ${args.source_id}`);
  console.log(JSON.stringify(result, null, 2));
}

await transport.close();

