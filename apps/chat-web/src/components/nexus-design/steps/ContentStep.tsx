import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BannerPreview } from "../Preview";
import type { ChannelId, KeysForm, KvId } from "../types";

type ContentStepProps = {
  channel: ChannelId;
  kv: KvId;
  form: KeysForm;
  onFormChange: (next: KeysForm) => void;
  onBack: () => void;
  onGenerate: () => void;
  isGenerateDisabled: boolean;
};

export const ContentStep = ({
  channel,
  kv,
  form,
  onFormChange,
  onBack,
  onGenerate,
  isGenerateDisabled,
}: ContentStepProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
      <div className="glass-surface rounded-3xl shadow-glass border border-white/15 p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary">
              The 6 Keys • Conteúdo
            </h2>
            <p className="text-sm text-text-secondary/90 mt-1">
              Preencha as chaves que vão guiar o Nexus Design na edição do banner.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] text-text-secondary">
            <Wand2 className="w-3.5 h-3.5" />
            Otimizado para campanhas ENS
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="etiqueta" className="text-text-primary text-sm font-medium mb-1.5 block">
              Etiqueta
            </Label>
            <Input
              id="etiqueta"
              placeholder="Ex: PÓS-GRADUAÇÃO"
              value={form.etiqueta}
              onChange={(e) => onFormChange({ ...form, etiqueta: e.target.value })}
              className="bg-white/60 border-white/40 rounded-xl focus-visible:ring-brand-primary"
            />
          </div>
          <div>
            <Label htmlFor="titulo" className="text-text-primary text-sm font-medium mb-1.5 block">
              Título (Headline)
            </Label>
            <Input
              id="titulo"
              placeholder="Ex: Direito Securitário"
              value={form.titulo}
              onChange={(e) => onFormChange({ ...form, titulo: e.target.value })}
              className="bg-white/60 border-white/40 rounded-xl focus-visible:ring-brand-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="frase" className="text-text-primary text-sm font-medium mb-1.5 block">
              Frase de apoio
            </Label>
            <Textarea
              id="frase"
              placeholder="Ex: Torne-se referência no mercado de seguros."
              value={form.frase}
              onChange={(e) => onFormChange({ ...form, frase: e.target.value })}
              className="bg-white/60 border-white/40 rounded-xl min-h-[72px] focus-visible:ring-brand-primary"
            />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="box1" className="text-text-primary text-sm font-medium mb-1.5 block">
                Box 1 (Destaque)
              </Label>
              <Input
                id="box1"
                placeholder="Ex: Início imediato"
                value={form.box1}
                onChange={(e) => onFormChange({ ...form, box1: e.target.value })}
                className="bg-white/60 border-white/40 rounded-xl focus-visible:ring-brand-primary"
              />
            </div>
            <div>
              <Label htmlFor="box2" className="text-text-primary text-sm font-medium mb-1.5 block">
                Box 2 (Secundário)
              </Label>
              <Input
                id="box2"
                placeholder="Ex: Desconto de 10%"
                value={form.box2}
                onChange={(e) => onFormChange({ ...form, box2: e.target.value })}
                className="bg-white/60 border-white/40 rounded-xl focus-visible:ring-brand-primary"
              />
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="persona" className="text-text-primary text-sm font-medium mb-1.5 block">
            Persona (Prompt criativo)
          </Label>
          <Textarea
            id="persona"
            placeholder="Descreva a imagem de fundo. Ex: Mulher jovem executiva, sorrindo, em escritório moderno com muita luz natural..."
            value={form.persona}
            onChange={(e) => onFormChange({ ...form, persona: e.target.value })}
            className="bg-white/60 border-white/40 rounded-xl min-h-[96px] focus-visible:ring-brand-primary"
          />
          <p className="mt-1 text-[11px] text-text-secondary/80">
            Quanto mais clara a persona, mais preciso o resultado visual.
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="rounded-full border-white/40 bg-white/40 text-text-secondary hover:bg-white/60"
          >
            Voltar
          </Button>
          <Button
            type="button"
            onClick={onGenerate}
            disabled={isGenerateDisabled}
            className="rounded-full px-6 bg-brand-primary hover:bg-brand-primary/90 text-white shadow-glow flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            Gerar banner com IA
          </Button>
        </div>
      </div>

      <div className="glass-surface rounded-3xl shadow-glass border border-white/15 p-5 sm:p-6">
        <BannerPreview channel={channel} kv={kv} form={form} />
      </div>
    </div>
  );
};

