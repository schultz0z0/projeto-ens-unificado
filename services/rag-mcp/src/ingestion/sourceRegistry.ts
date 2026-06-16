import type { IngestionSource } from './types.js';
import { EnsCoursesSource } from './sources/ens/ensCoursesSource.js';
import {
  EnsInsightsManualSource,
  EnsInstitutionalManualSource,
  EnsMarketingManualSource
} from './sources/ens/ensInstitutionalManualSource.js';

export function getIngestionSource(sourceId: string): IngestionSource {
  switch (sourceId) {
    case 'ens_courses':
      return new EnsCoursesSource();
    case 'ens_institutional_manual':
      return new EnsInstitutionalManualSource();
    case 'ens_marketing_manual':
      return new EnsMarketingManualSource();
    case 'ens_insights_manual':
      return new EnsInsightsManualSource();
    default:
      throw new Error(`Unknown ingestion source: ${sourceId}`);
  }
}

