export type HermesFilePayload = {
  name: string;
  url: string;
  kind: "image" | "file";
  mimeType?: string;
};

export type HermesArtifactPayload = {
  title: string;
  content: string;
  artifactType: "code" | "markdown" | "html" | "text";
  language?: string;
  fileName?: string;
};

type StreamStatus = {
  text: string;
  tone?: "info" | "success" | "warning";
};

type ParserContext = {
  conversation: string;
  requestId: string;
  streamedText: string;
};

type StreamEvent =
  | { event: "delta"; data: { delta: string } }
  | { event: "status"; data: StreamStatus }
  | { event: "files"; data: { files: HermesFilePayload[] } }
  | { event: "artifact"; data: HermesArtifactPayload }
  | { event: "meta"; data: Record<string, unknown> }
  | { event: "error"; data: string }
  | { event: "done"; data: { request_id: string } };

type ParserResult = {
  events: StreamEvent[];
  streamedText: string;
  responseId: string | null;
  recoveredFromFailure: boolean;
  didFail: boolean;
  errorCode: string | null;
};

const knownFileExtensions = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif",
  "pdf", "doc", "docx", "txt", "rtf", "md", "csv", "json", "xlsx", "xls",
  "ppt", "pptx", "zip", "mp3", "wav", "mp4",
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
  const ext = getFileExtension(url);
  return knownFileExtensions.has(ext);
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

    return [{
      name: rawName?.trim() || guessFileNameFromUrl(url),
      url,
      kind: type.includes("image") || isImageLike(rawName ?? url, mimeType) ? "image" as const : "file" as const,
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

const extractArtifactFromUnknown = (value: unknown): HermesArtifactPayload | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const content = typeof record.content === "string" ? record.content.trim() : "";
  if (!content) return null;

  const artifactType =
    record.artifactType === "markdown" || record.artifactType === "html" || record.artifactType === "code" || record.artifactType === "text"
      ? record.artifactType
      : content.startsWith("<!DOCTYPE html") || content.startsWith("<html") || content.startsWith("<svg")
        ? "html"
        : null;

  if (!artifactType) return null;

  return {
    title: typeof record.title === "string" && record.title.trim() ? record.title : "Artifact Hermes",
    content,
    artifactType,
    language: typeof record.language === "string" ? record.language : undefined,
    fileName: typeof record.fileName === "string" ? record.fileName : undefined,
  };
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
  if (normalized.includes("server error")) return "server_error";
  return normalized.replace(/[^a-z0-9]+/g, "_").slice(0, 80) || "unknown_error";
};

const extractToolProgressMeta = (value: unknown) => {
  if (!value || typeof value !== "object") return null;

  const directItem = value as Record<string, unknown>;
  const item = directItem.item && typeof directItem.item === "object"
    ? directItem.item as Record<string, unknown>
    : directItem;

  const type = typeof item.type === "string" ? item.type.toLowerCase() : "";
  const toolName = typeof item.name === "string" ? item.name.trim() : "";
  if (!toolName) return null;

  if (type === "function_call") {
    return {
      tool_name: toolName,
      tool_state: "started" as const,
      status: {
        text: `Hermes iniciou a ferramenta ${toolName}.`,
        tone: "info" as const,
      },
    };
  }

  if (type === "function_call_output") {
    return {
      tool_name: toolName,
      tool_state: "completed" as const,
      status: {
        text: `Hermes concluiu a ferramenta ${toolName}.`,
        tone: "success" as const,
      },
    };
  }

  return null;
};

const describeStatusEvent = (eventName: string, payload: Record<string, unknown>): StreamStatus | null => {
  const toolProgress = extractToolProgressMeta(payload);
  if (toolProgress) return toolProgress.status;

  switch (eventName) {
    case "response.created":
      return { text: "Hermes iniciou a geração da resposta.", tone: "info" };
    case "response.in_progress":
      return { text: "Hermes está pensando e preparando o conteúdo.", tone: "info" };
    case "response.output_item.added":
      return { text: "Hermes adicionou uma nova saída à resposta.", tone: "info" };
    case "response.output_item.done":
      return { text: "Hermes concluiu uma etapa da resposta.", tone: "success" };
    case "response.failed":
      return { text: "Hermes reportou uma falha ao gerar a resposta.", tone: "warning" };
    default:
      return null;
  }
};

const parseJsonPayload = (payload: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : { raw: payload };
  } catch {
    return { raw: payload };
  }
};

const extractAssistantTextFromUnknown = (value: unknown, depth = 0): string[] => {
  if (depth > 6 || value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractAssistantTextFromUnknown(item, depth + 1));
  }

  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  const role = typeof record.role === "string" ? record.role.toLowerCase() : "";

  if (type === "output_text" && typeof record.text === "string" && record.text.length > 0) {
    return [record.text];
  }

  if (type === "text" && typeof record.text === "string" && record.text.length > 0) {
    return [record.text];
  }

  if ((type === "message" || role === "assistant") && typeof record.content === "string" && record.content.length > 0) {
    return [record.content];
  }

  return [
    ...extractAssistantTextFromUnknown(record.item, depth + 1),
    ...extractAssistantTextFromUnknown(record.items, depth + 1),
    ...extractAssistantTextFromUnknown(record.output, depth + 1),
    ...extractAssistantTextFromUnknown(record.content, depth + 1),
    ...extractAssistantTextFromUnknown(record.response, depth + 1),
  ];
};

const dedupeFiles = (files: HermesFilePayload[]) => {
  return files.filter((file, index, list) => (
    list.findIndex((candidate) => candidate.url === file.url && candidate.name === file.name) === index
  ));
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

export const parseHermesEventBlock = (
  eventBlock: string,
  context: ParserContext,
): ParserResult => {
  const lines = eventBlock.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      let value = line.slice(5);
      if (value.startsWith(" ")) value = value.slice(1);
      dataLines.push(value);
    }
  }

  const payload = dataLines.join("\n").trim();
  if (!payload) {
    return {
      events: [],
      streamedText: context.streamedText,
      responseId: null,
      recoveredFromFailure: false,
      didFail: false,
      errorCode: null,
    };
  }

  if (payload === "[DONE]") {
    return {
      events: [{ event: "done", data: { request_id: context.requestId } }],
      streamedText: context.streamedText,
      responseId: null,
      recoveredFromFailure: false,
      didFail: false,
      errorCode: null,
    };
  }

  const parsedPayload = parseJsonPayload(payload);
  const events: StreamEvent[] = [];
  let nextStreamedText = context.streamedText;

  if (eventName === "response.output_text.delta") {
    const delta = typeof parsedPayload.delta === "string" ? parsedPayload.delta : "";
    if (delta) {
      events.push({ event: "delta", data: { delta } });
      nextStreamedText += delta;
    }
    return {
      events,
      streamedText: nextStreamedText,
      responseId: null,
      recoveredFromFailure: false,
      didFail: false,
      errorCode: null,
    };
  }

  const extractedFiles = dedupeFiles(extractFilesFromUnknown(parsedPayload));
  if (extractedFiles.length > 0) {
    events.push({ event: "files", data: { files: extractedFiles } });
  }

  const artifact = extractArtifactFromUnknown(parsedPayload);
  if (artifact) {
    events.push({ event: "artifact", data: artifact });
  }

  if (eventName === "response.output_item.done" || eventName === "response.completed") {
    const finalText = extractAssistantTextFromUnknown(parsedPayload).join("");
    const missingDelta = buildMissingTextDelta(nextStreamedText, finalText);
    if (missingDelta) {
      events.push({ event: "delta", data: { delta: missingDelta } });
      nextStreamedText += missingDelta;
    }
  }

  if (eventName === "response.completed") {
    events.push({
      event: "meta",
      data: {
        provider: "hermes",
        response_id: parsedPayload.id ?? null,
        conversation: context.conversation,
      },
    });
    events.push({ event: "done", data: { request_id: context.requestId } });
    return {
      events,
      streamedText: nextStreamedText,
      responseId: typeof parsedPayload.id === "string" ? parsedPayload.id : null,
      recoveredFromFailure: false,
      didFail: false,
      errorCode: null,
    };
  }

  if (eventName === "response.failed" || eventName === "error") {
    const finalText = extractAssistantTextFromUnknown(parsedPayload).join("");
    const missingDelta = buildMissingTextDelta(nextStreamedText, finalText);
    if (missingDelta) {
      events.push({ event: "delta", data: { delta: missingDelta } });
      nextStreamedText += missingDelta;
    }

    const upstreamError = extractErrorMessageFromUnknown(parsedPayload) ?? "Falha ao gerar resposta com o Hermes.";
    const clientSafeError = "Falha ao gerar resposta com o Hermes.";
    const responseId =
      (parsedPayload.response && typeof parsedPayload.response === "object" && "id" in parsedPayload.response
        ? parsedPayload.response.id
        : parsedPayload.id) ?? null;
    const errorCode = normalizeErrorCode(upstreamError);
    events.push({
      event: "meta",
      data: {
        provider: "hermes",
        event: eventName,
        response_id: typeof responseId === "string" ? responseId : null,
        conversation: context.conversation,
        error_code: errorCode,
        has_assistant_text: nextStreamedText.trim().length > 0,
        upstream_error_excerpt: upstreamError.slice(0, 160),
      },
    });
    if (nextStreamedText.trim().length > 0) {
      events.push({
        event: "meta",
        data: {
          provider: "hermes",
          response_id: responseId,
          conversation: context.conversation,
          recovered_from_failure: true,
        },
      });
      events.push({ event: "done", data: { request_id: context.requestId } });
      return {
        events,
        streamedText: nextStreamedText,
        responseId: typeof responseId === "string" ? responseId : null,
        recoveredFromFailure: true,
        didFail: false,
        errorCode,
      };
    }

    events.push({ event: "error", data: clientSafeError });
    events.push({ event: "done", data: { request_id: context.requestId } });
    return {
      events,
      streamedText: nextStreamedText,
      responseId: typeof responseId === "string" ? responseId : null,
      recoveredFromFailure: false,
      didFail: true,
      errorCode,
    };
  }

  const toolProgress = extractToolProgressMeta(parsedPayload);
  const status = describeStatusEvent(eventName, parsedPayload);
  if (status) {
    events.unshift({ event: "status", data: status });
  }

  if (
    eventName === "response.output_item.added" ||
    eventName === "response.output_item.done" ||
    eventName === "response.output_text.done" ||
    eventName === "response.created" ||
    eventName === "response.in_progress"
  ) {
    events.push({
      event: "meta",
      data: {
        provider: "hermes",
        event: eventName,
        ...(toolProgress
          ? {
              tool_name: toolProgress.tool_name,
              tool_state: toolProgress.tool_state,
            }
          : {}),
      },
    });
  }

  return {
    events,
    streamedText: nextStreamedText,
    responseId: null,
    recoveredFromFailure: false,
    didFail: false,
    errorCode: null,
  };
};
