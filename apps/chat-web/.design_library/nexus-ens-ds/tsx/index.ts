// ==========================================================================
// Nexus ENS Design System — v2.0 (a11y + portal + focus lock)
// React primitives mirroring `components/<slug>.html`.
// ==========================================================================

export { cn } from "./lib";

export { Button, buttonVariants, type ButtonProps } from "./button";

// A11y helpers (v2.0)
export {
  useReducedMotion,
  useEscapeKey,
  useFocusTrap,
  useScrollLock,
} from "./hooks";
export { Portal, type PortalProps } from "./portal";

// Chat surfaces (v1.1)
export {
  ChatMessage,
  type ChatMessageProps,
  type ChatMessageComponentProps,
  type ChatArtifactData,
} from "./chat-message";
export { ChatProse, type ChatProseProps } from "./chat-prose";
export { ChatTyping, type ChatTypingProps } from "./chat-typing";
export { ChatStatus, chatStatusVariants, type ChatStatusProps } from "./chat-status";
export { ChatConfidence, chatConfidenceVariants, type ChatConfidenceProps } from "./chat-confidence";
export { ChatArtifact, type ChatArtifactProps } from "./chat-artifact";
export {
  ChatAttachmentCard,
  type ChatAttachment,
  type ChatAttachmentCardProps,
} from "./chat-attachment-card";
export {
  ChatHistorySidebar,
  type ChatHistorySidebarProps,
  type ChatSession,
} from "./chat-history-sidebar";
export {
  ChatEmptyState,
  DEFAULT_SUGGESTIONS,
  type ChatEmptyStateProps,
  type ChatSuggestion,
} from "./chat-empty-state";

// Feedback (v1.3)
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { Skeleton, type SkeletonProps } from "./skeleton";
export { ErrorState, type ErrorStateProps } from "./error-state";
export { Toast, Toaster, type ToastProps, type ToastTone, type ToasterProps, type ToastPosition } from "./toast";

// Overlays (v1.3 — shadcn parity, v2.0 a11y upgrade)
export { Dialog, type DialogProps } from "./dialog";
export { Sheet, type SheetProps } from "./sheet";
export { Tabs, type TabsProps, type TabsItem } from "./tabs";
export { Tooltip, type TooltipProps } from "./tooltip";
