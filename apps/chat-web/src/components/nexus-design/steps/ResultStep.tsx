import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BannerPreview } from "../Preview";
import type { ChannelId, KeysForm, KvId } from "../types";

type ResultStepProps = {
  channel: ChannelId;
  kv: KvId;
  form: KeysForm;
  onEdit: () => void;
  onReset: () => void;
};

export const ResultStep = ({ channel, kv, form, onEdit, onReset }: ResultStepProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)] gap-6 lg:gap-10 items-start w-full">
      <div className="glass-surface rounded-3xl shadow-glass border border-white/15 p-5 sm:p-6 flex flex-col items-center">
        <BannerPreview channel={channel} kv={kv} form={form} />
      </div>

      <div className="space-y-4">
        <div className="glass-surface rounded-3xl shadow-glass border border-white/15 p-5 sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-3 py-1 text-[11px] text-emerald-300 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sucesso
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-text-primary">
            Banner pronto para download
          </h3>
          <p className="text-sm text-text-secondary/90 mt-1">
            O Nexus Design processou o template selecionado seguindo as 6 chaves de conteúdo.
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <Button
              type="button"
              disabled
              className="w-full justify-center rounded-full bg-slate-900 text-slate-100 hover:bg-slate-900/90"
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar PNG (em breve)
            </Button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onEdit}
                className="rounded-full border-white/40 bg-white/40 text-text-secondary hover:bg-white/60"
              >
                Continuar editando
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onReset}
                className="rounded-full border-white/40 bg-white/30 text-text-secondary hover:bg-white/60"
              >
                Criar novo
              </Button>
            </div>
          </div>
        </div>

        <div className="glass-surface rounded-3xl shadow-glass border border-white/15 p-4 sm:p-5">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-text-muted mb-3">
            Plano de execução
          </p>
          <div className="space-y-2 text-sm">
            <div className="rounded-2xl bg-white/50 px-3 py-2 border border-white/40">
              <p className="text-xs font-semibold text-text-primary">
                Passo 1 • background_replacement
              </p>
              <p className="text-xs text-text-secondary">
                Atualiza o fundo com a persona mantendo KV e identidade da ENS.
              </p>
            </div>
            <div className="rounded-2xl bg-white/40 px-3 py-2 border border-white/30">
              <p className="text-xs font-semibold text-text-primary">
                Passo 2 • text_replacement_primary
              </p>
              <p className="text-xs text-text-secondary">
                Substitui etiqueta, título e frase com tipografia consistente.
              </p>
            </div>
            <div className="rounded-2xl bg-white/30 px-3 py-2 border border-white/20">
              <p className="text-xs font-semibold text-text-primary">
                Passo 3 • text_replacement_secondary
              </p>
              <p className="text-xs text-text-secondary">
                Ajusta os boxes de destaque com as informações secundárias.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

