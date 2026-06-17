export const buildHermesConversationId = (userId, sessionId) => `nexus:${userId}:${sessionId}`;

export const sanitizeSessionKeySegment = (value) => String(value ?? "").replace(/[^a-zA-Z0-9:_-]/g, "-");

export const buildHermesSessionKey = ({ userId, sessionId }) => {
  const raw = `agent:main:nexus:chat:${sanitizeSessionKeySegment(userId)}:${sanitizeSessionKeySegment(sessionId)}`;
  return raw.slice(0, 256);
};

export const isImageAttachment = (attachment) =>
  attachment?.kind === "image" || String(attachment?.mime_type ?? "").startsWith("image/");

const appendFileText = (lines, label, attachment, { includeUrl = true } = {}) => {
  lines.push(`[${label}: ${attachment.name}]`);
  lines.push(`Tipo: ${attachment.mime_type}`);
  if (includeUrl && attachment.signed_url) {
    lines.push(`URL temporaria do arquivo: ${attachment.signed_url}`);
  }
  if (attachment.extracted_text?.trim()) {
    lines.push(attachment.extracted_text.trim());
  }
};

export const buildHermesResponsesInput = ({
  messageText,
  attachments,
  replayContextMessages = [],
  imageTransport = "inline",
}) => {
  const input = replayContextMessages
    .map((contextMessage) => {
      const content = [];
      const trimmedContextMessage = String(contextMessage.messageText ?? "").trim();

      if (trimmedContextMessage) {
        const roleLabel = contextMessage.role === "assistant" ? "Resposta anterior do assistente" : "Mensagem anterior do usuario";
        content.push({
          type: "input_text",
          text: [
            "[Contexto multimodal anterior da conversa]",
            `${roleLabel}: ${trimmedContextMessage}`,
          ].join("\n"),
        });
      }

      contextMessage.attachments.forEach((attachment) => {
        if (isImageAttachment(attachment)) {
          content.push({
            type: "input_image",
            image_url: imageTransport === "remote" ? attachment.original_signed_url ?? attachment.signed_url : attachment.inline_data_url ?? attachment.signed_url,
            detail: "auto",
          });
          return;
        }

        const lines = [];
        appendFileText(lines, "Arquivo anterior", attachment);
        content.push({ type: "input_text", text: lines.join("\n") });
      });

      return content.length > 0 ? { role: "user", content } : null;
    })
    .filter(Boolean);

  const content = [];
  const trimmedMessage = String(messageText ?? "").trim();
  if (trimmedMessage) {
    content.push({ type: "input_text", text: trimmedMessage });
  }

  attachments.forEach((attachment) => {
    if (isImageAttachment(attachment)) {
      content.push({
        type: "input_image",
        image_url: imageTransport === "remote" ? attachment.original_signed_url ?? attachment.signed_url : attachment.inline_data_url ?? attachment.signed_url,
        detail: "auto",
      });
      return;
    }

    const lines = [];
    appendFileText(lines, "Arquivo", attachment);
    content.push({ type: "input_text", text: lines.join("\n") });
  });

  return [
    ...input,
    {
      role: "user",
      content,
    },
  ];
};

export const buildHermesRunInput = ({
  messageText,
  attachments,
  replayContextMessages = [],
}) => {
  const lines = [];
  const trimmedMessage = String(messageText ?? "").trim();

  replayContextMessages.forEach((contextMessage) => {
    const hasContext = String(contextMessage.messageText ?? "").trim() || contextMessage.attachments.some((attachment) => attachment.extracted_text?.trim());
    if (!hasContext) return;

    lines.push("[Contexto anterior da conversa]");
    if (String(contextMessage.messageText ?? "").trim()) {
      const roleLabel = contextMessage.role === "assistant" ? "Resposta anterior do assistente" : "Mensagem anterior do usuario";
      lines.push(`${roleLabel}: ${contextMessage.messageText.trim()}`);
    }
    contextMessage.attachments.forEach((attachment) => {
      if (attachment.extracted_text?.trim()) {
        appendFileText(lines, "Arquivo anterior", attachment, { includeUrl: false });
      }
    });
  });

  if (trimmedMessage) {
    if (lines.length > 0 || attachments.some((attachment) => attachment.extracted_text?.trim())) {
      lines.push("[Mensagem atual do usuario]");
    }
    lines.push(trimmedMessage);
  }

  attachments.forEach((attachment) => {
    if (attachment.extracted_text?.trim()) {
      appendFileText(lines, "Arquivo", attachment, { includeUrl: false });
    } else if (attachment.signed_url) {
      appendFileText(lines, "Arquivo", attachment, { includeUrl: true });
    }
  });

  return lines.join("\n\n").trim();
};

export const shouldUseResponsesApi = (attachments) =>
  attachments.some((attachment) => isImageAttachment(attachment) || !attachment.extracted_text?.trim());

export const buildHermesResponsesRequest = ({
  modelName,
  userId,
  sessionId,
  messageText,
  attachments,
  conversationId,
  previousResponseId,
  replayContextMessages = [],
  imageTransport = "inline",
}) => ({
  model: modelName,
  store: true,
  stream: true,
  ...(previousResponseId
    ? { previous_response_id: previousResponseId }
    : { conversation: conversationId ?? buildHermesConversationId(userId, sessionId) }),
  metadata: {
    nexus_user_id: userId,
    nexus_session_id: sessionId,
    source: "nexus-ai-bridge",
  },
  input: buildHermesResponsesInput({
    messageText,
    attachments,
    replayContextMessages,
    imageTransport,
  }),
});

export const buildHermesRunRequest = ({
  sessionId,
  messageText,
  attachments,
  replayContextMessages = [],
}) => ({
  session_id: sessionId,
  input: buildHermesRunInput({
    messageText,
    attachments,
    replayContextMessages,
  }),
});
