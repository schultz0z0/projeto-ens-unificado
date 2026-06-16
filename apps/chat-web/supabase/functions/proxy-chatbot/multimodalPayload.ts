import { z } from "npm:zod";

const proxyChatAttachmentSchema = z.object({
  kind: z.enum(["image", "file"]),
  name: z.string().trim().min(1),
  mime_type: z.string().trim().min(1),
  storage_path: z.string().trim().min(1),
});

export const proxyChatRequestSchema = z
  .object({
    session_id: z.string().trim().min(1).max(128),
    message_text: z.string().max(4000).default(""),
    attachments: z.array(proxyChatAttachmentSchema).max(4).optional().default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.message_text.trim() && value.attachments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["message_text"],
        message: "A mensagem precisa conter texto ou ao menos um anexo.",
      });
    }
  });

export type ProxyChatAttachment = z.infer<typeof proxyChatAttachmentSchema>;
export type ProxyChatRequest = z.infer<typeof proxyChatRequestSchema>;
export type ResolvedProxyChatAttachment = ProxyChatAttachment & {
  signed_url: string;
};

export type HermesPreparedAttachment = ResolvedProxyChatAttachment & {
  extracted_text?: string;
};

export type HermesReplayContextMessage = {
  messageText: string;
  attachments: HermesPreparedAttachment[];
};

type HermesInputTextPart = {
  type: "input_text";
  text: string;
};

type HermesInputImagePart = {
  type: "input_image";
  image_url: string;
  detail: "auto";
};

type HermesInputPart = HermesInputTextPart | HermesInputImagePart;

type BuildHermesInputParams = {
  messageText: string;
  attachments: HermesPreparedAttachment[];
  replayContextMessages?: HermesReplayContextMessage[];
};

type BuildHermesPdfFallbackInputParams = {
  messageText: string;
  pdfFiles: Array<{
    name: string;
    extractedText: string;
  }>;
};

export const buildHermesInput = ({
  messageText,
  attachments,
  replayContextMessages = [],
}: BuildHermesInputParams) => {
  const input = replayContextMessages
    .map((contextMessage) => {
      const content: HermesInputPart[] = [];
      const trimmedContextMessage = contextMessage.messageText.trim();

      if (trimmedContextMessage) {
        content.push({
          type: "input_text",
          text: [
            "[Contexto multimodal anterior da conversa]",
            `Mensagem anterior do usuario: ${trimmedContextMessage}`,
          ].join("\n"),
        });
      }

      contextMessage.attachments.forEach((attachment) => {
        if (attachment.kind === "image" || attachment.mime_type.startsWith("image/")) {
          content.push({
            type: "input_image",
            image_url: attachment.signed_url,
            detail: "auto",
          });
          return;
        }

        if (attachment.extracted_text?.trim()) {
          content.push({
            type: "input_text",
            text: [`[Arquivo: ${attachment.name}]`, attachment.extracted_text.trim()].join("\n"),
          });
        }
      });

      if (content.length === 0) {
        return null;
      }

      return {
        role: "user" as const,
        content,
      };
    })
    .filter((message): message is { role: "user"; content: HermesInputPart[] } => message !== null);

  const content: HermesInputPart[] = [];
  const trimmedMessage = messageText.trim();

  if (trimmedMessage) {
    content.push({
      type: "input_text",
      text: trimmedMessage,
    });
  }

  attachments.forEach((attachment) => {
    if (attachment.kind === "image" || attachment.mime_type.startsWith("image/")) {
      content.push({
        type: "input_image",
        image_url: attachment.signed_url,
        detail: "auto",
      });
      return;
    }

    if (attachment.extracted_text?.trim()) {
      content.push({
        type: "input_text",
        text: [`[Arquivo: ${attachment.name}]`, attachment.extracted_text.trim()].join("\n"),
      });
    }
  });

  return [
    ...input,
    {
      role: "user" as const,
      content,
    },
  ];
};

export const buildHermesPdfFallbackInput = ({
  messageText,
  pdfFiles,
}: BuildHermesPdfFallbackInputParams) => {
  const content: HermesInputTextPart[] = [];
  const trimmedMessage = messageText.trim();

  if (trimmedMessage) {
    content.push({
      type: "input_text",
      text: trimmedMessage,
    });
  }

  pdfFiles.forEach((pdfFile) => {
    content.push({
      type: "input_text",
      text: [`[PDF: ${pdfFile.name}]`, pdfFile.extractedText.trim()].join("\n"),
    });
  });

  return [
    {
      role: "user" as const,
      content,
    },
  ];
};
