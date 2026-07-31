import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Download, ExternalLink, FileText, Image as ImageIcon, Maximize2, X } from "lucide-react";
import { cn } from "./lib";

/**
 * ChatAttachmentCard — file/image/video attachment rendered inside a chat message.
 * Adapts chrome for `user` (translucent over brand gradient) and `assistant`
 * (solid light). The `kind` controls whether to show an image preview, video
 * player or file icon.
 */
const chatAttachmentVariants = cva("chat-attachment", {
  variants: {
    role: {
      assistant: "",
      user: "user",
    },
  },
  defaultVariants: { role: "assistant" },
});

export interface ChatAttachment
  extends Omit<React.HTMLAttributes<HTMLElement>, "role"> {
  /** Display name shown in the meta row. */
  name: string;
  /** Public/preview URL (also used for downloads). */
  url: string;
  /** Attachment kind — controls the preview surface. */
  kind: "image" | "video" | "file";
  /** Optional file extension (e.g. "PNG", "PDF"). Shown next to kind. */
  extension?: string;
  /** Optional file size string (e.g. "1.2 MB"). */
  size?: string;
  /** Storage path used for refresh — kept for parity with the source. */
  storagePath?: string;
  /** Artifact ID used for refresh — kept for parity with the source. */
  artifactId?: string;
  onOpen?: () => void;
  onDownload?: () => void;
  onRemove?: () => void;
}

export interface ChatAttachmentCardProps
  extends ChatAttachment,
    VariantProps<typeof chatAttachmentVariants> {}

export const ChatAttachmentCard = React.forwardRef<HTMLElement, ChatAttachmentCardProps>(
  (
    { className, role, name, url, kind, extension, size, onOpen, onDownload, onRemove, ...props },
    ref,
  ) => {
    const isImage = kind === "image";
    const isVideo = kind === "video";
    const Icon = isImage ? ImageIcon : FileText;
    const meta = [
      isImage ? "Imagem" : isVideo ? "Vídeo" : "Arquivo",
      extension ? extension.toUpperCase() : null,
      size || null,
    ]
      .filter(Boolean)
      .join(" • ");

    return (
      <article
        ref={ref}
        className={cn(chatAttachmentVariants({ role }), className)}
        aria-label={`Anexo: ${name}`}
        {...props}
      >
        {isImage ? (
          <button
            type="button"
            onClick={onOpen}
            className="block w-full text-left"
            aria-label={`Ampliar ${name}`}
          >
            <img src={url} alt={name} className="chat-attachment__preview" />
          </button>
        ) : null}

        {isVideo ? (
          <video src={url} controls preload="metadata" className="chat-attachment__preview" />
        ) : null}

        <div className="chat-attachment__row">
          <div className="chat-attachment__icon" aria-hidden="true">
            <Icon />
          </div>
          <div className="chat-attachment__body">
            <p className="chat-attachment__name" title={name}>{name}</p>
            <p className="chat-attachment__meta">{meta}</p>
          </div>
          <div className="chat-attachment__actions">
            {onOpen ? (
              <button
                type="button"
                className="chat-attachment__btn"
                onClick={onOpen}
                aria-label={isImage ? `Ampliar ${name}` : `Abrir ${name}`}
              >
                {isImage ? <Maximize2 /> : <ExternalLink />}
              </button>
            ) : null}
            {onDownload ? (
              <button
                type="button"
                className="chat-attachment__btn"
                onClick={onDownload}
                aria-label={`Baixar ${name}`}
              >
                <Download />
              </button>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                className="chat-attachment__btn"
                onClick={onRemove}
                aria-label={`Remover ${name}`}
              >
                <X />
              </button>
            ) : null}
          </div>
        </div>
      </article>
    );
  },
);
ChatAttachmentCard.displayName = "ChatAttachmentCard";
