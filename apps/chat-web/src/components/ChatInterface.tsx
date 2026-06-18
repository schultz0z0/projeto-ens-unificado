import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  BriefcaseBusiness,
  ClipboardList,
  Image as ImageIcon,
  Paperclip,
  PenLine,
  Sparkles,
  Share2,
  Target,
  Mail,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { ChatMessageContent } from "./ChatMessageContent";
import { useAuth } from "@/contexts/AuthContext";
import { chatService } from "@/lib/chatService";
import {
  uploadChatAttachments,
  validateAttachmentFile,
} from "@/lib/chatAttachments";
import { CHAT_PROXY_MAX_ATTACHMENTS } from "@/lib/chatAttachmentPolicy";
import { buildChatProxyPayload } from "@/lib/chatProxyPayload";
import { shouldShowPendingAssistantIndicator } from "@/lib/chatStreamingUx";
import {
  createArtifactPart,
  createStatusPart,
  createTextPart,
  serializeChatMessageContent,
  type ChatMessageArtifactPart,
  type ChatMessageFilePart,
  type ChatMessagePart,
  type ChatMessageStatusPart,
} from "@/lib/chatMessageParts";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ChatHistorySidebar } from "./ChatHistorySidebar";
import { ChatEmptyState, type HomeTab } from "./ChatEmptyState";
import { ChatComposer, type ComposerAttachment, type ComposerMenuItem, type ImageGenerationOptions } from "./ChatComposer";
import { hydrateChatMessages } from "./chat/chatAttachmentHydration";
import { reconcileHydratedMessages } from "./chat/chatMessageReconciliation";
import { sendMessageToChatbotStream, type StreamArtifact, type StreamStatus } from "./chat/chatStreamClient";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ChatInterfaceProps {
  onRequestTabChange?: (tab: HomeTab) => void;
}

export const ChatInterface = ({ onRequestTabChange }: ChatInterfaceProps) => {
  const { user, session, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSessionId = searchParams.get("chat");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [imageGenerationMode, setImageGenerationMode] = useState(false);
  const [imageGenerationOptions, setImageGenerationOptions] = useState<ImageGenerationOptions>({
    quality: "auto",
    size: "auto",
    outputFormat: "png",
  });
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRetrievingContext, setIsRetrievingContext] = useState(false);
  const [liveStatusText, setLiveStatusText] = useState<string | null>(null);
  const [contextStatus, setContextStatus] = useState<"ok" | "insufficient" | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [reviewState, setReviewState] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const streamingMessageIdRef = useRef<string | null>(null);
  const streamingQueueRef = useRef("");
  const streamingRenderedContentRef = useRef("");
  const streamingFrameRef = useRef<number | null>(null);
  const streamingLastRenderAtRef = useRef(0);
  const [activeStreamingMessageId, setActiveStreamingMessageId] = useState<string | null>(null);
  
  // Session State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const PAGE_SIZE = 50;

  const isEmpty = messages.length === 0;
  const suggestionCards = useMemo(() => ([
    {
      icon: Share2,
      title: "Redes Sociais",
      desc: "Crie posts, legendas e stories virais",
      prompt: "Crie um calendário de conteúdo para Instagram focado em seguros...",
    },
    {
      icon: Target,
      title: "Estratégia",
      desc: "Planejamento mensal e análise de mercado",
      prompt: "Desenvolva uma estratégia de marketing mensal para corretora...",
    },
    {
      icon: Mail,
      title: "Campanha de E-mail",
      desc: "Newsletters e funis de venda automáticos",
      prompt: "Escreva uma sequência de e-mails para renovação de seguro...",
    },
    {
      icon: Search,
      title: "SEO & Blog",
      desc: "Artigos otimizados para busca orgânica",
      prompt: "Escreva um artigo de blog otimizado para SEO sobre seguro de vida...",
    },
  ]), []);

  const composerMenuItems = useMemo<ComposerMenuItem[]>(
    () => [
      { key: "upload", label: "Adicionar fotos e arquivos", icon: Paperclip, kind: "upload", separatorAfter: true },
      {
        key: "image",
        label: "Criar imagem",
        icon: ImageIcon,
        kind: "action",
        onSelect: () => setImageGenerationMode(true),
        separatorAfter: true,
      },
      {
        key: "copy",
        label: "Criar Copy",
        icon: PenLine,
        kind: "action",
        onSelect: () => setInput("Crie 5 variações de copy (curta, direta e persuasiva) para: "),
      },
      {
        key: "sales",
        label: "Aux. de Vendas",
        icon: BriefcaseBusiness,
        kind: "action",
        onSelect: () => setInput("Me ajude a responder esse lead e fechar a venda. Contexto: "),
      },
      {
        key: "brief",
        label: "Briefing de peças",
        icon: ClipboardList,
        kind: "action",
        onSelect: () => setInput("Monte um briefing completo para uma peça. Informações: "),
      },
      {
        key: "plan",
        label: "Planejamento",
        icon: ClipboardList,
        kind: "action",
        onSelect: () => setInput("Crie um planejamento semanal de conteúdo para: "),
      },
    ],
    [],
  );
  const displayMessages = useMemo(() => {
    const result: Message[] = [];
    for (const message of messages) {
      const previous = result[result.length - 1];
      if (previous && previous.role === message.role && previous.content === message.content) {
        continue;
      }
      result.push(message);
    }
    return result;
  }, [messages]);
  const lastAssistantIndex = useMemo(() => {
    for (let i = displayMessages.length - 1; i >= 0; i -= 1) {
      if (displayMessages[i].role === "assistant") return i;
    }
    return -1;
  }, [displayMessages]);
  const showPendingAssistantIndicator = useMemo(
    () =>
      shouldShowPendingAssistantIndicator({
        isTyping,
        activeStreamingMessageId,
        messages: displayMessages,
      }),
    [activeStreamingMessageId, displayMessages, isTyping],
  );
  const chatbotProxyBaseUrl = (import.meta.env.VITE_CHATBOT_PROXY_URL ||
    import.meta.env.NEXT_PUBLIC_CHATBOT_PROXY_URL) as string | undefined;

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      // Se já tiver mensagens carregadas e for a mesma sessão (ex: navegação rápida), evita flash
      // Mas como não guardamos o ID no state messages, vamos carregar sempre para garantir sincronia
      const page = await chatService.getMessagesPage(sessionId, { limit: PAGE_SIZE });
      const dbMessages = page.messages;
      
      // Se o banco retornar vazio (ex: acabou de criar), não limpa se já tivermos mensagens otimistas
      // Isso previne o "piscar" logo após criar o chat
      if (dbMessages.length === 0 && messages.length > 0) {
         return;
      }
      shouldAutoScrollRef.current = true;
      setHasMoreHistory(page.hasMore);
      const hydratedMessages = await hydrateChatMessages(
        dbMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        })),
      );
      setMessages((currentMessages) =>
        reconcileHydratedMessages({
          currentMessages,
          hydratedMessages,
          activeStreamingMessageId: streamingMessageIdRef.current,
        }),
      );
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast.error("Erro ao carregar histórico da conversa.");
    }
  }, [messages.length]);

  // Initialize or load session
  useEffect(() => {
    if (currentSessionId) {
      // Se tiver ID na URL, carrega as mensagens
      loadMessages(currentSessionId);
      // Abre a sidebar automaticamente no desktop para dar feedback visual
      if (window.innerWidth >= 1024) setIsHistoryOpen(true);
      
    } else {
      // Se não tiver ID (home), limpa as mensagens
      setMessages([]);
      setHasMoreHistory(false);
    }
    setIsRetrievingContext(false);
    setLiveStatusText(null);
    setContextStatus(null);
    setConfidenceScore(null);
    setReviewState(null);
  }, [currentSessionId, loadMessages]);

  useEffect(() => {
    if (!currentSessionId || isTyping) return;
    const lastMessage = displayMessages[displayMessages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") return;

    const intervalId = window.setInterval(() => {
      loadMessages(currentSessionId);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [currentSessionId, displayMessages, isTyping, loadMessages]);

  const loadOlderMessages = async () => {
    if (!currentSessionId || isLoadingMore || !hasMoreHistory || messages.length === 0) return;

    const oldest = messages[0];
    setIsLoadingMore(true);
    try {
      const page = await chatService.getMessagesPage(currentSessionId, {
        limit: PAGE_SIZE,
        before: { created_at: oldest.created_at, id: oldest.id },
      });
      if (page.messages.length === 0) {
        setHasMoreHistory(false);
        return;
      }
      shouldAutoScrollRef.current = false;
      setHasMoreHistory(page.hasMore);
      setMessages((prev) => [...page.messages, ...prev]);
    } catch (error) {
      console.error("Erro ao carregar mensagens antigas:", error);
      toast.error("Erro ao carregar mensagens anteriores.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setSearchParams({ chat: sessionId });
  };

  const createNewSession = async () => {
    setSearchParams({}); // Remove o parâmetro chat da URL
    setMessages([]);
    setHasMoreHistory(false);
    if (window.innerWidth < 1024) setIsHistoryOpen(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
    shouldAutoScrollRef.current = true;
  }, [messages]);

  const cancelStreamingRender = useCallback(() => {
    if (streamingFrameRef.current !== null) {
      window.cancelAnimationFrame(streamingFrameRef.current);
      streamingFrameRef.current = null;
    }
  }, []);

  const flushStreamingContent = useCallback((messageId: string, content: string) => {
    cancelStreamingRender();
    streamingMessageIdRef.current = messageId;
    streamingQueueRef.current = "";
    streamingRenderedContentRef.current = content;
    streamingLastRenderAtRef.current = 0;
    shouldAutoScrollRef.current = true;
    setMessages((prev) => prev.map((message) => (
      message.id === messageId
        ? { ...message, content }
        : message
    )));
  }, [cancelStreamingRender]);

  const pumpStreamingContent = useCallback((timestamp: number) => {
    const messageId = streamingMessageIdRef.current;
    if (!messageId) {
      cancelStreamingRender();
      return;
    }

    const queue = streamingQueueRef.current;
    if (!queue) {
      streamingFrameRef.current = null;
      return;
    }

    const elapsed = timestamp - streamingLastRenderAtRef.current;
    const minFrameMs = queue.length > 320 ? 18 : 28;
    if (streamingLastRenderAtRef.current !== 0 && elapsed < minFrameMs) {
      streamingFrameRef.current = window.requestAnimationFrame(pumpStreamingContent);
      return;
    }

    streamingLastRenderAtRef.current = timestamp;

    const chunkSize =
      queue.length > 900 ? 18 :
      queue.length > 500 ? 12 :
      queue.length > 240 ? 8 :
      queue.length > 100 ? 5 : 3;
    const nextChunk = queue.slice(0, chunkSize);
    streamingQueueRef.current = queue.slice(chunkSize);
    streamingRenderedContentRef.current += nextChunk;
    shouldAutoScrollRef.current = true;

    setMessages((prev) => prev.map((message) => (
      message.id === messageId
        ? { ...message, content: streamingRenderedContentRef.current }
        : message
    )));

    if (streamingQueueRef.current) {
      streamingFrameRef.current = window.requestAnimationFrame(pumpStreamingContent);
    } else {
      streamingFrameRef.current = null;
    }
  }, [cancelStreamingRender]);

  const enqueueStreamingDelta = useCallback((messageId: string, delta: string) => {
    if (!delta) return;

    if (streamingMessageIdRef.current !== messageId) {
      cancelStreamingRender();
      streamingMessageIdRef.current = messageId;
      streamingQueueRef.current = "";
      streamingRenderedContentRef.current = "";
      streamingLastRenderAtRef.current = 0;
    }

    streamingQueueRef.current += delta;

    if (streamingFrameRef.current === null) {
      streamingFrameRef.current = window.requestAnimationFrame(pumpStreamingContent);
    }
  }, [cancelStreamingRender, pumpStreamingContent]);

  useEffect(() => {
    return () => {
      cancelStreamingRender();
    };
  }, [cancelStreamingRender]);

  const resolveChatbotProxyBaseUrl = () => {
    const raw = chatbotProxyBaseUrl?.trim();
    if (!raw) {
      throw new Error("VITE_CHATBOT_PROXY_URL nao configurada. Defina a URL da bridge.");
    }
    try {
      return new URL(raw).toString().replace(/\/$/, "");
    } catch {
      throw new Error("VITE_CHATBOT_PROXY_URL invalida.");
    }
  };

  const getAccessToken = async () => {
    if (session?.access_token) return session.access_token;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error("Sessão inválida. Faça login novamente.");
    }
    return data.session.access_token;
  };

  const refreshAccessToken = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) {
      return null;
    }
    return data.session.access_token;
  };

  const confidenceBadges = confidenceScore !== null && !isRetrievingContext && contextStatus === "ok" ? (
    <div className="flex items-center gap-2 self-center animate-in fade-in zoom-in duration-300 mb-4">
      <div className={cn(
        "flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border shadow-sm",
        confidenceScore >= 0.8 
          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
          : confidenceScore >= 0.6 
            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
            : "bg-red-50 text-red-700 border-red-200"
      )}>
          <Target className="w-3 h-3" />
          <span>
            Confiança: {Math.round(confidenceScore * 100)}% 
            {confidenceScore < 0.6 && " (Baixa)"}
          </span>
      </div>

      {reviewState && reviewState !== "clean" && (
        <div className={cn(
          "flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border shadow-sm",
            reviewState === "revised" 
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-orange-50 text-orange-700 border-orange-200"
        )}>
            <Sparkles className="w-3 h-3" />
            <span>
              {reviewState === "revised" ? "Resposta Revisada" : "Atenção na Revisão"}
            </span>
        </div>
      )}
    </div>
  ) : null;

  const createAttachmentId = () => {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const revokePreviewUrl = (url?: string) => {
    if (!url) return;
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  const handlePickFiles = (files: FileList) => {
    const maxFiles = CHAT_PROXY_MAX_ATTACHMENTS;
    const selected = Array.from(files);

    const next: ComposerAttachment[] = [];
    for (const file of selected) {
      const validation = validateAttachmentFile(file);
      if (!validation.success) {
        toast.error("Anexo invalido", { description: validation.error });
        continue;
      }

      const isImage = file.type.startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      next.push({
        id: createAttachmentId(),
        file,
        previewUrl,
        kind: isImage ? "image" : "file",
      });
    }

    if (next.length === 0) return;

    setAttachments((prev) => {
      const combined = [...prev, ...next].slice(0, maxFiles);
      if (combined.length < prev.length + next.length) {
        toast.message("Limite de anexos", { description: `Máximo de ${maxFiles} anexos por mensagem.` });
        for (const removed of [...prev, ...next].slice(combined.length)) revokePreviewUrl(removed.previewUrl);
      }
      return combined;
    });
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      revokePreviewUrl(target?.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const uploadAttachments = async (sessionId: string) => {
    if (!user) return { storedParts: [] as ChatMessageFilePart[] };
    if (attachments.length === 0) return { storedParts: [] as ChatMessageFilePart[] };

    setIsUploadingAttachments(true);
    try {
      const uploaded = await uploadChatAttachments({
        attachments,
        sessionId,
        userId: user.id,
      });
      for (const att of attachments) revokePreviewUrl(att.previewUrl);
      setAttachments([]);
      return uploaded;
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !user || isUploadingAttachments) return;

    const currentInput = input;
    const currentImageGenerationMode = imageGenerationMode;
    const currentImageGenerationOptions = imageGenerationOptions;
    setInput("");

    let activeSessionId = currentSessionId;
    let assistantTempId: string | null = null;
    let assistantContent = "";
    const assistantFiles: ChatMessageFilePart[] = [];
    const assistantArtifacts: ChatMessageArtifactPart[] = [];
    let receivedFirstDelta = false;
    let persistedUserMessage = false;

    try {
      if (!activeSessionId) {
        const titleBase = currentInput.trim()
          ? currentInput.trim()
          : attachments[0]?.file.name
            ? `Arquivo: ${attachments[0].file.name}`
            : "Nova conversa";
        const newSession = await chatService.createSession(user.id, titleBase.slice(0, 30) + "...");
        activeSessionId = newSession.id;
        setSearchParams({ chat: activeSessionId });
      }

      if (!activeSessionId) {
        throw new Error("Sessão inválida do chat.");
      }

      const { storedParts } = await uploadAttachments(activeSessionId);
      const userMessageParts: ChatMessagePart[] = [];
      if (currentInput.trim()) {
        userMessageParts.push(createTextPart(currentInput.trim()));
      }
      userMessageParts.push(...storedParts);

      const messageForStorage = serializeChatMessageContent(userMessageParts);
      const proxyPayload = buildChatProxyPayload({
        sessionId: activeSessionId,
        messageText: currentInput.trim(),
        attachments: storedParts,
        imageGeneration: currentImageGenerationMode ? currentImageGenerationOptions : null,
      });
      if (!proxyPayload.message_text && !proxyPayload.attachments?.length && !messageForStorage) return;

      setIsTyping(true);
      setIsRetrievingContext(true);
      setLiveStatusText("Hermes está preparando a resposta...");
      setContextStatus(null);
      setConfidenceScore(null);
      setReviewState(null);

      const tempId = Date.now().toString();
      setMessages((prev) => [...prev, {
        id: tempId,
        role: "user",
        content: messageForStorage || proxyPayload.message_text,
        created_at: new Date().toISOString(),
      }]);

      await chatService.addMessage(activeSessionId, "user", messageForStorage || proxyPayload.message_text);
      persistedUserMessage = true;

      const assistantId = (Date.now() + 1).toString();
      assistantTempId = assistantId;
      setActiveStreamingMessageId(assistantId);
      streamingMessageIdRef.current = assistantId;
      streamingQueueRef.current = "";
      streamingRenderedContentRef.current = "";
      streamingLastRenderAtRef.current = 0;
      cancelStreamingRender();
      setMessages((prev) => [...prev, {
        id: assistantId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      }]);

      await sendMessageToChatbotStream({
        payload: proxyPayload,
        getAccessToken,
        refreshAccessToken,
        signOut,
        resolveChatbotProxyBaseUrl,
        onDelta: (delta) => {
          assistantContent += delta;
          if (!receivedFirstDelta) {
            receivedFirstDelta = true;
            setIsRetrievingContext(false);
            setLiveStatusText(null);
          }
          enqueueStreamingDelta(assistantId, delta);
        },
        onMeta: (meta) => {
          if (meta.context_status === "refining") {
            return;
          }
          setIsRetrievingContext(false);

          if (meta.context_status === "insufficient") {
            setContextStatus("insufficient");
          } else if (meta.context_status === "ok") {
            setContextStatus("ok");
          }

          if (typeof meta.confidence_score === "number") {
            setConfidenceScore(meta.confidence_score as number);
          }
          if (typeof meta.review_state === "string") {
            setReviewState(meta.review_state as string);
          }
        },
        onStatus: (status) => {
          setLiveStatusText(status.text);
        },
        onFiles: (files) => {
          files.forEach((file) => {
            if (!assistantFiles.some((existing) => existing.url === file.url && existing.name === file.name)) {
              assistantFiles.push(file);
            }
          });
        },
        onArtifact: (artifact) => {
          const nextArtifact = createArtifactPart(artifact);
          if (
            !assistantArtifacts.some((existing) => (
              existing.title === nextArtifact.title &&
              existing.content === nextArtifact.content &&
              existing.artifactType === nextArtifact.artifactType
            ))
          ) {
            assistantArtifacts.push(nextArtifact);
          }
        },
      });

      if (!assistantContent.trim() && assistantFiles.length === 0 && assistantArtifacts.length === 0) {
        throw new Error("Resposta vazia da IA.");
      }

      const assistantParts: ChatMessagePart[] = [];
      if (assistantContent.trim()) assistantParts.push(createTextPart(assistantContent));
      assistantParts.push(...assistantFiles);
      assistantParts.push(...assistantArtifacts);

      const finalAssistantContent = serializeChatMessageContent(assistantParts) || assistantContent;
      flushStreamingContent(assistantId, finalAssistantContent);
      await chatService.addMessage(activeSessionId, "assistant", finalAssistantContent);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      const errorContent = assistantContent
        ? `${assistantContent}\n\n⚠️ **Erro de Conexão**: O Nexus AI está analisando muitos documentos agora ou houve uma falha na rede. Por favor, tente perguntar novamente em alguns instantes.`
        : "⚠️ **Erro de Conexão**: O Nexus AI está analisando muitos documentos agora ou houve uma falha na rede. Por favor, tente perguntar novamente em alguns instantes.";

      if (assistantTempId) {
        flushStreamingContent(assistantTempId, errorContent);
      } else {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: errorContent,
          created_at: new Date().toISOString(),
        }]);
      }

      if (!persistedUserMessage) {
        setInput(currentInput);
      }
      toast.error(errorMessage);
    } finally {
      streamingMessageIdRef.current = null;
      streamingQueueRef.current = "";
      streamingRenderedContentRef.current = "";
      cancelStreamingRender();
      setActiveStreamingMessageId(null);
      setIsTyping(false);
      setIsRetrievingContext(false);
      setLiveStatusText(null);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 relative">
      {/* Sidebar de Histórico */}
      <ChatHistorySidebar 
        isOpen={isHistoryOpen}
        onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={createNewSession}
      />

      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 ml-0 h-full min-h-0",
          isHistoryOpen ? "md:ml-64" : "md:ml-12",
          isEmpty ? "overflow-y-auto" : "overflow-hidden",
        )}
      >
        <div
          className={cn(
            "max-w-5xl mx-auto flex flex-col w-full",
            isEmpty ? "min-h-full" : "h-full min-h-0",
          )}
        >
          {isEmpty ? (
            <ChatEmptyState
              input={input}
              onInputChange={setInput}
              onSubmit={handleSend}
              onKeyDown={handleComposerKeyDown}
              suggestionCards={suggestionCards}
              attachments={attachments}
              menuItems={composerMenuItems}
              imageGenerationMode={imageGenerationMode}
              imageGenerationOptions={imageGenerationOptions}
              onImageGenerationOptionsChange={setImageGenerationOptions}
              onExitImageGenerationMode={() => setImageGenerationMode(false)}
              onPickFiles={handlePickFiles}
              onRemoveAttachment={handleRemoveAttachment}
            />
          ) : (
            <div className="space-y-6 overflow-y-auto p-4 md:p-8 flex-1 flex flex-col min-h-0">
                {(isRetrievingContext || (showPendingAssistantIndicator && liveStatusText)) && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary bg-white/70 border border-white/40 px-3 py-2 rounded-full self-center animate-pulse">
                    <Sparkles className="w-3 h-3 text-brand-primary" />
                    <span>{liveStatusText ?? "Hermes está processando sua mensagem..."}</span>
                  </div>
                )}
                
                {contextStatus === "insufficient" && (
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50/80 border border-amber-200/60 px-3 py-2 rounded-full self-center">
                    <AlertCircle className="w-4 h-4" />
                    <span>Contexto insuficiente. A IA fez uma pergunta de clarificação.</span>
                  </div>
                )}

                {hasMoreHistory && (
                  <div className="flex justify-center mb-4">
                    <Button
                      variant="ghost"
                      onClick={loadOlderMessages}
                      disabled={isLoadingMore}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      {isLoadingMore ? "Carregando..." : "Carregar mensagens anteriores"}
                    </Button>
                  </div>
                )}
                {displayMessages.map((message, index) => (
                  <Fragment key={message.id}>
                    {index === lastAssistantIndex && confidenceBadges}
                    <div
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-6 py-4",
                          message.role === "user" ? "chat-user-bubble text-white" : "glass-surface shadow-glass",
                        )}
                      >
                        {message.role === "assistant" && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center">
                              <Sparkles className="w-3 h-3 text-brand-primary" />
                            </div>
                            <span className="text-xs font-medium text-text-muted">Nexus AI</span>
                          </div>
                        )}
                        <ChatMessageContent
                          role={message.role}
                          content={message.content}
                          isStreaming={message.id === activeStreamingMessageId}
                        />
                      </div>
                    </div>
                  </Fragment>
                ))}

                {showPendingAssistantIndicator && (
                  <div className="flex justify-start">
                    <div className="glass-surface rounded-2xl px-6 py-4 shadow-glass">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-primary animate-bounce" />
                        <div className="w-2 h-2 rounded-full bg-brand-primary animate-bounce delay-75" />
                        <div className="w-2 h-2 rounded-full bg-brand-primary animate-bounce delay-150" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
            </div>
          )}

          {!isEmpty && (
            <div className="px-4 md:px-8 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <ChatComposer
                value={input}
                onChange={setInput}
                onKeyDown={handleComposerKeyDown}
                onSubmit={handleSend}
                placeholder="Diga o que você quer criar hoje para sua marca..."
                attachments={attachments}
                menuItems={composerMenuItems}
                imageGenerationMode={imageGenerationMode}
                imageGenerationOptions={imageGenerationOptions}
                onImageGenerationOptionsChange={setImageGenerationOptions}
                onExitImageGenerationMode={() => setImageGenerationMode(false)}
                onPickFiles={handlePickFiles}
                onRemoveAttachment={handleRemoveAttachment}
                disabled={isTyping || isUploadingAttachments}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
