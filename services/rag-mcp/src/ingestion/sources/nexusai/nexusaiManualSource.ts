import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IngestionDocument, IngestionSource, IngestionSourceResult } from '../../types.js';
import { cleanText, joinSections, section, stableKey } from '../../text.js';

type ManualItem = {
  title: string;
  category: string;
  body: string;
  tags?: string[];
};

export class NexusAiManualSource implements IngestionSource {
  readonly sourceId = 'nexusai_manual';

  async load(tenantSlug: string): Promise<IngestionSourceResult> {
    if (tenantSlug !== 'nexusai') {
      throw new Error('NexusAI manual ingestion can only target tenant nexusai.');
    }

    const path = resolve(process.env.NEXUSAI_MANUAL_SEED_PATH ?? 'data/seeds/nexusai-example-content.json');
    const items = JSON.parse(readFileSync(path, 'utf8')) as ManualItem[];

    const documents = items.map(item => normalizeManualItem(item, tenantSlug));

    return {
      sourceId: this.sourceId,
      tenantSlug,
      fetchedCount: items.length,
      skippedCount: 0,
      documents,
      warnings: ['Conteudo exemplo NexusAI. Substituir quando a base oficial for fornecida.']
    };
  }
}

function normalizeManualItem(item: ManualItem, tenantSlug: string): IngestionDocument {
  const title = cleanText(item.title);
  const body = cleanText(item.body);
  const category = cleanText(item.category);

  return {
    tenantSlug,
    sourceId: 'nexusai_manual',
    sourceKey: stableKey(category, title),
    title,
    sourceType: 'manual_seed',
    visibility: 'internal',
    metadata: {
      category,
      tags: item.tags ?? [],
      example_content: true
    },
    chunks: [
      {
        kind: 'manual_knowledge',
        content: joinSections([section('Titulo', title), section('Categoria', category), section('Conteudo', body)]),
        metadata: { section: 'manual_knowledge', category, tags: item.tags ?? [] }
      }
    ]
  };
}

