import { MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChannelSizeLabel, getKvLabel, type ChannelId, type KeysForm, type KvId } from "./types";

type BannerPreviewProps = {
  channel: ChannelId;
  kv: KvId;
  form: KeysForm;
  className?: string;
};

export const BannerPreview = ({ channel, kv, form, className }: BannerPreviewProps) => {
  const sizeLabel = getChannelSizeLabel(channel);
  const kvLabel = getKvLabel(kv);

  return (
    <div className={cn("w-full max-w-xl mx-auto", className)}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-[0.18em]">
          Preview Nexus Design
        </span>
        <span className="text-[11px] px-2 py-1 rounded-full bg-slate-900/80 text-slate-100 border border-slate-700">
          {sizeLabel}
        </span>
      </div>

      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 overflow-hidden shadow-2xl border border-white/10 min-h-[360px] flex items-center justify-center px-6 py-8">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(15,118,110,0.18),_transparent_55%)]" />
        </div>

        <div className="relative w-full max-w-sm flex flex-col gap-4">
          <div className="inline-flex items-center self-start rounded-full bg-amber-400/95 text-slate-900 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase shadow-md">
            {form.etiqueta || "PÓS-GRADUAÇÃO"}
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              {form.titulo || "Seu Título Aqui"}
            </h3>
            <p className="text-sm text-slate-100/80 max-w-xs">
              {form.frase || "Sua frase de apoio aparecerá aqui, com foco em benefício."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mt-1">
            <div className="inline-flex items-center rounded-full bg-slate-900/80 border border-slate-600/70 px-3 py-1 text-xs text-slate-100 shadow-sm">
              {form.box1 || "Box de destaque 1"}
            </div>
            {form.box2 && (
              <div className="inline-flex items-center rounded-full bg-slate-900/60 border border-slate-600/60 px-3 py-1 text-xs text-slate-100/90">
                {form.box2}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-900/70 border border-slate-700/80 px-3 py-3 flex items-start gap-3 text-xs text-slate-300">
            <div className="mt-0.5 h-6 w-6 flex items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
              <MonitorSmartphone className="w-3.5 h-3.5" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-slate-50">
                KV {kvLabel || "Graduação"}
              </p>
              <p className="line-clamp-2 text-[11px] text-slate-300/90">
                {form.persona ||
                  "Persona visual: descreva o personagem principal e o clima da cena para o fundo."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

