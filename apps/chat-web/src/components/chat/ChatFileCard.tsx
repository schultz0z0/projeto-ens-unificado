import { Copy, Download, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { refreshChatAttachmentUrl } from "@/lib/chatAttachments";
import { getFileExtension, type ChatMessageFilePart } from "@/lib/chatMessageParts";
import { cn } from "@/lib/utils";
import { isAllowedStreamFileUrl, isSafeRenderableImage } from "./chatStreamFileSafety";

type ChatFileCardProps = {
  part: ChatMessageFilePart;
  role: "user" | "assistant";
};

export function ChatFileCard({ part, role }: ChatFileCardProps) {
  const isUser = role === "user";
  const isImage = isSafeRenderableImage(part);
  const extension = getFileExtension(part.name || part.url);

  const getActiveUrl = async () => {
    const refreshedPart = await refreshChatAttachmentUrl(part).catch(() => part);
    if (!isAllowedStreamFileUrl(refreshedPart.url)) {
      throw new Error("unsafe_file_url");
    }
    return refreshedPart.url;
  };

  const handleOpen = async () => {
    try {
      const url = await getActiveUrl();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível abrir o arquivo.");
    }
  };

  const handleDownload = async () => {
    try {
      const url = await getActiveUrl();
      const link = document.createElement("a");
      link.href = url;
      link.download = part.name;
      link.rel = "noopener noreferrer";
      link.click();
    } catch {
      toast.error("Não foi possível baixar o arquivo.");
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = await getActiveUrl();
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        isUser ? "border-white/20 bg-white/10" : "border-slate-200/70 bg-white/70",
      )}
    >
      {isImage ? (
        <button type="button" onClick={handleOpen} className="block w-full text-left">
          <div className={cn("overflow-hidden", isUser ? "bg-white/10" : "bg-slate-100/80")}>
            <img src={part.url} alt={part.name} className="max-h-[280px] w-full object-cover" />
          </div>
        </button>
      ) : null}

      <div className="flex items-center gap-3 p-3">
        <div
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-xl border",
            isUser ? "border-white/20 bg-white/10" : "border-slate-200 bg-white",
          )}
        >
          {isImage ? (
            <ImageIcon className={cn("h-5 w-5", isUser ? "text-white" : "text-slate-700")} />
          ) : (
            <FileText className={cn("h-5 w-5", isUser ? "text-white" : "text-slate-700")} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium", isUser ? "text-white" : "text-slate-900")}>{part.name}</p>
          <p className={cn("text-xs", isUser ? "text-white/80" : "text-slate-600")}>
            {isImage ? "Imagem" : "Arquivo"}
            {extension ? ` • ${extension.toUpperCase()}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className={cn("h-9 w-9 rounded-full", isUser ? "hover:bg-white/20" : "hover:bg-slate-100")} onClick={handleOpen} aria-label={`Abrir ${part.name}`}>
            <ExternalLink className="h-4 w-4" />
          </Button>

          <Button type="button" size="icon" variant="ghost" className={cn("h-9 w-9 rounded-full", isUser ? "hover:bg-white/20" : "hover:bg-slate-100")} onClick={handleDownload} aria-label={`Baixar ${part.name}`}>
            <Download className="h-4 w-4" />
          </Button>

          <Button type="button" size="icon" variant="ghost" className={cn("h-9 w-9 rounded-full", isUser ? "hover:bg-white/20" : "hover:bg-slate-100")} onClick={handleCopyLink} aria-label={`Copiar link de ${part.name}`}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
