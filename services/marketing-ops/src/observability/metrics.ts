export interface MetricsRegistry {
  increment(name: string, labels?: Record<string, string>, amount?: number): void;
  render(): string;
}

export function createMetrics(): MetricsRegistry {
  const counters = new Map<string, { name: string; labels: Record<string, string>; value: number }>();
  return {
    increment(name, labels = {}, amount = 1) {
      if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) throw new Error('invalid metric name');
      const ordered = Object.fromEntries(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
      const key = `${name}:${JSON.stringify(ordered)}`;
      const current = counters.get(key) ?? { name, labels: ordered, value: 0 };
      current.value += amount;
      counters.set(key, current);
    },
    render() {
      return [...counters.values()].sort((a, b) => a.name.localeCompare(b.name)).map(({ name, labels, value }) => {
        const renderedLabels = Object.entries(labels).map(([key, label]) => `${key}="${label.replaceAll('"', '\\"')}"`).join(',');
        return `${name}${renderedLabels ? `{${renderedLabels}}` : ''} ${value}`;
      }).join('\n') + '\n';
    }
  };
}
