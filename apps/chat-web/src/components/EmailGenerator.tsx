import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Download, RotateCcw, Bot, User, Loader2, Sparkles, Code, Layout } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { generateEmailMarketing } from "@/lib/n8n-service";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const EmailGenerator = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const key = `email_generator_state_${user?.id || "anonymous"}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
        if (typeof parsed.htmlContent === "string") setHtmlContent(parsed.htmlContent);
        if (typeof parsed.input === "string") setInput(parsed.input);
      } catch (_) {
        localStorage.removeItem(key);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    const key = `email_generator_state_${user?.id || "anonymous"}`;
    const data = JSON.stringify({ messages, htmlContent, input });
    localStorage.setItem(key, data);
  }, [messages, htmlContent, input, user?.id]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const currentInput = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: currentInput,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);

    try {
      // Chama o serviço mockado (futura integração n8n)
      const response = await generateEmailMarketing({
        userId: user?.id || "anonymous",
        message: currentInput,
        history: messages,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Gerei uma nova versão do seu e-mail com o assunto: "${response.suggestedSubject}". Confira ao lado!`,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setHtmlContent(response.html);
      toast.success("E-mail gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar e-mail. Tente novamente.");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setHtmlContent(null);
    setInput("");
    const key = `email_generator_state_${user?.id || "anonymous"}`;
    localStorage.removeItem(key);
    toast.info("Histórico e preview limpos.");
  };

  const handleDownload = () => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email-marketing-ens.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download iniciado!");
  };

  return (
    <div className="max-w-7xl mx-auto pt-2 pb-10">
      <div className="text-center mb-6 md:mb-10">
        <h2 className="text-3xl font-bold text-text-primary">
          Gerador de E-mail Marketing
        </h2>
        <p className="text-text-secondary">
          Crie campanhas de e-mail profissionais com HTML personalizado
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 sm:px-6 lg:px-0 items-start">
        {/* Bloco 1: Chatbot */}
        <div className="glass-surface rounded-3xl flex flex-col shadow-glass overflow-hidden border border-white/20">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-brand-primary" />
              <span className="font-semibold text-text-primary">Assistente de Criação</span>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                title="Zerar conversa"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Zerar Tudo
              </Button>
            )}
          </div>

          <div className="p-4 space-y-4 bg-slate-50/50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center p-8 opacity-60 min-h-[260px] sm:min-h-[300px]">
                <Sparkles className="w-12 h-12 text-brand-primary mb-4" />
                <p className="text-text-secondary">
                  Descreva o objetivo do seu e-mail e eu criarei o código HTML para você.
                </p>
                <p className="text-xs text-text-muted mt-2">
                  Ex: "Crie um e-mail de boas-vindas para novos alunos de MBA."
                </p>
              </div>
            )}
            
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-brand-primary text-white"
                      : "bg-white border border-slate-200 text-slate-800 shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                  <span className="text-xs text-slate-500">Gerando HTML...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white/40 border-t border-white/20">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ex: Altere o botão para verde..."
                disabled={isGenerating}
                className="bg-white border-white/20 focus-visible:ring-brand-primary"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bloco 2: Preview */}
        <div className="glass-surface rounded-3xl flex flex-col shadow-glass overflow-hidden border border-white/20">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-brand-primary" />
              <span className="font-semibold text-text-primary">Pré-visualização</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!htmlContent}
              className="border-brand-primary/20 text-brand-primary hover:bg-brand-primary/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar HTML
            </Button>
          </div>

          <div className="bg-slate-100 relative overflow-hidden h-[420px] sm:h-[520px] lg:h-[600px]">
            {htmlContent ? (
              <iframe
                srcDoc={htmlContent}
                className="w-full h-full border-none bg-white"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-200/50 flex items-center justify-center mb-4">
                  <Layout className="w-8 h-8" />
                </div>
                <p>O preview do seu e-mail aparecerá aqui.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
