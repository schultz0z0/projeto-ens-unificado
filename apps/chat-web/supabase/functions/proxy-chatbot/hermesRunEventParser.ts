type StreamStatus = {
  text: string;
  tone?: "info" | "success" | "warning";
};

type HermesFilePayload = {
  name: string;
  url: string;
  kind: "image" | "file";
  mimeType?: string;
};

type ParserContext = {
  requestId: string;
  runId: string;
  sessionId: string;
  streamedText: string;
};

type StreamEvent =
  | { event: "delta"; data: { delta: string } }
  | { event: "status"; data: StreamStatus }
  | { event: "files"; data: { files: HermesFilePayload[] } }
  | { event: "meta"; data: Record<string, unknown> }
  | { event: "error"; data: string }
  | { event: "done"; data: { request_id: string } };

type ParserResult = {
  events: StreamEvent[];
  streamedText: string;
  completed: boolean;
  failed: boolean;
  errorCode: string | null;
};

const parseJsonPayload = (payload: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : { raw: payload };
  } catch {
    return { raw: payload };
  }
};

const extractErrorMessageFromUnknown = (value: unknown, depth = 0): string | null => {
  if (depth > 5 || value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const directMessage =
    typeof record.message === "string"
      ? record.message.trim()
      : typeof record.error === "string"
        ? record.error.trim()
        : null;

  if (directMessage) return directMessage;

  return (
    extractErrorMessageFromUnknown(record.error, depth + 1) ??
    extractErrorMessageFromUnknown(record.response, depth + 1)
  );
};

const normalizeErrorCode = (message: string | null) => {
  if (!message) return null;

  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("nonetype")) return "NoneType";
  return normalized.replace(/[^a-z0-9]+/g, "_").slice(0, 80) || "unknown_error";
};

const buildMissingTextDelta = (currentStreamedText: string, candidateText: string) => {
  if (!candidateText) return null;
  if (!currentStreamedText) return candidateText;
  if (candidateText === currentStreamedText) return null;
  if (candidateText.startsWith(currentStreamedText)) {
    return candidateText.slice(currentStreamedText.length);
  }
  return null;
};

const knownFileExtensions = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif",
  "pdf", "doc", "docx", "txt", "rtf", "md", "csv", "json", "xlsx", "xls",
  "ppt", "pptx", "zip", "html", "htm", "mp3", "wav", "mp4",
]);

const getFileExtension = (value: string) => {
  const match = value.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return match?.[1]?.toLowerCase() ?? "";
};

const isImageLike = (value: string, mimeType?: string) => {
  if (mimeType?.startsWith("image/")) return true;
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(getFileExtension(value));
};

const isLikelyFileUrl = (url: string) => {
  if (!/^https?:\/\//i.test(url)) return false;
  return knownFileExtensions.has(getFileExtension(url));
};

const guessFileNameFromUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] ?? "arquivo");
  } catch {
    return "arquivo";
  }
};

const extractFilesFromUnknown = (value: unknown, depth = 0): HermesFilePayload[] => {
  if (depth > 4 || value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractFilesFromUnknown(item, depth + 1));
  }

  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  const mimeType =
    typeof record.mime_type === "string"
      ? record.mime_type
      : typeof record.mimeType === "string"
        ? record.mimeType
        : typeof record.content_type === "string"
          ? record.content_type
          : undefined;

  const rawUrlCandidates = [
    record.url,
    record.image_url,
    record.file_url,
    record.download_url,
    record.href,
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);

  const rawName =
    typeof record.name === "string"
      ? record.name
      : typeof record.filename === "string"
        ? record.filename
        : typeof record.file_name === "string"
          ? record.file_name
          : typeof record.title === "string"
            ? record.title
            : undefined;

  const directFiles = rawUrlCandidates.flatMap((url) => {
    if (!(type.includes("file") || type.includes("image") || mimeType || rawName || isLikelyFileUrl(url))) {
      return [];
    }

    const name = rawName?.trim() || guessFileNameFromUrl(url);
    return [{
      name,
      url,
      kind: type.includes("image") || isImageLike(name || url, mimeType) ? "image" as const : "file" as const,
      mimeType,
    }];
  });

  return [
    ...directFiles,
    ...extractFilesFromUnknown(record.files, depth + 1),
    ...extractFilesFromUnknown(record.content, depth + 1),
    ...extractFilesFromUnknown(record.output, depth + 1),
    ...extractFilesFromUnknown(record.result, depth + 1),
    ...extractFilesFromUnknown(record.artifacts, depth + 1),
    ...extractFilesFromUnknown(record.items, depth + 1),
    ...extractFilesFromUnknown(record.payload, depth + 1),
    ...extractFilesFromUnknown(record.item, depth + 1),
  ];
};

const dedupeFiles = (files: HermesFilePayload[]) => {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = file.url.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const extractAssistantText = (payload: Record<string, unknown>) => {
  if (typeof payload.output === "string") return payload.output;
  if (typeof payload.content === "string") return payload.content;
  if (typeof payload.text === "string") return payload.text;

  const message = payload.message;
  if (message && typeof message === "object") {
    const record = message as Record<string, unknown>;
    if (typeof record.content === "string") return record.content;
    if (typeof record.text === "string") return record.text;
  }

  return "";
};

const extractDataPayload = (eventBlock: string) => {
  const dataLines: string[] = [];

  eventBlock.split("\n").forEach((rawLine) => {
    const line = rawLine.trimEnd();
    if (!line.startsWith("data:")) return;

    let value = line.slice(5);
    if (value.startsWith(" ")) value = value.slice(1);
    dataLines.push(value);
  });

  return dataLines.join("\n").trim();
};

const describeStatusEvent = (eventName: string, payload: Record<string, unknown>): StreamStatus | null => {
  const toolName =
    typeof payload.tool_name === "string"
      ? payload.tool_name
      : payload.tool && typeof payload.tool === "object" && typeof (payload.tool as Record<string, unknown>).name === "string"
        ? (payload.tool as Record<string, unknown>).name as string
        : "";

  if (eventName.includes("tool") && toolName) {
    return {
      text: eventName.includes("completed") || eventName.includes("done")
        ? `Hermes concluiu a ferramenta ${toolName}.`
        : `Hermes iniciou a ferramenta ${toolName}.`,
      tone: eventName.includes("completed") || eventName.includes("done") ? "success" : "info",
    };
  }

  if (eventName === "run.started" || eventName === "run.created") {
    return { text: "Hermes iniciou a execução do agente.", tone: "info" };
  }

  if (eventName === "run.completed") {
    return { text: "Hermes concluiu a execução do agente.", tone: "success" };
  }

  if (eventName === "run.failed") {
    return { text: "Hermes reportou uma falha ao executar o agente.", tone: "warning" };
  }

  return null;
};

export const parseHermesRunEventBlock = (
  eventBlock: string,
  context: ParserContext,
): ParserResult => {
  const payload = extractDataPayload(eventBlock);
  if (!payload) {
    return {
      events: [],
      streamedText: context.streamedText,
      completed: false,
      failed: false,
      errorCode: null,
    };
  }

  if (payload === "[DONE]") {
    return {
      events: [{ event: "done", data: { request_id: context.requestId } }],
      streamedText: context.streamedText,
      completed: true,
      failed: false,
      errorCode: null,
    };
  }

  const parsedPayload = parseJsonPayload(payload);
  const eventName = typeof parsedPayload.event === "string" ? parsedPayload.event : "message";
  const events: StreamEvent[] = [];
  let nextStreamedText = context.streamedText;
  const extractedFiles = dedupeFiles(extractFilesFromUnknown(parsedPayload));

  if (eventName === "message.delta" || eventName === "assistant.delta") {
    const delta = typeof parsedPayload.delta === "string" ? parsedPayload.delta : "";
    if (delta) {
      events.push({ event: "delta", data: { delta } });
      nextStreamedText += delta;
    }

    return {
      events,
      streamedText: nextStreamedText,
      completed: false,
      failed: false,
      errorCode: null,
    };
  }

  if (eventName === "assistant.completed" || eventName === "message.completed") {
    const completedText = extractAssistantText(parsedPayload);
    const missingDelta = buildMissingTextDelta(nextStreamedText, completedText);
    if (missingDelta) {
      events.push({ event: "delta", data: { delta: missingDelta } });
      nextStreamedText += missingDelta;
    }
    if (extractedFiles.length > 0) {
      events.push({ event: "files", data: { files: extractedFiles } });
    }

    events.push({
      event: "meta",
      data: {
        provider: "hermes",
        event: eventName,
        run_id: typeof parsedPayload.run_id === "string" ? parsedPayload.run_id : context.runId,
        session_id: typeof parsedPayload.session_id === "string" ? parsedPayload.session_id : context.sessionId,
      },
    });

    return {
      events,
      streamedText: nextStreamedText,
      completed: false,
      failed: false,
      errorCode: null,
    };
  }

  if (eventName === "run.completed") {
    const output = extractAssistantText(parsedPayload);
    const missingDelta = buildMissingTextDelta(nextStreamedText, output);
    if (missingDelta) {
      events.push({ event: "delta", data: { delta: missingDelta } });
      nextStreamedText += missingDelta;
    }
    if (extractedFiles.length > 0) {
      events.push({ event: "files", data: { files: extractedFiles } });
    }

    events.push({
      event: "meta",
      data: {
        provider: "hermes",
        event: eventName,
        run_id: typeof parsedPayload.run_id === "string" ? parsedPayload.run_id : context.runId,
        session_id: typeof parsedPayload.session_id === "string" ? parsedPayload.session_id : context.sessionId,
      },
    });
    events.push({ event: "done", data: { request_id: context.requestId } });

    return {
      events,
      streamedText: nextStreamedText,
      completed: true,
      failed: false,
      errorCode: null,
    };
  }

  if (eventName === "run.failed" || eventName === "error") {
    const upstreamError = extractErrorMessageFromUnknown(parsedPayload) ?? "Falha ao executar o Hermes.";
    const errorCode = normalizeErrorCode(upstreamError);
    events.push({
      event: "meta",
      data: {
        provider: "hermes",
        event: eventName,
        run_id: typeof parsedPayload.run_id === "string" ? parsedPayload.run_id : context.runId,
        session_id: typeof parsedPayload.session_id === "string" ? parsedPayload.session_id : context.sessionId,
        error_code: errorCode,
        upstream_error_excerpt: upstreamError.slice(0, 160),
      },
    });
    events.push({ event: "error", data: "Falha ao executar o Hermes." });
    events.push({ event: "done", data: { request_id: context.requestId } });

    return {
      events,
      streamedText: nextStreamedText,
      completed: false,
      failed: true,
      errorCode,
    };
  }

  const status = describeStatusEvent(eventName, parsedPayload);
  if (status) {
    events.push({ event: "status", data: status });
  }

  if (extractedFiles.length > 0) {
    events.push({ event: "files", data: { files: extractedFiles } });
  }

  if (eventName !== "reasoning.available") {
    events.push({
      event: "meta",
      data: {
        provider: "hermes",
        event: eventName,
        run_id: typeof parsedPayload.run_id === "string" ? parsedPayload.run_id : context.runId,
        session_id: typeof parsedPayload.session_id === "string" ? parsedPayload.session_id : context.sessionId,
      },
    });
  }

  return {
    events,
    streamedText: nextStreamedText,
    completed: false,
    failed: false,
    errorCode: null,
  };
};
