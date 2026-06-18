export const buildHermesConversationId = (userId, sessionId) => `nexus:${userId}:${sessionId}`;

export const sanitizeSessionKeySegment = (value) => String(value ?? "").replace(/[^a-zA-Z0-9:_-]/g, "-");

export const buildHermesSessionKey = ({ userId, sessionId }) => {
  const raw = `agent:main:nexus:chat:${sanitizeSessionKeySegment(userId)}:${sanitizeSessionKeySegment(sessionId)}`;
  return raw.slice(0, 256);
};

export const isImageAttachment = (attachment) =>
  attachment?.kind === "image" || String(attachment?.mime_type ?? "").startsWith("image/");

const IMAGE_GENERATE_SIZE_TO_ASPECT_RATIO = {

  "1024x1024": "square",

  "2048x2048": "square",

  "1536x1024": "landscape",

  "2048x1152": "landscape",

  "2560x1440": "landscape",

  "3840x2160": "landscape",

  "1024x1536": "portrait",

  "1152x2048": "portrait",

  "1440x2560": "portrait",

  "2160x3840": "portrait",

};



const deriveImageAspectRatio = (size) => IMAGE_GENERATE_SIZE_TO_ASPECT_RATIO[size] ?? "landscape";



const buildImageGenerationMessageText = ({ messageText, imageOptions, imageAttachments = [] }) => {

  const options = imageOptions ?? {};

  const quality = options.quality || "auto";

  const size = options.size || "auto";

  const outputFormat = options.output_format || "png";

  const aspectRatio = size === "auto" ? "landscape" : deriveImageAspectRatio(size);

  const prompt = String(messageText ?? "").trim() || "Gerar imagem usando as referencias anexadas e o contexto da conversa.";
  const imageInputs = imageAttachments
    .map((attachment) => ({
      name: attachment.name || "imagem",
      mimeType: attachment.mime_type || "image/*",
      source: attachment.hermes_image_path ?? attachment.inline_data_url ?? attachment.original_signed_url ?? attachment.signed_url,
    }))
    .filter((attachment) => attachment.source);

  const lines = [

    "[Modo Nexus: gerar imagem com Hermes]",

    "Use obrigatoriamente a ferramenta image_generate nesta resposta.",

    "Nao responda apenas com texto antes de chamar a ferramenta.",

    "Depois da geracao, entregue a imagem gerada ao usuario e mencione de forma breve os parametros usados.",

    "",

    "[Pedido visual do usuario]",

    prompt,

    "",

    "[Parametros para image_generate]",

    "prompt: reescreva o pedido visual acima como um prompt detalhado e fiel ao contexto da conversa.",

    `aspect_ratio: ${aspectRatio}`,

    `quality: ${quality}`,

    `size: ${size}`,

    `output_format: ${outputFormat}`,

  ];

  if (imageInputs.length > 0) {

    lines.push(

      "",

      "[Entradas reais para image_generate.input_images]",

      "Chame image_generate agora e passe os valores source abaixo exatamente no array input_images da ferramenta image_generate.",

      "Nao tente baixar, abrir ou validar manualmente essas imagens antes de chamar image_generate; a bridge ja materializou os anexos para esta chamada.",

      "Nao use vision_analyze para este fluxo; as imagens abaixo sao entradas diretas da ferramenta image_generate.",

      "mode: auto|reference|edit",

      "Use mode=edit quando o usuario pedir editar, trocar, remover, preservar o resto ou manter a mesma peca alterando apenas algo especifico.",

      "Use mode=reference quando o usuario pedir usar como referencia, baseado nessa peca, seguir KV, logo, paleta, estilo, layout ou identidade visual.",

      "Se o pedido envolver edicao de imagem e o tamanho estiver auto, mantenha size=auto para preservar a proporcao/medidas da imagem de entrada.",

      `input_images: ${JSON.stringify(imageInputs.map((attachment) => attachment.source))}`,

      ...imageInputs.map((attachment, index) => (
        `${index + 1}. name=${attachment.name}; mime_type=${attachment.mimeType}; source=${attachment.source}`
      )),

    );

  }

  return lines.join("\n");

};



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

export const selectHermesBridgeMode = (attachments) =>

  "session";



const buildHermesSessionChatMessage = ({

  messageText,

  attachments,

  imageTransport = "inline",

  intent,

  imageOptions,

}) => {

  const imageAttachments = attachments.filter(isImageAttachment);

  const effectiveMessageText = intent === "image_generate"

    ? buildImageGenerationMessageText({

      messageText,

      imageOptions,

      imageAttachments,

    })

    : messageText;

  if (imageAttachments.length === 0) {

    return buildHermesRunInput({

      messageText: effectiveMessageText,

      attachments,

      replayContextMessages: [],

    });

  }



  const nonImageAttachments = attachments.filter((attachment) => !isImageAttachment(attachment));

  const textContent = buildHermesRunInput({

    messageText: effectiveMessageText,

    attachments: nonImageAttachments,

    replayContextMessages: [],

  });

  const content = [];

  if (textContent) {

    content.push({ type: "input_text", text: textContent });

  }



  imageAttachments.forEach((attachment) => {
    if (intent === "image_generate") {
      return;
    }

    const imageUrl = imageTransport === "remote"

      ? attachment.original_signed_url ?? attachment.signed_url

      : attachment.inline_data_url ?? attachment.signed_url;

    if (!imageUrl) return;

    content.push({

      type: "input_image",

      image_url: imageUrl,

      detail: "auto",

    });

  });



  return content;

};



export const buildHermesSessionChatRequest = ({

  messageText,

  attachments,

  imageTransport = "inline",

  intent,

  imageOptions,

}) => ({

  message: buildHermesSessionChatMessage({

    messageText,

    attachments,

    imageTransport,

    intent,

    imageOptions,

  }),

});



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
