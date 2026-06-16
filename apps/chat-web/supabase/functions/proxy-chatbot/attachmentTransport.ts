import type { HermesPreparedAttachment, ResolvedProxyChatAttachment } from "./multimodalPayload.ts";

export type PreparedAttachment = ResolvedProxyChatAttachment & {
  inline_data_url: string;
  original_signed_url: string;
  extracted_text?: string;
};

export const isImageAttachment = (attachment: Pick<ResolvedProxyChatAttachment, "kind" | "mime_type">) => {
  return attachment.kind === "image" || attachment.mime_type.startsWith("image/");
};

export const materializeHermesAttachments = (
  attachments: PreparedAttachment[],
  imageTransport: "inline" | "remote" = "inline",
): HermesPreparedAttachment[] => {
  return attachments.map((attachment) => ({
    ...attachment,
    signed_url:
      isImageAttachment(attachment) && imageTransport === "remote"
        ? attachment.original_signed_url
        : attachment.inline_data_url,
  }));
};
