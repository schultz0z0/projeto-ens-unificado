import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib";
import { Target, Sparkles } from "lucide-react";

/**
 * ChatConfidence — confidence / review badge displayed after the last assistant
 * message. Variants map directly to the underlying `.chat-confidence` class.
 */
const chatConfidenceVariants = cva("chat-confidence", {
  variants: {
    tone: {
      high: "",          // >= 0.8  → success
      medium: "warning", // 0.6–0.8 → warning
      low: "danger",     // < 0.6   → danger
    },
    icon: {
      confidence: "target",
      review: "sparkles",
    },
  },
  defaultVariants: { tone: "high", icon: "confidence" },
});

export { chatConfidenceVariants };

export interface ChatConfidenceProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof chatConfidenceVariants> {
  /** Text rendered inside the badge. */
  label: string;
}

export const ChatConfidence = React.forwardRef<HTMLSpanElement, ChatConfidenceProps>(
  ({ className, tone, icon, label, ...props }, ref) => {
    const Icon = icon === "review" ? Sparkles : Target;
    return (
      <span ref={ref} className={cn(chatConfidenceVariants({ tone, icon }), className)} {...props}>
        <Icon aria-hidden="true" />
        {label}
      </span>
    );
  },
);
ChatConfidence.displayName = "ChatConfidence";
