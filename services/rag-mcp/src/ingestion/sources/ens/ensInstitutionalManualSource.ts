import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import type { IngestionDocument, IngestionSource, IngestionSourceResult } from '../../types.js';
import { cleanText, stableKey } from '../../text.js';
import type { EnsRagCollection } from '../../../rag/types.js';

type ParsedInstitutionalMarkdown = {
  title: string;
  sourceUrl?: string;
  sourceType: string;
  body: string;
  sections: Array<{ heading: string; content: string }>;
};

export class EnsInstitutionalManualSource implements IngestionSource {
  readonly sourceId = 'ens_institutional_manual';

  private readonly source = new EnsMarkdownManualSource({
    sourceId: this.sourceId,
    collection: 'institutional',
    directoryEnv: 'ENS_INSTITUTIONAL_CONTENT_DIR',
    defaultDirectory: 'data/institutional',
    chunkKind: 'institutional_section'
  });

  load(tenantSlug: string): Promise<IngestionSourceResult> {
    return this.source.load(tenantSlug);
  }
}

export class EnsMarketingManualSource implements IngestionSource {
  readonly sourceId = 'ens_marketing_manual';

  private readonly source = new EnsMarkdownManualSource({
    sourceId: this.sourceId,
    collection: 'marketing',
    directoryEnv: 'ENS_MARKETING_CONTENT_DIR',
    defaultDirectory: 'data/marketing',
    chunkKind: 'marketing_section'
  });

  load(tenantSlug: string): Promise<IngestionSourceResult> {
    return this.source.load(tenantSlug);
  }
}

export class EnsInsightsManualSource implements IngestionSource {
  readonly sourceId = 'ens_insights_manual';

  private readonly source = new EnsMarkdownManualSource({
    sourceId: this.sourceId,
    collection: 'insights',
    directoryEnv: 'ENS_INSIGHTS_CONTENT_DIR',
    defaultDirectory: 'data/insights',
    chunkKind: 'insight_section'
  });

  load(tenantSlug: string): Promise<IngestionSourceResult> {
    return this.source.load(tenantSlug);
  }
}

class EnsMarkdownManualSource implements IngestionSource {
  readonly sourceId: string;
  private readonly collection: EnsRagCollection;
  private readonly directoryEnv: string;
  private readonly defaultDirectory: string;
  private readonly chunkKind: string;

  constructor(options: {
    sourceId: string;
    collection: EnsRagCollection;
    directoryEnv: string;
    defaultDirectory: string;
    chunkKind: string;
  }) {
    this.sourceId = options.sourceId;
    this.collection = options.collection;
    this.directoryEnv = options.directoryEnv;
    this.defaultDirectory = options.defaultDirectory;
    this.chunkKind = options.chunkKind;
  }

  async load(tenantSlug: string): Promise<IngestionSourceResult> {
    if (tenantSlug !== 'ens') {
      throw new Error(`ENS ${this.collection} ingestion can only target tenant ens.`);
    }

    const directory = resolve(process.env[this.directoryEnv] ?? this.defaultDirectory);
    const files = readdirSync(directory)
      .filter(file => extname(file) === '.md')
      .sort();

    const documents = files.map(file =>
      normalizeMarkdownDocument({
        fileName: file,
        raw: readFileSync(join(directory, file), 'utf8'),
        sourceId: this.sourceId,
        collection: this.collection,
        chunkKind: this.chunkKind
      })
    );

    return {
      sourceId: this.sourceId,
      tenantSlug,
      fetchedCount: files.length,
      skippedCount: 0,
      documents,
      warnings: []
    };
  }
}

function normalizeMarkdownDocument(input: {
  fileName: string;
  raw: string;
  sourceId: string;
  collection: EnsRagCollection;
  chunkKind: string;
}): IngestionDocument {
  const parsed = parseMarkdown(input.raw);
  const sourceKey = stableKey(basename(input.fileName, '.md'), parsed.title);

  return {
    tenantSlug: 'ens',
    collection: input.collection,
    sourceId: input.sourceId,
    sourceKey,
    title: parsed.title,
    sourceType: parsed.sourceType,
    sourceUri: parsed.sourceUrl,
    visibility: 'internal',
    metadata: {
      source_file: input.fileName,
      source_url: parsed.sourceUrl ?? null,
      source_type: parsed.sourceType,
      collection: input.collection
    },
    chunks: parsed.sections.map(section => ({
      kind: input.chunkKind,
      content: `Documento ENS: ${parsed.title}\nSecao: ${section.heading}\n\n${section.content}`,
      metadata: {
        section: section.heading,
        source_file: input.fileName,
        source_url: parsed.sourceUrl ?? null
      }
    }))
  };
}

function parseMarkdown(raw: string): ParsedInstitutionalMarkdown {
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  const meta = frontmatter ? parseFrontmatter(frontmatter[1]) : {};
  const body = cleanText(frontmatter ? frontmatter[2] : raw);
  const title = cleanText(meta.title) || firstHeading(body) || 'ENS - Conhecimento institucional';
  const sections = splitSections(body);

  return {
    title,
    sourceUrl: cleanText(meta.source_url) || undefined,
    sourceType: cleanText(meta.source_type) || 'manual_markdown',
    body,
    sections: sections.length > 0 ? sections : [{ heading: title, content: body }]
  };
}

function parseFrontmatter(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*"?([^"]*)"?$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

function firstHeading(body: string): string | undefined {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function splitSections(body: string): Array<{ heading: string; content: string }> {
  const sections: Array<{ heading: string; content: string }> = [];
  const parts = body.split(/\n(?=#{1,3}\s+)/g);

  for (const part of parts) {
    const heading = part.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
    const content = cleanText(part.replace(/^#{1,3}\s+.+$/m, '').trim());
    if (heading && content) {
      sections.push({ heading, content });
    }
  }

  return sections;
}
