import * as React from "react";
import { Plus, MessageSquare, PanelLeftClose, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { cn } from "./lib";
import { Button } from "./button";

/**
 * ChatHistorySidebar — left-side session list. Pure presentational; the
 * consumer owns the data fetching and the rename/delete dialogs. Mirrors
 * `src/components/ChatHistorySidebar.tsx`.
 */
export interface ChatSession {
  id: string;
  title: string;
  /** ISO timestamp; formatted with `Intl.DateTimeFormat` (pt-BR). */
  updatedAt: string;
}

export interface ChatHistorySidebarProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onClose?: () => void;
  onRename?: (session: ChatSession) => void;
  onDelete?: (session: ChatSession) => void;
  loading?: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const ChatHistorySidebar = React.forwardRef<HTMLElement, ChatHistorySidebarProps>(
  (
    {
      className,
      sessions,
      currentSessionId,
      onSelectSession,
      onNewChat,
      onClose,
      onRename,
      onDelete,
      loading,
      ...props
    },
    ref,
  ) => {
    return (
      <aside
        ref={ref}
        aria-label="Histórico de conversas"
        className={cn("chat-history", className)}
        {...props}
      >
        <div className="chat-history__header">
          <span className="chat-history__title">Histórico</span>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="chat-history__close"
              onClick={onClose}
              aria-label="Fechar histórico"
            >
              <PanelLeftClose />
            </Button>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={onNewChat}
          className="chat-history__new"
          aria-label="Iniciar nova conversa"
        >
          <Plus />
          Novo Chat
        </Button>

        <div className="chat-history__list" role="list">
          {loading && sessions.length === 0 ? (
            <div className="chat-history__empty">
              <p>Carregando…</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="chat-history__empty">
              <p>Nenhuma conversa anterior.</p>
              <p>Inicie um novo chat para começar.</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              return (
                <div
                  key={session.id}
                  role="listitem"
                  aria-current={isActive ? "true" : undefined}
                  className={cn("chat-history__item", isActive && "is-active")}
                  onClick={() => onSelectSession(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectSession(session.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <MessageSquare className="chat-history__item-icon" aria-hidden="true" />
                  <div className="chat-history__item-body">
                    <p className="chat-history__item-title">{session.title}</p>
                    <p className="chat-history__item-time">
                      {dateFormatter.format(new Date(session.updatedAt))}
                    </p>
                  </div>
                  {onRename || onDelete ? (
                    <div
                      className="chat-history__item-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onRename ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Renomear ${session.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRename(session);
                          }}
                        >
                          <Pencil />
                        </Button>
                      ) : null}
                      {onDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir ${session.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(session);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                      <MoreVertical aria-hidden="true" style={{ display: "none" }} />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </aside>
    );
  },
);
ChatHistorySidebar.displayName = "ChatHistorySidebar";
