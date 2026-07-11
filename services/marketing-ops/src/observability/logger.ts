const secretKeys = /authorization|cookie|token|secret|password|api[-_]?key|delegation/i;

function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    secretKeys.test(key) ? '[REDACTED]' : redact(nested, seen)
  ]));
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(sink: (entry: Record<string, unknown>) => void = (entry) => process.stdout.write(`${JSON.stringify(entry)}\n`)): Logger {
  const write = (level: string, message: string, data?: Record<string, unknown>) => sink({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data ? { data: redact(data) } : {})
  });
  return {
    info: (message, data) => write('info', message, data),
    warn: (message, data) => write('warn', message, data),
    error: (message, data) => write('error', message, data)
  };
}
