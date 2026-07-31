import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib";

/**
 * ChatStatus — pill used to communicate live status (Hermes processing),
 * insufficient context, or success/danger states.
 */
const chatStatusVariants = cva(
  "chat-status",
  {
    variants: {
      tone: {
        default: "",
        info: "",
        warning: "warning",
        danger: "danger",
        success: "success",
      },
      pulse: {
        true: "",
        false: "[&_.pulse]:hidden",
      },
    },
    defaultVariants: { tone: "info", pulse: true },
  },
);

export { chatStatusVariants };

export interface ChatStatusProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatStatusVariants> {}

export const ChatStatus = React.forwardRef<HTMLDivElement, ChatStatusProps>(
  ({ className, tone, pulse, children, ...props }, ref) => (
    <div
      ref={ref}
      data-tone={tone}
      className={cn(chatStatusVariants({ tone, pulse }), className)}
      {...props}
    >
      <span className="pulse" aria-hidden="true" />
      <span>{children}</span>
    </div>
  ),
);
ChatStatus.displayName = "ChatStatus";
