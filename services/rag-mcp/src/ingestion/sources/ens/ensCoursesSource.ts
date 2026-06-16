import type { IngestionSource, IngestionSourceResult } from '../../types.js';
import { normalizeEnsCourse, type EnsCourseItem } from './ensCourseNormalizer.js';

export class EnsCoursesSource implements IngestionSource {
  readonly sourceId = 'ens_courses';

  async load(tenantSlug: string): Promise<IngestionSourceResult> {
    if (tenantSlug !== 'ens') {
      throw new Error('ENS courses ingestion can only target tenant ens.');
    }

    const url = process.env.ENS_API_URL;
    const apiKey = process.env.ENS_API_KEY;
    const apiKeyHeader = process.env.ENS_API_KEY_HEADER ?? 'key';

    if (!url || !apiKey) {
      throw new Error('ENS_API_URL and ENS_API_KEY must be configured.');
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        [apiKeyHeader]: apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`ENS API request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as EnsCourseItem[];
    if (!Array.isArray(payload)) {
      throw new Error('ENS API response must be an array of courses.');
    }

    const documents = payload
      .map(item => normalizeEnsCourse(item, tenantSlug))
      .filter(document => document !== null);

    return {
      sourceId: this.sourceId,
      tenantSlug,
      fetchedCount: payload.length,
      skippedCount: payload.length - documents.length,
      documents,
      warnings: []
    };
  }
}

