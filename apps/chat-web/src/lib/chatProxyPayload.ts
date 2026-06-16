import { z } from "zod";

import { normalizeChatAttachmentMimeType } from "@/lib/chatAttachmentPolicy";
import type { ChatMessageFilePart } from "@/lib/chatMessageParts";

const chatProxyAttachmentSchema = z.object({
  kind: z.enum(["image", "file"]),
  name: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  storagePath: z.string().trim().min(1),
});

export type ChatProxyAttachmentPayload = {
  kind: "image" | "file";
  name: string;
  mime_type: string;
  storage_path: string;
};

export type ChatProxyPayload = {
  session_id: string;
  message_text: string;
  attachments?: ChatProxyAttachmentPayload[];
};

type BuildChatProxyPayloadParams = {
  sessionId: string;
  messageText: string;
  attachments: ChatMessageFilePart[];
};

const mapAttachmentForProxy = (attachment: ChatMessageFilePart): ChatProxyAttachmentPayload => {
  const parsed = chatProxyAttachmentSchema.safeParse({
    kind: attachment.kind,
    name: attachment.name,
    mimeType: normalizeChatAttachmentMimeType(attachment.mimeType ?? "", attachment.name.split(".").pop() ?? ""),
    storagePath: attachment.storagePath,
  });

  if (!parsed.success) {
    throw new Error(`Nao foi possivel preparar o anexo ${attachment.name} para o Hermes.`);
  }

  return {
    kind: parsed.data.kind,
    name: parsed.data.name,
    mime_type: parsed.data.mimeType,
    storage_path: parsed.data.storagePath,
  };
};

export const buildChatProxyPayload = ({
  sessionId,
  messageText,
  attachments,
}: BuildChatProxyPayloadParams): ChatProxyPayload => {
  const trimmedMessage = messageText.trim();
  const normalizedSessionId = sessionId.trim();

  const payload: ChatProxyPayload = {
    session_id: normalizedSessionId,
    message_text: trimmedMessage,
  };

  if (attachments.length > 0) {
    payload.attachments = attachments.map(mapAttachmentForProxy);
  }

  return payload;
};
