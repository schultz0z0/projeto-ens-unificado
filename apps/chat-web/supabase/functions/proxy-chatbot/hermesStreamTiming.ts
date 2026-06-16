export const DEFAULT_HERMES_STREAM_TIMEOUT_MS = 0;
export const DEFAULT_HERMES_STREAM_HEARTBEAT_MS = 15_000;

const MIN_HERMES_STREAM_TIMEOUT_MS = 60_000;
const MIN_HERMES_STREAM_HEARTBEAT_MS = 5_000;

type EnvReader = {
  get: (key: string) => string | undefined | null;
};

const resolveDurationMs = ({
  rawValue,
  defaultValue,
  minValue,
  allowZero = false,
}: {
  rawValue: string | undefined | null;
  defaultValue: number;
  minValue: number;
  allowZero?: boolean;
}) => {
  if (rawValue === undefined || rawValue === null || rawValue.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) return defaultValue;
  if (allowZero && parsed === 0) return 0;
  return Math.max(Math.floor(parsed), minValue);
};

export const resolveHermesStreamTiming = (env: EnvReader) => ({
  timeoutMs: resolveDurationMs({
    rawValue: env.get("HERMES_STREAM_TIMEOUT_MS"),
    defaultValue: DEFAULT_HERMES_STREAM_TIMEOUT_MS,
    minValue: MIN_HERMES_STREAM_TIMEOUT_MS,
    allowZero: true,
  }),
  heartbeatMs: resolveDurationMs({
    rawValue: env.get("HERMES_STREAM_HEARTBEAT_MS"),
    defaultValue: DEFAULT_HERMES_STREAM_HEARTBEAT_MS,
    minValue: MIN_HERMES_STREAM_HEARTBEAT_MS,
    allowZero: true,
  }),
});
