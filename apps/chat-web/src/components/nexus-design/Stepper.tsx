import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Step } from "./types";

export const Stepper = ({ step }: { step: Step }) => {
  const items: Array<{ id: Step; label: string; description: string }> = [
    { id: 1, label: "Config", description: "Canal e KV" },
    { id: 2, label: "Conteúdo", description: "The 6 Keys" },
    { id: 3, label: "Resultado", description: "Arte final" },
  ];

  return (
    <ol className="flex items-center justify-center gap-4 sm:gap-10 mb-8 md:mb-10">
      {items.map((item, index) => {
        const isActive = step === item.id;
        const isCompleted = step > item.id;
        const isLast = index === items.length - 1;

        return (
          <li key={item.id} className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border transition-all",
                  isActive && "border-brand-primary bg-brand-primary text-white shadow-glow",
                  isCompleted && "border-emerald-500 bg-emerald-500/10 text-emerald-300",
                  !isActive && !isCompleted && "border-white/20 bg-white/5 text-text-muted",
                )}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : item.id}
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span
                  className={cn(
                    "text-xs font-semibold tracking-[0.18em] uppercase",
                    isActive ? "text-brand-primary" : "text-text-muted",
                  )}
                >
                  {item.label}
                </span>
                <span className="text-xs text-text-secondary/80">
                  {item.description}
                </span>
              </div>
            </div>
            {!isLast && (
              <div className="hidden sm:block w-10 h-px bg-gradient-to-r from-white/10 via-white/30 to-white/10" />
            )}
          </li>
        );
      })}
    </ol>
  );
};

