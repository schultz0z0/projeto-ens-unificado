import * as React from "react";
import { cn } from "./lib";
import { useReducedMotion } from "./hooks";

/**
 * ChatTyping — 3-dot bounce indicator (v2.0).
 * Adds `is-reduced` modifier when the user prefers reduced motion so the
 * CSS can swap the animation for a static "..." label.
 */
export interface ChatTypingProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ChatTyping = React.forwardRef<HTMLDivElement, ChatTypingProps>(
  ({ className, ...props }, ref) => {
    const reduced = useReducedMotion();
    return (
      <div
        ref={ref}
        className={cn("chat-typing", reduced && "is-reduced", className)}
        role="status"
        aria-label="Assistente digitando"
        {...props}
      >
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    );
  },
);
ChatTyping.displayName = "ChatTyping";
