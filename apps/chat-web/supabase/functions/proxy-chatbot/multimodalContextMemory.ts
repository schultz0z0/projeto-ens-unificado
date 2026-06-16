type PersistedChatMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type ReplayAttachment = {
  kind: "image" | "file";
  name: string;
  mime_type: string;
  storage_path: string;
};

export type ReplayContextMessage = {
  messageText: string;
  attachments: ReplayAttachment[];
};

type StructuredMessagePart = {
  type?: string;
  text?: string;
  kind?: "image" | "file";
  name?: string;
  mimeType?: string;
  storagePath?: string;
};

const STRUCTURED_MESSAGE_START = "[[NEXUS_CHAT_MESSAGE]]";
const STRUCTURED_MESSAGE_END = "[[/NEXUS_CHAT_MESSAGE]]";

const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  md: "text/markdown",
  txt: "text/plain",
  rtf: "application/rtf",
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const normalizeMimeType = (mimeType: string | undefined, fileName: string) => {
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";
  if (normalizedMimeType) {
    return normalizedMimeType;
  }

  return EXTENSION_TO_MIME_TYPE[getFileExtension(fileName)] ?? "";
};

const parseStructuredMessageParts = (content: string): StructuredMessagePart[] => {
  const start = content.indexOf(STRUCTURED_MESSAGE_START);
  const end = content.indexOf(STRUCTURED_MESSAGE_END);
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  const rawPayload = content
    .slice(start + STRUCTURED_MESSAGE_START.length, end)
    .trim();

  try {
    const parsed = JSON.parse(rawPayload) as { v?: number; parts?: StructuredMessagePart[] };
    if (parsed.v !== 2 || !Array.isArray(parsed.parts)) {
      return [];
    }

    return parsed.parts;
  } catch {
    return [];
  }
};

export const extractReplayContextFromHistory = ({
  messages,
  currentTurnStoragePaths = [],
  maxMessages = 2,
  maxAttachments = 4,
}: {
  messages: PersistedChatMessage[];
  currentTurnStoragePaths?: string[];
  maxMessages?: number;
  maxAttachments?: number;
}): ReplayContextMessage[] => {
  const excludedPaths = new Set(currentTurnStoragePaths);
  const collected: ReplayContextMessage[] = [];

  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    const parts = parseStructuredMessageParts(message.content);
    if (parts.length === 0) {
      continue;
    }

    const messageText = parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");

    const attachments = parts
      .filter((part) => part.type === "file" && typeof part.name === "string" && typeof part.storagePath === "string")
      .map((part) => ({
        kind: part.kind ?? "file",
        name: part.name as string,
        mime_type: normalizeMimeType(part.mimeType, part.name as string),
        storage_path: part.storagePath as string,
      }))
      .filter((attachment) => attachment.storage_path && !excludedPaths.has(attachment.storage_path))
      .slice(0, maxAttachments);

    if (attachments.length === 0) {
      continue;
    }

    collected.push({
      messageText,
      attachments,
    });

    if (collected.length >= maxMessages) {
      break;
    }
  }

  return collected.reverse();
};
