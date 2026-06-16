import type { IngestionSource } from './types.js';
import { EnsCoursesSource } from './sources/ens/ensCoursesSource.js';
import { NexusAiManualSource } from './sources/nexusai/nexusaiManualSource.js';

export function getIngestionSource(sourceId: string): IngestionSource {
  switch (sourceId) {
    case 'ens_courses':
      return new EnsCoursesSource();
    case 'nexusai_manual':
      return new NexusAiManualSource();
    default:
      throw new Error(`Unknown ingestion source: ${sourceId}`);
  }
}

