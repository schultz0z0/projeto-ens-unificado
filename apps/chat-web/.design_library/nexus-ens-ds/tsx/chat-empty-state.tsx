import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Share2, Target, Mail, Search } from "lucide-react";
import { cn } from "./lib";

/**
 * ChatEmptyState — hero shown when there is no active conversation. Composes
 * a mascot block, headline, suggestion grid, and a composer slot. Mirrors
 * `src/components/ChatEmptyState.tsx` but stops at the boundary of business
 * logic: the consumer owns the suggestion list, the click handler, and the
 * composer implementation.
 */
export interface ChatSuggestion {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  prompt: string;
}

export interface ChatEmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  title?: string;
  lead?: string;
  mascotLabel?: string;
  suggestions: ChatSuggestion[];
  onSelectSuggestion?: (suggestion: ChatSuggestion) => void;
  /** Composer slot — usually a `<ChatComposer />`. */
  composer?: React.ReactNode;
  /** When true, hides the suggestion grid (useful for short viewports). */
  hideSuggestions?: boolean;
}

export const ChatEmptyState = React.forwardRef<HTMLElement, ChatEmptyStateProps>(
  (
    {
      className,
      title = "Inteligência que conhece o mercado de seguros.",
      lead = "Crie estratégias, redações e peças visuais em segundos com a curadoria da ENS.",
      mascotLabel = "N",
      suggestions,
      onSelectSuggestion,
      composer,
      hideSuggestions,
      ...props
    },
    ref,
  ) => {
    return (
      <section
        ref={ref}
        aria-label="Iniciar nova conversa"
        className={cn("chat-empty", className)}
        {...props}
      >
        <div className="chat-empty__hero">
          <div className="chat-empty__mascot" aria-hidden="true">
            {mascotLabel}
          </div>
          <h1 className="chat-empty__title">{title}</h1>
          <p className="chat-empty__lead">{lead}</p>
        </div>

        {!hideSuggestions && suggestions.length > 0 ? (
          <div className="chat-empty__grid" role="list">
            {suggestions.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="listitem"
                  className="chat-suggestion"
                  onClick={() => onSelectSuggestion?.(s)}
                  aria-label={`Sugestão: ${s.title}`}
                >
                  <span className="chat-suggestion__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span>
                    <span className="chat-suggestion__title">{s.title}</span>
                    <span className="chat-suggestion__desc">{s.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {composer ? <div className="chat-empty__composer">{composer}</div> : null}
      </section>
    );
  },
);
ChatEmptyState.displayName = "ChatEmptyState";

// Pre-built defaults so consumers don't have to import lucide icons manually.
export const DEFAULT_SUGGESTIONS: ChatSuggestion[] = [
  {
    id: "social",
    title: "Redes Sociais",
    desc: "Crie posts, legendas e stories virais",
    icon: Share2,
    prompt: "Crie um calendário de conteúdo para Instagram focado em seguros...",
  },
  {
    id: "strategy",
    title: "Estratégia",
    desc: "Planejamento mensal e análise de mercado",
    icon: Target,
    prompt: "Desenvolva uma estratégia de marketing mensal para corretora...",
  },
  {
    id: "email",
    title: "Campanha de E-mail",
    desc: "Newsletters e funis de venda automáticos",
    icon: Mail,
    prompt: "Escreva uma sequência de e-mails para renovação de seguro...",
  },
  {
    id: "seo",
    title: "SEO & Blog",
    desc: "Artigos otimizados para busca orgânica",
    icon: Search,
    prompt: "Escreva um artigo de blog otimizado para SEO sobre seguro de vida...",
  },
];

// Re-export the icon types commonly used by consumers building a custom menu.
export type { LucideIcon };
