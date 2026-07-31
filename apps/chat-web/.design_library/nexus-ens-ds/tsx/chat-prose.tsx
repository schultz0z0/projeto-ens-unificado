import * as React from "react";
import { cn } from "./lib";

/**
 * ChatProse — markdown surface used inside chat-message.
 * Renders arbitrary HTML produced by react-markdown with a fixed style.
 * For dynamic markdown parsing, see `chat-message.tsx` integration.
 */
export interface ChatProseProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tone controls link color: assistant uses brand, user uses white. */
  tone?: "assistant" | "user";
}

export const ChatProse = React.forwardRef<HTMLDivElement, ChatProseProps>(
  ({ className, tone = "assistant", children, ...props }, ref) => (
    <div
      ref={ref}
      data-tone={tone}
      className={cn("chat-prose", tone === "user" && "text-white", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
ChatProse.displayName = "ChatProse";
