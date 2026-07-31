import * as React from "react";
import { FileText, FileCode2, ExternalLink } from "lucide-react";
import { cn } from "./lib";
import { Button } from "./button";

/**
 * ChatArtifact — collapsible card for code/markdown/html artifacts produced
 * by the assistant. Mirrors the original `ChatMessageContent` artifact block.
 */
export interface ChatArtifactProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  /** "markdown" | "html" | "code" | "text" — controls label and icon. */
  artifactType?: "markdown" | "html" | "code" | "text";
  language?: string;
  fileName?: string;
  content: string;
  onOpen?: () => void;
}

export const ChatArtifact = React.forwardRef<HTMLElement, ChatArtifactProps>(
  (
    { className, title, artifactType = "markdown", language, content, onOpen, ...props },
    ref,
  ) => {
    const isMarkdown = artifactType === "markdown";
    const Icon = isMarkdown ? FileText : FileCode2;
    const label = isMarkdown
      ? "Documento"
      : artifactType === "html"
        ? "Artifact HTML"
        : artifactType === "code"
          ? "Código"
          : "Artifact";

    return (
      <aside
        ref={ref}
        className={cn("chat-artifact", className)}
        aria-label={`Artifact: ${title}`}
        {...props}
      >
        <div className="chat-artifact__head">
          <div>
            <div className="chat-artifact__title">
              <Icon aria-hidden="true" />
              <span>{title}</span>
            </div>
            <p className="chat-artifact__meta">
              {label}
              {language ? ` • ${language}` : ""}
            </p>
          </div>
          {onOpen ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpen}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              Abrir
            </Button>
          ) : null}
        </div>
        <pre className="chat-artifact__body">
          <code>{content}</code>
        </pre>
      </aside>
    );
  },
);
ChatArtifact.displayName = "ChatArtifact";
