import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Sparkles } from "lucide-react";
import { cn } from "./lib";
import { ChatProse } from "./chat-prose";
import { ChatTyping } from "./chat-typing";
import { ChatStatus, type ChatStatusProps } from "./chat-status";
import { ChatConfidence, type ChatConfidenceProps } from "./chat-confidence";
import { ChatArtifact, type ChatArtifactProps } from "./chat-artifact";
import { ChatAttachmentCard, type ChatAttachment } from "./chat-attachment-card";

/**
 * ChatMessage — composes header (avatar + author), markdown prose, optional
 * status pill, artifact, attachments and a typing/streaming indicator.
 *
 * This is the chat-web equivalent of `src/components/ChatMessageContent.tsx`
 * (the body) + the bubble shell from `ChatInterface.tsx`.
 */
const chatBubbleVariants = cva("chat-bubble", {
  variants: {
    role: {
      user: "user chat-user-bubble",
      assistant: "assistant chat-assistant-bubble",
    },
  },
  defaultVariants: { role: "assistant" },
});

export interface ChatArtifactData extends ChatArtifactProps {}

/** Map of the CVA `role` variants to avoid clash with the HTML `role` attr. */
type ChatRole = NonNullable<VariantProps<typeof chatBubbleVariants>["role"]>;

export interface ChatMessageProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children" | "role"> {
  /** CVA role variant — distinct from the HTML `role` attribute. */
  role?: ChatRole;
  /** Author label rendered above the body (assistant only). */
  author?: string;
  /** ISO timestamp or pre-formatted string. */
  timestamp?: string;
  /** Body — either a string (rendered as plain prose) or React markdown. */
  children: React.ReactNode;
  /** Optional attachment list rendered before the children. */
  attachments?: ChatAttachment[];
  /** Optional inline status pill. */
  status?: React.ReactNode | ChatStatusProps["children"];
  /** Optional artifact card. */
  artifact?: ChatArtifactData;
  /** Show typing indicator instead of body content. */
  isTyping?: boolean;
  /** Show streaming cursor at the end. */
  isStreaming?: boolean;
}

export const ChatMessage = React.forwardRef<HTMLElement, ChatMessageProps>(
  (
    {
      className,
      role,
      author = "Nexus AI",
      timestamp,
      children,
      attachments,
      status,
      artifact,
      isTyping,
      isStreaming,
      ...props
    },
    ref,
  ) => {
    const isAssistant = role === "assistant";

    return (
      <article
        ref={ref}
        role="article"
        aria-label={`Mensagem de ${isAssistant ? author : "você"}`}
        className={cn(chatBubbleVariants({ role }), className)}
        {...props}
      >
        {isAssistant ? (
          <header className="chat-bubble__header">
            <span className="chat-bubble__avatar" aria-hidden="true">
              <Sparkles />
            </span>
            <span className="chat-bubble__author">{author}</span>
          </header>
        ) : null}

        {attachments?.map((att) => (
          <ChatAttachmentCard key={att.url + att.name} role={role} {...att} />
        ))}

        {isTyping ? (
          <ChatTyping />
        ) : (
          <ChatProse tone={isAssistant ? "assistant" : "user"}>{children}</ChatProse>
        )}

        {artifact ? <ChatArtifact {...artifact} /> : null}

        {status ? (
          typeof status === "string" ? <ChatStatus tone="info">{status}</ChatStatus> : status
        ) : null}

        {isStreaming && !isTyping ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/5 px-2 py-1 text-xs text-text-muted">
            <span
              className="inline-block h-4 w-1.5 animate-pulse rounded-full bg-brand-primary"
              aria-hidden="true"
            />
            <span>Hermes digitando…</span>
          </div>
        ) : null}

        {timestamp ? <span className="time">{timestamp}</span> : null}
      </article>
    );
  },
);
ChatMessage.displayName = "ChatMessage";

// Helper alias for consumers
export type ChatMessageComponentProps = ChatMessageProps;
