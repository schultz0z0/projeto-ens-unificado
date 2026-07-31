import * as React from "react";
import { cn } from "./lib";

/**
 * Tabs — controlled (or uncontrolled with `defaultValue`) tab system.
 * Mirrors shadcn Tabs (CSS-only, no Radix).
 */
export interface TabsItem {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: TabsItem[];
  /** Controlled value. Use with `onValueChange`. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  ...props
}) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = React.useState<string>(
    defaultValue ?? items[0]?.value ?? "",
  );
  const value = isControlled ? controlledValue! : internalValue;

  const setValue = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onValueChange?.(next);
  };

  const listId = React.useId();

  return (
    <div className={cn("nexus-tabs", className)} {...props}>
      <div className="nexus-tabs__list" role="tablist" aria-label={props["aria-label"]}>
        {items.map((item) => {
          const isActive = item.value === value;
          const tabId = `${listId}-tab-${item.value}`;
          const panelId = `${listId}-panel-${item.value}`;
          return (
            <button
              key={item.value}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              disabled={item.disabled}
              className={cn("nexus-tabs__trigger", isActive && "is-active")}
              onClick={() => !item.disabled && setValue(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => {
        const isActive = item.value === value;
        if (!isActive) return null;
        const tabId = `${listId}-tab-${item.value}`;
        const panelId = `${listId}-panel-${item.value}`;
        return (
          <div
            key={item.value}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            className="nexus-tabs__content"
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
};
Tabs.displayName = "Tabs";
