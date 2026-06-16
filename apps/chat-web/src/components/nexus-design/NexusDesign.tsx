import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Stepper } from "./Stepper";
import { ConfigStep } from "./steps/ConfigStep";
import { ContentStep } from "./steps/ContentStep";
import { GeneratingStep } from "./steps/GeneratingStep";
import { ResultStep } from "./steps/ResultStep";
import { initialForm, type ChannelId, type KeysForm, type KvId, type Step } from "./types";

export const NexusDesign = () => {
  const [step, setStep] = useState<Step>(1);
  const [channel, setChannel] = useState<ChannelId>("feed_instagram");
  const [kv, setKv] = useState<KvId>("graduacao");
  const [form, setForm] = useState<KeysForm>(initialForm);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isGenerating) return;

    setProgress(0);
    const checkpoints = [25, 55, 80, 100];
    let index = 0;

    const interval = setInterval(() => {
      setProgress(checkpoints[index] ?? 0);
      index += 1;
      if (index >= checkpoints.length) {
        clearInterval(interval);
        setIsGenerating(false);
        setHasResult(true);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const validateBeforeGenerate = () => {
    const missing: string[] = [];
    if (!form.titulo) missing.push("Título");
    if (!form.frase) missing.push("Frase");
    if (!form.box1) missing.push("Box 1");
    if (!form.persona) missing.push("Persona");
    if (missing.length === 0) return true;

    toast.error("Preencha os campos obrigatórios", {
      description: `Faltando: ${missing.join(", ")}`,
    });
    return false;
  };

  const handleGenerate = () => {
    if (!validateBeforeGenerate()) return;
    setStep(3);
    setHasResult(false);
    setIsGenerating(true);
  };

  const handleReset = () => {
    setForm(initialForm);
    setStep(1);
    setHasResult(false);
    setIsGenerating(false);
    setProgress(0);
  };

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <ConfigStep
          channel={channel}
          kv={kv}
          form={form}
          onChannelChange={setChannel}
          onKvChange={setKv}
          onNext={() => setStep(2)}
        />
      );
    }

    if (step === 2) {
      return (
        <ContentStep
          channel={channel}
          kv={kv}
          form={form}
          onFormChange={setForm}
          onBack={() => setStep(1)}
          onGenerate={handleGenerate}
          isGenerateDisabled={!form.titulo || !form.frase || !form.box1 || !form.persona}
        />
      );
    }

    if (isGenerating) {
      return (
        <div className="w-full flex items-center justify-center">
          <GeneratingStep channel={channel} kv={kv} progress={progress} />
        </div>
      );
    }

    if (hasResult) {
      return (
        <ResultStep
          channel={channel}
          kv={kv}
          form={form}
          onEdit={() => setStep(2)}
          onReset={handleReset}
        />
      );
    }

    return null;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10 space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
            Nexus Design • Fábrica de Banners
          </h1>
          <p className="mt-2 text-sm sm:text-base text-text-secondary max-w-2xl">
            Crie artes alinhadas ao KV da ENS em três passos: configuração, conteúdo e refinamento visual.
          </p>
        </div>
      </div>

      <Stepper step={step} />

      {renderStepContent()}
    </div>
  );
};

