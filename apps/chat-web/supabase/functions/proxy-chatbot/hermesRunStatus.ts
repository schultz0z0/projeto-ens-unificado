import { parseHermesRunEventBlock } from "./hermesRunEventParser.ts";

type RunParserContext = Parameters<typeof parseHermesRunEventBlock>[1];
type RunParserResult = ReturnType<typeof parseHermesRunEventBlock>;

type RunStatusResult = {
  terminal: boolean;
  parsed: RunParserResult | null;
};

const normalizeStatus = (payload: Record<string, unknown>) => (
  typeof payload.status === "string" ? payload.status.trim().toLowerCase() : ""
);

const buildStatusEventBlock = (payload: Record<string, unknown>, event: string) => (
  `data: ${JSON.stringify({ ...payload, event })}`
);

export const parseHermesRunStatusPayload = (
  payload: Record<string, unknown>,
  context: RunParserContext,
): RunStatusResult => {
  const status = normalizeStatus(payload);

  if (status === "completed") {
    return {
      terminal: true,
      parsed: parseHermesRunEventBlock(buildStatusEventBlock(payload, "run.completed"), context),
    };
  }

  if (status === "failed" || status === "cancelled" || status === "canceled") {
    const fallbackMessage = status === "failed"
      ? "Hermes reportou falha ao executar o run."
      : "A execução do Hermes foi cancelada antes de concluir.";

    return {
      terminal: true,
      parsed: parseHermesRunEventBlock(buildStatusEventBlock({
        ...payload,
        error: typeof payload.error === "string" || typeof payload.error === "object"
          ? payload.error
          : { message: fallbackMessage },
      }, "run.failed"), context),
    };
  }

  return {
    terminal: false,
    parsed: null,
  };
};
