import type { ProxyChatAttachment } from "./multimodalPayload.ts";

export const CHAT_ATTACHMENT_BUCKET = "chat-attachments";
export const CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 15;
export const CHAT_ATTACHMENT_MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;

export const CHAT_ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/markdown",
  "text/plain",
  "application/rtf",
  "text/rtf",
]);

const hasSuspiciousPathSegments = (path: string) => {
  return path.includes("..") || path.includes("\\") || path.startsWith("/") || path.endsWith("/");
};

export const assertAttachmentAccess = ({
  attachment,
  userId,
  sessionId,
}: {
  attachment: ProxyChatAttachment;
  userId: string;
  sessionId: string;
}) => {
  if (!CHAT_ATTACHMENT_ALLOWED_MIME_TYPES.has(attachment.mime_type)) {
    throw new Error("invalid_attachment_mime");
  }

  const normalizedPath = attachment.storage_path.trim();
  if (!normalizedPath || hasSuspiciousPathSegments(normalizedPath)) {
    throw new Error("invalid_attachment_path");
  }

  const expectedPrefix = `${userId}/${sessionId}/`;
  if (!normalizedPath.startsWith(expectedPrefix)) {
    throw new Error("forbidden_attachment");
  }
};
