import type { HermesPreparedAttachment, HermesReplayContextMessage } from "./multimodalPayload.ts";

export type HermesRunRequest = {
  session_id: string;
  input: string;
};

const MAX_RUN_SESSION_ID_LENGTH = 64;
const RUN_SESSION_PREFIX = "nexus:";

const sanitizeSessionSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const buildStableHash = (value: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const buildHermesRunSessionId = (chatSessionId: string) => {
  const sanitized = sanitizeSessionSegment(chatSessionId) || "chat";
  const candidate = `${RUN_SESSION_PREFIX}${sanitized}`;
  if (candidate.length <= MAX_RUN_SESSION_ID_LENGTH) return candidate;

  const hash = buildStableHash(sanitized);
  const maxSegmentLength = MAX_RUN_SESSION_ID_LENGTH - RUN_SESSION_PREFIX.length - hash.length - 1;
  return `${RUN_SESSION_PREFIX}${sanitized.slice(0, maxSegmentLength)}-${hash}`;
};

const appendExtractedAttachmentText = (
  lines: string[],
  label: string,
  attachment: HermesPreparedAttachment,
) => {
  const extractedText = attachment.extracted_text?.trim();
  if (!extractedText) return;

  lines.push(`[${label}: ${attachment.name}]`);
  lines.push(extractedText);
};

export const buildHermesRunInput = ({
  messageText,
  attachments,
  replayContextMessages = [],
}: {
  messageText: string;
  attachments: HermesPreparedAttachment[];
  replayContextMessages?: HermesReplayContextMessage[];
}) => {
  const hasContext = replayContextMessages.some((contextMessage) => (
    contextMessage.messageText.trim() ||
    contextMessage.attachments.some((attachment) => attachment.extracted_text?.trim())
  ));
  const hasExtractedAttachments = attachments.some((attachment) => attachment.extracted_text?.trim());
  const lines: string[] = [];
  const trimmedMessage = messageText.trim();

  if (!hasContext && !hasExtractedAttachments) {
    return trimmedMessage;
  }

  replayContextMessages.forEach((contextMessage) => {
    const trimmedContextMessage = contextMessage.messageText.trim();
    if (trimmedContextMessage || contextMessage.attachments.some((attachment) => attachment.extracted_text?.trim())) {
      lines.push("[Contexto anterior da conversa]");
    }

    if (trimmedContextMessage) {
      lines.push(`Mensagem anterior do usuario: ${trimmedContextMessage}`);
    }

    contextMessage.attachments.forEach((attachment) => {
      appendExtractedAttachmentText(lines, "Arquivo anterior", attachment);
    });
  });

  if (trimmedMessage) {
    lines.push("[Mensagem atual do usuario]");
    lines.push(trimmedMessage);
  }

  attachments.forEach((attachment) => {
    appendExtractedAttachmentText(lines, "Arquivo", attachment);
  });

  return lines.join("\n\n").trim();
};

export const buildHermesRunRequest = ({
  sessionId,
  messageText,
  attachments,
  replayContextMessages,
}: {
  sessionId: string;
  messageText: string;
  attachments: HermesPreparedAttachment[];
  replayContextMessages?: HermesReplayContextMessage[];
}): HermesRunRequest => ({
  session_id: sessionId,
  input: buildHermesRunInput({
    messageText,
    attachments,
    replayContextMessages,
  }),
});
