export interface MetricsRegistry {
  increment(name: string, labels?: Record<string, string>, amount?: number): void;
  set(name: string, value: number, labels?: Record<string, string>): void;
  render(): string;
}

type LabelValidator = (value: string) => boolean;
type MetricDefinition = { labels: Record<string, LabelValidator> };

const oneOf = (...values: string[]): LabelValidator => (value) => values.includes(value);
const httpStatus: LabelValidator = (value) => /^[1-5][0-9]{2}$/.test(value);
const errorCode: LabelValidator = (value) => /^[a-z][a-z0-9_]{0,63}$/.test(value);
const staticRoute: LabelValidator = (value) => value === 'unmatched' || (
  value.length <= 160
  && /^\/[a-zA-Z0-9_./:-]+$/.test(value)
  && !/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(value)
);
const campaignStatus = oneOf('draft', 'planned', 'active', 'completed', 'archived');
const mutationOperation = oneOf(
  'create',
  'update',
  'transition',
  'archive',
  'participant_add',
  'participant_update',
  'participant_remove',
  'material_upload',
  'material_link',
  'material_unlink'
);
const operationStatus = oneOf('success', 'conflict', 'forbidden', 'validation_error', 'not_found', 'error');
const scheduleView = oneOf('list', 'week', 'month');
const productionItemStatus = oneOf('draft', 'ready', 'in_review', 'completed', 'cancelled');
const productionItemKind = oneOf('task', 'email', 'whatsapp', 'post', 'creative', 'review', 'milestone');
const batchAction = oneOf('reassign', 'priority', 'reschedule');
const readinessResult = oneOf('ready', 'not_ready');
const itemMutationOperation = oneOf('update', 'transition', 'dependency', 'content', 'artifact', 'batch');

const metricDefinitions: Record<string, MetricDefinition> = {
  marketing_ops_requests_total: { labels: { route: staticRoute, status: httpStatus } },
  marketing_ops_request_duration_seconds_count: { labels: { route: staticRoute, status: httpStatus } },
  marketing_ops_request_duration_seconds_sum: { labels: { route: staticRoute, status: httpStatus } },
  marketing_ops_errors_total: { labels: { code: errorCode, status: httpStatus } },
  marketing_ops_outbox_unpublished: { labels: {} },
  marketing_ops_campaign_mutations_total: { labels: { operation: mutationOperation, status: operationStatus } },
  marketing_ops_campaign_conflicts_total: { labels: {} },
  marketing_ops_dependency_requests_total: {
    labels: {
      dependency: oneOf('database', 'artifact', 'rag'),
      status: oneOf('ok', 'error', 'timeout')
    }
  },
  marketing_ops_artifact_bytes_total: { labels: {} },
  marketing_ops_campaigns_created_total: { labels: {} },
  marketing_ops_campaign_status_transitions_total: { labels: { from: campaignStatus, to: campaignStatus } },
  marketing_ops_campaign_version_conflicts_total: { labels: {} },
  marketing_ops_material_operations_total: {
    labels: {
      operation: oneOf('upload', 'link', 'access', 'unlink'),
      result: oneOf('success', 'invalid', 'forbidden', 'not_found', 'conflict', 'unavailable', 'error')
    }
  },
  marketing_ops_reference_lookup_total: {
    labels: { result: oneOf('success', 'empty', 'unavailable', 'forbidden', 'error') }
  },
  marketing_ops_campaigns_without_owner: { labels: {} },
  marketing_ops_workspace_active_users_24h: { labels: {} },
  marketing_ops_briefing_completion_ratio: { labels: {} },
  marketing_ops_time_to_planned_seconds_count: { labels: {} },
  marketing_ops_time_to_planned_seconds_sum: { labels: {} },
  marketing_ops_schedule_queries_total: {
    labels: { view: scheduleView, result: operationStatus }
  },
  marketing_ops_schedule_query_duration_seconds_count: {
    labels: { view: scheduleView, result: operationStatus }
  },
  marketing_ops_schedule_query_duration_seconds_sum: {
    labels: { view: scheduleView, result: operationStatus }
  },
  marketing_ops_production_items: {
    labels: { status: productionItemStatus, kind: productionItemKind }
  },
  marketing_ops_item_conflicts_total: {
    labels: { operation: itemMutationOperation }
  },
  marketing_ops_dependency_cycles_rejected_total: { labels: {} },
  marketing_ops_batch_items_total: {
    labels: { action: batchAction, result: operationStatus }
  },
  marketing_ops_content_versions_created_total: { labels: {} },
  marketing_ops_notifications_produced_total: { labels: {} },
  marketing_ops_readiness_total: { labels: { result: readinessResult } },
  marketing_ops_readiness_duration_seconds_count: { labels: { result: readinessResult } },
  marketing_ops_readiness_duration_seconds_sum: { labels: { result: readinessResult } }
};

function normalizeLabels(name: string, labels: Record<string, string>): Record<string, string> {
  const definition = metricDefinitions[name];
  if (!definition) throw new Error(`metric is not allowlisted: ${name}`);
  const expected = Object.keys(definition.labels).sort();
  const actual = Object.keys(labels).sort();
  if (expected.join(',') !== actual.join(',')) throw new Error(`invalid labels for metric: ${name}`);
  for (const key of expected) {
    if (!definition.labels[key]?.(labels[key] ?? '')) throw new Error(`invalid ${key} label for metric: ${name}`);
  }
  return Object.fromEntries(actual.map((key) => [key, labels[key] ?? '']));
}

function validateValue(value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error('invalid metric value');
}

export function createMetrics(): MetricsRegistry {
  const counters = new Map<string, { name: string; labels: Record<string, string>; value: number }>();
  return {
    increment(name, labels = {}, amount = 1) {
      validateValue(amount);
      const ordered = normalizeLabels(name, labels);
      const key = `${name}:${JSON.stringify(ordered)}`;
      const current = counters.get(key) ?? { name, labels: ordered, value: 0 };
      current.value += amount;
      counters.set(key, current);
    },
    set(name, value, labels = {}) {
      validateValue(value);
      const ordered = normalizeLabels(name, labels);
      counters.set(`${name}:${JSON.stringify(ordered)}`, { name, labels: ordered, value });
    },
    render() {
      return [...counters.values()].sort((a, b) => a.name.localeCompare(b.name)).map(({ name, labels, value }) => {
        const renderedLabels = Object.entries(labels).map(([key, label]) => {
          const escaped = label.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
          return `${key}="${escaped}"`;
        }).join(',');
        return `${name}${renderedLabels ? `{${renderedLabels}}` : ''} ${value}`;
      }).join('\n') + '\n';
    }
  };
}
