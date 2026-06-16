import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CHAT_COMPOSER_ACCEPTED_FILE_TYPES } from "@/lib/chatAttachmentPolicy";
import { FileText, Mic, Plus, Send, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ComposerMenuItem =
  | {
      key: string;
      label: string;
      icon: LucideIcon;
      kind: "action";
      onSelect: () => void;
      separatorAfter?: boolean;
    }
  | {
      key: "upload";
      label: string;
      icon: LucideIcon;
      kind: "upload";
      separatorAfter?: boolean;
    };

export type ComposerAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
  kind: "image" | "file";
};

type ChatComposerProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  attachments: ComposerAttachment[];
  menuItems: ComposerMenuItem[];
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onPickFiles: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
  onClickMic?: () => void;
  className?: string;
};

const maxComposerTextareaHeight = 240;

export function ChatComposer({
  value,
  placeholder = "Pergunte alguma coisa...",
  disabled,
  attachments,
  menuItems,
  onChange,
  onKeyDown,
  onSubmit,
  onPickFiles,
  onRemoveAttachment,
  onClickMic,
  className,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const canSend = useMemo(() => value.trim().length > 0 || attachments.length > 0, [attachments.length, value]);

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, maxComposerTextareaHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxComposerTextareaHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleFilesFromDataTransfer = useCallback((files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    onPickFiles(files);
  }, [disabled, onPickFiles]);

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !event.dataTransfer.types.includes("Files")) return;
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = () => {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    handleFilesFromDataTransfer(event.dataTransfer.files);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = event.clipboardData.files;
    if (!files || files.length === 0) return;
    event.preventDefault();
    handleFilesFromDataTransfer(files);
  };

  return (
    <div
      className={cn(
        "glass-surface chat-composer-radiant rounded-3xl p-4 shadow-glass relative overflow-hidden transition-all",
        isDragActive && "ring-2 ring-brand-primary/60 bg-brand-primary/5",
        className,
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        id="chat-composer-file-upload"
        name="chat-composer-file-upload"
        type="file"
        accept={CHAT_COMPOSER_ACCEPTED_FILE_TYPES}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          onPickFiles(files);
          e.currentTarget.value = "";
        }}
      />

      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-brand-primary/50 bg-white/65 backdrop-blur-sm">
          <p className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-800 shadow-sm">
            Solte seus arquivos aqui para anexar ao chat
          </p>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/30 px-2 py-2 shadow-sm"
            >
              {att.kind === "image" && att.previewUrl ? (
                <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/30 bg-white/30">
                  <img src={att.previewUrl} alt={att.file.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="h-12 w-12 grid place-items-center rounded-xl border border-white/30 bg-white/20">
                  <FileText className="h-5 w-5 text-slate-700" aria-hidden="true" />
                </div>
              )}

              <div className="min-w-0">
                <p className="max-w-[180px] truncate text-xs font-medium text-slate-800">{att.file.name}</p>
                <p className="text-[10px] text-slate-600">
                  {att.kind === "image" ? "Imagem" : "Arquivo"} • {(att.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover ${att.file.name}`}
                className="h-9 w-9 rounded-full hover:bg-white/40"
                onClick={() => onRemoveAttachment(att.id)}
              >
                <X className="h-4 w-4 text-slate-700" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Abrir ações rápidas"
              type="button"
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full glass-surface hover:scale-105 transition-transform"
              disabled={disabled}
            >
              <Plus className="w-5 h-5 text-text-muted" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="glass-surface border-white/20 bg-white/40 backdrop-blur-md shadow-glass min-w-[260px]"
          >
            {menuItems.map((item) => {
              const content = (
                <DropdownMenuItem
                  key={item.key}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (disabled) return;
                    if (item.kind === "upload") handleOpenFilePicker();
                    else item.onSelect();
                  }}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4 text-slate-700" aria-hidden="true" />
                  {item.label}
                </DropdownMenuItem>
              );

              return item.separatorAfter ? (
                <div key={`${item.key}-wrap`}>
                  {content}
                  <DropdownMenuSeparator className="bg-white/20" />
                </div>
              ) : (
                content
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          ref={textareaRef}
          id="chat-composer-message"
          name="chat-composer-message"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-10 resize-none overflow-hidden !border-0 !rounded-none bg-transparent px-0 py-2 text-base leading-6 !shadow-none outline-none ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        <Button
          aria-label="Gravar áudio"
          type="button"
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full glass-surface hover:scale-105 transition-transform"
          onClick={onClickMic}
          disabled={disabled}
        >
          <Mic className="w-5 h-5 text-text-muted" aria-hidden="true" />
        </Button>

        <Button
          aria-label="Enviar mensagem"
          type="button"
          onClick={onSubmit}
          disabled={disabled || !canSend}
          className="chat-send-button w-10 h-10 rounded-full shadow-glass hover:scale-105 transition-transform"
        >
          <Send className="w-5 h-5 text-white" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
