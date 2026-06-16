import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BannerPreview } from "../Preview";
import { channels, kvOptions, type ChannelId, type KeysForm, type KvId } from "../types";

type ConfigStepProps = {
  channel: ChannelId;
  kv: KvId;
  form: KeysForm;
  onChannelChange: (value: ChannelId) => void;
  onKvChange: (value: KvId) => void;
  onNext: () => void;
};

export const ConfigStep = ({ channel, kv, form, onChannelChange, onKvChange, onNext }: ConfigStepProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
      <div className="glass-surface rounded-3xl shadow-glass border border-white/15 p-5 sm:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary">
              Nexus Design • Configuração
            </h2>
            <p className="text-sm text-text-secondary/90 mt-1">
              Escolha o canal e o KV que vamos usar como base visual.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] text-text-secondary">
            <LayoutTemplate className="w-3.5 h-3.5" />
            Biblioteca de Templates ENS
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-text-muted mb-2">
              Canal de destino
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {channels.map((option) => {
                const isActive = option.id === channel;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChannelChange(option.id)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-all",
                      "bg-white/40 hover:bg-white/60 shadow-sm",
                      "flex flex-col gap-1",
                      isActive
                        ? "border-brand-primary/80 shadow-[0_10px_30px_rgba(15,23,42,0.32)] ring-2 ring-brand-primary/40"
                        : "border-white/40 hover:border-brand-primary/40",
                    )}
                  >
                    <span className="text-sm font-semibold text-text-primary">
                      {option.label}
                    </span>
                    <span className="text-[11px] text-text-secondary/80">
                      {option.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-text-muted mb-2">
              Key Visual (KV)
            </p>
            <div className="flex flex-wrap gap-2">
              {kvOptions.map((option) => {
                const isActive = option.id === kv;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onKvChange(option.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                      "bg-white/40 hover:bg-white/60",
                      isActive
                        ? "border-brand-primary bg-brand-primary text-white shadow-[0_10px_30px_rgba(15,23,42,0.45)]"
                        : "border-white/40 text-text-secondary hover:border-brand-primary/40",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-text-secondary/80">
            Você poderá ajustar o conteúdo no próximo passo.
          </p>
          <Button
            type="button"
            onClick={onNext}
            className="rounded-full px-5 bg-brand-primary hover:bg-brand-primary/90 text-white shadow-glow"
          >
            Próximo passo
          </Button>
        </div>
      </div>

      <div className="glass-surface rounded-3xl shadow-glass border border-white/15 p-5 sm:p-6">
        <BannerPreview channel={channel} kv={kv} form={form} />
      </div>
    </div>
  );
};

