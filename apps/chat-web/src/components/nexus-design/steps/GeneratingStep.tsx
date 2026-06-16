import { Progress } from "@/components/ui/progress";
import type { ChannelId, KvId } from "../types";

type GeneratingStepProps = {
  channel: ChannelId;
  kv: KvId;
  progress: number;
};

export const GeneratingStep = ({ channel, kv, progress }: GeneratingStepProps) => {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="glass-surface rounded-3xl shadow-[0_22px_70px_rgba(15,23,42,0.65)] border border-emerald-500/30 bg-slate-950 text-slate-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-emerald-500/40 flex items-center justify-between text-xs">
          <span className="font-mono text-emerald-300">
            nexus-design • python orchestrator
          </span>
          <span className="flex items-center gap-2 text-slate-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            Running
          </span>
        </div>
        <div className="px-4 sm:px-6 py-5 bg-gradient-to-b from-slate-950 to-slate-900">
          <div className="font-mono text-[11px] leading-[1.4] space-y-1 text-emerald-100">
            <p>$ Initializing Nexus Design v1.0...</p>
            <p>$ Authenticating with ENS Vertex AI...</p>
            <p>{">"} Loading template: /templates_library/{channel.replace("_", "-")}/{kv}/base.png</p>
            <p>{">"} Running 3-step editing loop (background → macro text → micro text)...</p>
            <p className="text-emerald-300 mt-2">
              Nexus Design is working on your banner...
            </p>
          </div>
          <div className="mt-6">
            <Progress value={progress} className="h-1.5 bg-slate-800" />
            <p className="mt-2 text-[11px] text-slate-400">
              Gerando 3 iterações de imagem via Vertex AI...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

