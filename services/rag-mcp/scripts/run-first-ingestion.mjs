import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const mcpUrl = process.env.MCP_URL ?? 'http://127.0.0.1:8123/mcp';
const actor = process.env.MCP_ACTOR_PROFILE ?? 'ceo';

const args = { actor_profile: actor, admin_mode: true };
const tools = [
  'ens_rag_ingest_courses',
  'ens_rag_ingest_institutional',
  'ens_rag_ingest_marketing',
  'ens_rag_ingest_insights'
];

const client = new Client({ name: 'ens-first-ingestion', version: '0.1.0' }, { capabilities: {} });
const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

await client.connect(transport);

for (const name of tools) {
  const result = await client.callTool({ name, arguments: args });
  console.log(`INGEST_RESULT ${name}`);
  console.log(JSON.stringify(result, null, 2));
}

await transport.close();

