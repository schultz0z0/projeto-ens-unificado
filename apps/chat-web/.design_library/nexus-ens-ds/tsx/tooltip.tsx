import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib";
import { Portal } from "./portal";
import { useEscapeKey, useReducedMotion } from "./hooks";

/**
 * Tooltip — accessible popover (v2.0).
 *
 * v1.3 was pure CSS hover/focus. v2.0 adds:
 *  - Portal so the bubble is never clipped by `overflow: hidden` ancestors.
 *  - ESC dismisses when open.
 *  - `prefers-reduced-motion: reduce` shortens the open transition.
 *  - `disabled` prop suppresses the tooltip.
 *  - `delay` prop before showing (ms).
 */
const tooltipSideVariants = cva("", {
  variants: {
    side: {
      top:    "[&_.nexus-tooltip__bubble]:data-[side=top]",
      bottom: "[&_.nexus-tooltip__bubble]:data-[side=bottom]",
      left:   "[&_.nexus-tooltip__bubble]:data-[side=left]",
      right:  "[&_.nexus-tooltip__bubble]:data-[side=right]",
    },
  },
  defaultVariants: { side: "top" },
});

export interface TooltipProps
  extends VariantProps<typeof tooltipSideVariants> {
  /** Tooltip body. */
  content: React.ReactNode;
  /** The single focusable child that triggers the tooltip. */
  children: React.ReactElement;
  /** Show after this delay (ms). */
  delay?: number;
  /** Skip rendering entirely. */
  disabled?: boolean;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  className,
  content,
  side = "top",
  children,
  delay = 0,
  disabled = false,
  ...props
}) => {
  const id = React.useId();
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  useEscapeKey(() => setOpen(false), open);

  const show = () => {
    if (disabled) return;
    if (delay > 0) {
      timer.current = window.setTimeout(() => setOpen(true), delay);
    } else {
      setOpen(true);
    }
  };
  const hide = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setOpen(false);
  };

  React.useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const trigger = React.cloneElement(children, {
    onFocus: (e: React.FocusEvent) => {
      children.props.onFocus?.(e);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      children.props.onBlur?.(e);
      hide();
    },
    onMouseEnter: (e: React.MouseEvent) => {
      children.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      children.props.onMouseLeave?.(e);
      hide();
    },
    "aria-describedby": id,
  } as Record<string, unknown>);

  return (
    <span
      className={cn(
        "nexus-tooltip",
        open && "is-open",
        reduced && "is-reduced",
        tooltipSideVariants({ side }),
        className,
      )}
      {...props}
    >
      {trigger}
      {open ? (
        <Portal>
          <span
            className="nexus-tooltip__bubble"
            data-side={side}
            id={id}
            role="tooltip"
            style={{ position: "absolute" }}
          >
            {content}
          </span>
        </Portal>
      ) : null}
    </span>
  );
};
Tooltip.displayName = "Tooltip";
