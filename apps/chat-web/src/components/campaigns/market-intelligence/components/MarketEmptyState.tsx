import React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MarketEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
};

export default function MarketEmptyState({
  icon: Icon,
  title,
  description,
  className,
  action,
}: MarketEmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-surface shadow-glass rounded-2xl border border-white/20 p-6",
        "flex flex-col items-center justify-center text-center",
        className
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-white/50 border border-white/40 backdrop-blur-md grid place-items-center">
        <Icon className="h-6 w-6 text-slate-700" aria-hidden="true" />
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {description ? (
          <p className="text-sm text-slate-600 max-w-[52ch]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

