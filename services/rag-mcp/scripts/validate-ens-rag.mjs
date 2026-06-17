import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const mcpUrl = process.env.MCP_URL ?? 'http://127.0.0.1:8123/mcp';
const actor = process.env.MCP_ACTOR_PROFILE ?? 'ceo';

const client = new Client({ name: 'ens-rag-validation', version: '0.1.0' }, { capabilities: {} });
const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

await client.connect(transport);

const collections = await callJson('ens_rag_list_collections', { actor_profile: actor });
console.log('VALIDATION_COLLECTIONS');
console.log(JSON.stringify(collections, null, 2));

const checks = [
  {
    collection: 'courses',
    intent: 'course_fact',
    query: 'curso ENS seguros link inscricao investimento data inicio',
    course_filters: {
      chunk_kinds: ['course_offer'],
      only_active_offers: true
    }
  },
  { collection: 'institutional', intent: 'institutional', query: 'missao visao valores historia ENS' },
  { collection: 'marketing', intent: 'marketing_strategy', query: 'tom de voz WhatsApp campanha B2C ENS' },
  { collection: 'insights', intent: 'analytics', query: 'funil marketing KPIs CAC ROAS matricula ENS' }
];

for (const check of checks) {
  const result = await callJson('ens_rag_search', {
    actor_profile: actor,
    collections: [check.collection],
    intent: check.intent,
    query: check.query,
    limit: 3,
    course_filters: check.course_filters,
    include_stale: true,
    require_evidence: true
  });

  console.log(`VALIDATION_SEARCH ${check.collection}`);
  console.log(
    JSON.stringify(
      {
        result_count: result.result_count,
        search_mode: result.search_mode,
        reranker: result.reranker,
        course_filters: result.course_filters,
        titles: (result.results ?? []).map(item => item.title)
      },
      null,
      2
    )
  );
}

await transport.close();

async function callJson(name, args) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.find(item => item.type === 'text')?.text;
  if (!text) {
    throw new Error(`Tool ${name} returned no text content.`);
  }

  return JSON.parse(text);
}
