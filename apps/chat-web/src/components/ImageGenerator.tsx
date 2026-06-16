import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wand2,
  Download,
  Loader2,
  CheckCircle2,
  PencilLine,
  Sparkles,
  Layers3,
  MonitorSmartphone,
  ScanSearch,
  Type,
  BadgeCheck,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useImageGenerator, KVS_SEM_TITULO } from "@/hooks/useImageGenerator";
import { CHANNEL_DIMENSIONS } from "@/services/imageGeneratorService";
import { cn } from "@/lib/utils";

type ReviewDisplayItem = {
  item_id: string;
  canal: string;
  kv: string;
  status: "pending" | "running" | "done" | "failed";
  file_url: string;
  storage_path?: string | null;
  signed_url_expires_at?: string | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  elapsed_seconds?: number | null;
  label: string;
  dimensions: {
    width: number;
    height: number;
  };
};

const mergeReviewItems = (previous: ReviewDisplayItem[], incoming: ReviewDisplayItem[]) => {
  if (previous.length === 0) return incoming;
  if (incoming.length === 0) return previous;

  const mergedByChannel = new Map(previous.map((item) => [item.canal, item]));
  for (const item of incoming) {
    const cached = mergedByChannel.get(item.canal);
    mergedByChannel.set(item.canal, {
      ...(cached ?? item),
      ...item,
      file_url: item.file_url || cached?.file_url || "",
    });
  }

  const previousOrder = previous.map((item) => item.canal);
  const extraChannels = incoming
    .map((item) => item.canal)
    .filter((canal) => !previousOrder.includes(canal));

  return [...previousOrder, ...extraChannels]
    .map((canal) => mergedByChannel.get(canal))
    .filter((item): item is ReviewDisplayItem => !!item);
};

const workflowSteps = [
  {
    icon: ScanSearch,
    title: "Briefing guiado",
    description: "Organize canal, KV e copy em uma estrutura mais clara para acelerar a geração.",
  },
  {
    icon: Sparkles,
    title: "IA cria e refina",
    description: "A geração já redireciona para a tela das peças, com status visual enquanto cada item processa.",
  },
  {
    icon: BadgeCheck,
    title: "Validação contínua",
    description: "As peças concluídas já podem ser validadas ou ajustadas enquanto o restante do lote continua.",
  },
] as const;

const formTips = [
  "Use um título direto e uma frase principal com benefício claro.",
  "No enxoval, descreva a persona pensando na adaptação entre formatos.",
  "Os boxes funcionam melhor com mensagens curtas e específicas.",
] as const;

const contentSectionClass =
  "rounded-[24px] border border-white/20 bg-white/[0.14] p-4 shadow-[0_14px_36px_rgba(15,23,42,0.08)] backdrop-blur-md sm:p-5";

const secondaryActionButtonClass =
  "h-14 rounded-2xl border-white/25 bg-white/10 text-base shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:bg-white/15";

export const ImageGenerator = () => {
  const { user } = useAuth();
  const {
    form,
    options,
    job,
    isLoadingOptions,
    isGenerating,
    canGenerate,
    setField,
    generate,
    reset,
    previewItems,
    refreshItemUrlIfNeeded,
    submitAdjustment,
    toLabel,
    availableKvs,
  } = useImageGenerator(user?.id);
  const [downloadingItemIds, setDownloadingItemIds] = useState<string[]>([]);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [screen, setScreen] = useState<"form" | "review">("form");
  const [validatedItemIds, setValidatedItemIds] = useState<string[]>([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [adjustmentPrompt, setAdjustmentPrompt] = useState("");
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);
  const [adjustingItemId, setAdjustingItemId] = useState<string | null>(null);
  const [cachedReviewItems, setCachedReviewItems] = useState<ReviewDisplayItem[]>([]);
  const [adjustmentReferenceFile, setAdjustmentReferenceFile] = useState<File | null>(null);
  const adjustmentFileInputRef = useRef<HTMLInputElement | null>(null);

  const visibleChannels = useMemo(() => {
    if (form.modo_geracao === "enxoval") return options.canais_enxoval;
    return options.canais_disponiveis;
  }, [form.modo_geracao, options]);

  const downloadableItems = useMemo(() => previewItems.filter((item) => !!item.file_url), [previewItems]);
  const generationFinished = !!job && job.status !== "pending" && job.status !== "running";
  const failedItemsCount = useMemo(() => previewItems.filter((item) => item.status === "failed").length, [previewItems]);
  const processingItems = useMemo<ReviewDisplayItem[]>(() => {
    const channels =
      form.modo_geracao === "enxoval"
        ? options?.canais_enxoval ?? []
        : form.canal
          ? [form.canal]
          : [];

    return channels.map((channel) => ({
      item_id: `processing:${channel}`,
      canal: channel,
      kv: form.kv,
      status: "pending",
      file_url: "",
      storage_path: null,
      signed_url_expires_at: null,
      error: null,
      started_at: null,
      completed_at: null,
      elapsed_seconds: null,
      label: toLabel(channel),
      dimensions: CHANNEL_DIMENSIONS[channel] ?? { width: 1080, height: 1080 },
    }));
  }, [form.canal, form.kv, form.modo_geracao, options?.canais_enxoval, toLabel]);
  const liveReviewItems = useMemo<ReviewDisplayItem[]>(
    () => (previewItems.length > 0 ? previewItems : processingItems),
    [previewItems, processingItems],
  );
  const displayReviewItems = useMemo(
    () => mergeReviewItems(cachedReviewItems, liveReviewItems),
    [cachedReviewItems, liveReviewItems],
  );
  const activeItem = displayReviewItems[activeReviewIndex] ?? null;
  const validatableItems = useMemo(
    () => displayReviewItems.filter((item) => item.status === "done" && !!item.file_url),
    [displayReviewItems],
  );
  const activeItemReady = !!activeItem && activeItem.status === "done" && !!activeItem.file_url;
  const isAdjustmentInProgress =
    isSubmittingAdjustment ||
    (!!activeItem &&
      !!adjustingItemId &&
      activeItem.item_id === adjustingItemId &&
      activeItem.status === "running");
  const allValidated =
    generationFinished &&
    validatableItems.length > 0 &&
    validatableItems.every((item) => validatedItemIds.includes(item.item_id));
  const remainingToValidate = validatableItems.filter((item) => !validatedItemIds.includes(item.item_id)).length;
  const completedItemsCount = displayReviewItems.filter((item) => item.status === "done" && !!item.file_url).length;
  const isTudoSobreSeguros = KVS_SEM_TITULO.has(form.kv);

  const briefingCompletion = useMemo(() => {
    const requiredValues = isTudoSobreSeguros
      ? [form.etiqueta, form.frase, form.box1, form.persona]
      : [form.etiqueta, form.titulo, form.frase, form.box1, form.persona];
    const filledCount = requiredValues.filter((value) => value.trim().length > 0).length;

    return Math.round((filledCount / requiredValues.length) * 100);
  }, [form.box1, form.etiqueta, form.frase, form.persona, form.titulo, isTudoSobreSeguros]);
  const summaryChips = useMemo(
    () => [
      {
        label: "Modo",
        value: form.modo_geracao === "enxoval" ? "Enxoval" : "Peça única",
      },
      {
        label: "Canal",
        value:
          form.modo_geracao === "enxoval"
            ? "Fluxo completo do enxoval"
            : form.canal
              ? toLabel(form.canal)
              : "Selecione um canal",
      },
      {
        label: "KV",
        value: form.kv ? toLabel(form.kv) : "Selecione a modalidade",
      },
    ],
    [form.canal, form.kv, form.modo_geracao, toLabel],
  );
  useEffect(() => {
    if (!isGenerating || job || reviewJobId !== null) return;
    setScreen("review");
    setValidatedItemIds([]);
    setActiveReviewIndex(0);
    setIsEditing(false);
    setAdjustmentPrompt("");
    setAdjustmentReferenceFile(null);
    setReviewJobId("creating");
    setCachedReviewItems(processingItems);
  }, [isGenerating, job, processingItems, reviewJobId]);

  useEffect(() => {
    if (!job) return;
    if (reviewJobId === job.job_id) return;
    setScreen("review");
    setValidatedItemIds([]);
    setActiveReviewIndex(0);
    setIsEditing(false);
    setAdjustmentPrompt("");
    setAdjustmentReferenceFile(null);
    setReviewJobId(job.job_id);
  }, [job, reviewJobId]);

  useEffect(() => {
    if (isGenerating || job || reviewJobId !== "creating") return;
    setScreen("form");
    setReviewJobId(null);
    setCachedReviewItems([]);
  }, [isGenerating, job, reviewJobId]);

  useEffect(() => {
    if (screen !== "review" || liveReviewItems.length === 0) return;
    setCachedReviewItems((current) => mergeReviewItems(current, liveReviewItems));
  }, [liveReviewItems, screen]);

  useEffect(() => {
    if (activeReviewIndex < displayReviewItems.length) return;
    setActiveReviewIndex(Math.max(0, displayReviewItems.length - 1));
  }, [activeReviewIndex, displayReviewItems.length]);

  useEffect(() => {
    if (!isEditing) return;
    if (activeItemReady) return;
    setIsEditing(false);
    setAdjustmentPrompt("");
    setAdjustmentReferenceFile(null);
  }, [activeItemReady, isEditing]);

  // Limpar campo titulo ao trocar para KV sem título
  useEffect(() => {
    if (isTudoSobreSeguros && form.titulo.trim() !== "") {
      setField("titulo", "");
    }
  }, [form.kv, isTudoSobreSeguros, form.titulo, setField]);

  useEffect(() => {
    if (!adjustingItemId) return;
    const adjustedItem = displayReviewItems.find((item) => item.item_id === adjustingItemId);
    if (adjustedItem?.status === "done") {
      setAdjustingItemId(null);
    }
  }, [adjustingItemId, displayReviewItems]);

  const buildFileName = (canal: string, itemId: string) => {
    return `${canal}_${itemId}.png`;
  };

  const downloadFileFromUrl = async (url: string, fileName: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao baixar arquivo (${response.status}).`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownload = async (itemId: string) => {
    const currentItem = previewItems.find((item) => item.item_id === itemId);
    if (!currentItem || !currentItem.file_url) return;
    try {
      setDownloadingItemIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
      const freshUrl = await refreshItemUrlIfNeeded(currentItem);
      if (!freshUrl) return;
      await downloadFileFromUrl(freshUrl, buildFileName(currentItem.canal, currentItem.item_id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao baixar a peça.";
      toast.error("Não foi possível baixar a peça", { description: message });
    } finally {
      setDownloadingItemIds((current) => current.filter((id) => id !== itemId));
    }
  };

  const handleDownloadAll = async () => {
    if (downloadableItems.length === 0) {
      toast.error("Ainda não há peças prontas para download.");
      return;
    }
    setIsDownloadingAll(true);
    const failedChannels: string[] = [];

    for (const item of downloadableItems) {
      try {
        const freshUrl = await refreshItemUrlIfNeeded(item);
        if (!freshUrl) {
          failedChannels.push(item.canal);
          continue;
        }
        await downloadFileFromUrl(freshUrl, buildFileName(item.canal, item.item_id));
      } catch {
        failedChannels.push(item.canal);
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    if (failedChannels.length > 0) {
      toast.warning("Algumas peças não foram baixadas", {
        description: failedChannels.map((channel) => toLabel(channel)).join(", "),
      });
    } else {
      toast.success("Downloads iniciados com sucesso.");
    }
    setIsDownloadingAll(false);
  };

  const openReviewAt = (index: number) => {
    setActiveReviewIndex(index);
    setIsEditing(false);
    setAdjustmentPrompt("");
    setAdjustmentReferenceFile(null);
  };

  const handleValidateCurrent = () => {
    if (!activeItemReady || !activeItem) return;
    setValidatedItemIds((current) => {
      if (current.includes(activeItem.item_id)) return current;
      return [...current, activeItem.item_id];
    });
    setIsEditing(false);
    setAdjustmentPrompt("");
    setAdjustmentReferenceFile(null);
    const nextIndex = displayReviewItems.findIndex(
      (item, index) =>
        index > activeReviewIndex &&
        item.status === "done" &&
        !!item.file_url &&
        !validatedItemIds.includes(item.item_id),
    );
    if (nextIndex >= 0) {
      setActiveReviewIndex(nextIndex);
      return;
    }
    const firstPending = displayReviewItems.findIndex(
      (item) =>
        item.status === "done" &&
        !!item.file_url &&
        !validatedItemIds.includes(item.item_id) &&
        item.item_id !== activeItem.item_id,
    );
    if (firstPending >= 0) {
      setActiveReviewIndex(firstPending);
    }
  };

  const handleSubmitAdjustment = async () => {
    if (!job || !activeItem || !activeItemReady) return;
    try {
      setIsSubmittingAdjustment(true);
      setAdjustingItemId(activeItem.item_id);
      await submitAdjustment(activeItem.item_id, adjustmentPrompt, adjustmentReferenceFile ?? undefined);
      setValidatedItemIds((current) => current.filter((itemId) => itemId !== activeItem.item_id));
      setIsEditing(false);
      setAdjustmentPrompt("");
      setAdjustmentReferenceFile(null);
      if (adjustmentFileInputRef.current) {
        adjustmentFileInputRef.current.value = "";
      }
      toast.success("Ajuste aplicado com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ajustar peça.";
      toast.error("Erro no ajuste da peça", { description: message });
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const handleBackToForm = () => {
    setScreen("form");
    setValidatedItemIds([]);
    setActiveReviewIndex(0);
    setIsEditing(false);
    setAdjustmentPrompt("");
    setAdjustmentReferenceFile(null);
    if (adjustmentFileInputRef.current) {
      adjustmentFileInputRef.current.value = "";
    }
    setReviewJobId(null);
    setCachedReviewItems([]);
    reset();
  };

  return (
    <div className="max-w-5xl mx-auto">
      {screen === "review" ? (
        <div className="glass-surface rounded-3xl p-8 shadow-glass space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-text-primary">Validação das Peças</h3>
              <p className="text-sm text-text-secondary">
                Revise cada peça com calma. Você pode validar ou ajustar antes de finalizar.
              </p>
              {!generationFinished ? (
                <p className="text-xs text-primary mt-1">
                  Gerando peças em andamento. Peças concluídas já podem ser validadas e ajustadas.
                </p>
              ) : null}
              {failedItemsCount > 0 ? (
                <p className="text-xs text-amber-300 mt-1">
                  {failedItemsCount} peça(s) falharam na geração e não entraram na fila de validação.
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-sm text-text-secondary">
                {generationFinished ? "Validadas:" : "Geradas:"}{" "}
                <span className="text-text-primary font-semibold">
                  {generationFinished ? validatedItemIds.length : completedItemsCount}/{displayReviewItems.length}
                </span>
              </p>
              <p className="text-xs text-text-secondary">
                {generationFinished
                  ? `Restantes: ${remainingToValidate}`
                  : `Prontas para validar: ${validatableItems.length}`}
              </p>
            </div>
          </div>

          {displayReviewItems.length > 0 && activeItem ? (
            <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-6">
              <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
                {displayReviewItems.map((item, index) => {
                  const dims = "dimensions" in item ? item.dimensions : CHANNEL_DIMENSIONS[item.canal] ?? { width: 1080, height: 1080 };
                  const isValidated = validatedItemIds.includes(item.item_id);
                  const isActive = activeItem.item_id === item.item_id;
                  return (
                    <button
                      type="button"
                      key={item.item_id}
                      onClick={() => openReviewAt(index)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isActive ? "border-primary bg-primary/10" : "border-white/20 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-text-primary">{toLabel(item.canal)}</p>
                        {isValidated ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : null}
                      </div>
                      <p className="text-xs text-text-secondary">{dims.width}x{dims.height}</p>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{toLabel(activeItem.canal)}</p>
                      <p className="text-xs text-text-secondary">Peça {activeReviewIndex + 1} de {displayReviewItems.length}</p>
                    </div>
                    <Button
                      onClick={() => handleDownload(activeItem.item_id)}
                      size="sm"
                      disabled={downloadingItemIds.includes(activeItem.item_id)}
                      className="bg-white/80 hover:bg-white text-slate-900 border border-slate-200 shadow-sm"
                    >
                      {downloadingItemIds.includes(activeItem.item_id) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Baixando...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-black/10 border border-white/10">
                    <div className="relative">
                      {activeItem.file_url ? (
                        <img
                          src={activeItem.file_url ?? ""}
                          alt={`Preview ${activeItem.canal}`}
                          className="w-full h-auto object-contain"
                        />
                      ) : (
                        <div className="min-h-[280px] flex items-center justify-center text-sm text-text-secondary">
                          {activeItem.status === "failed" ? "Falha na geração desta peça" : "Peça em processamento"}
                        </div>
                      )}
                      {isAdjustmentInProgress ? (
                        <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/55 border border-white/20 text-white text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            IA trabalhando no ajuste desta peça...
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={handleValidateCurrent}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    disabled={isSubmittingAdjustment || !activeItemReady}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Validar peça
                  </Button>
                  <Button
                    onClick={() => setIsEditing((current) => !current)}
                    variant="outline"
                    className="border-white/20 bg-white/5 hover:bg-white/15"
                    disabled={isSubmittingAdjustment || !activeItemReady}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    Editar peça
                  </Button>
                </div>

                {isEditing ? (
                  <div className="rounded-2xl border border-white/20 bg-white/5 p-4 space-y-3">
                    <Label htmlFor="adjustmentPrompt" className="text-text-primary font-medium block">
                      Prompt de ajuste
                    </Label>
                    <Textarea
                      id="adjustmentPrompt"
                      value={adjustmentPrompt}
                      onChange={(event) => setAdjustmentPrompt(event.target.value)}
                      placeholder="Ex: incluir selo de turma confirmada no canto superior direito sem alterar o restante."
                      className="glass-surface border-white/20 rounded-xl min-h-[100px]"
                    />
                    <div className="space-y-2">
                      <Label htmlFor="adjustmentReferenceFile" className="text-text-primary font-medium block">
                        Anexo de referência (opcional)
                      </Label>
                      <Input
                        id="adjustmentReferenceFile"
                        ref={adjustmentFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setAdjustmentReferenceFile(file);
                        }}
                        className="glass-surface border-white/20 rounded-xl file:mr-3 file:rounded-lg file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary"
                      />
                      {adjustmentReferenceFile ? (
                        <p className="text-xs text-text-secondary">Anexo selecionado: {adjustmentReferenceFile.name}</p>
                      ) : (
                        <p className="text-xs text-text-secondary">Envie PNG/JPG para orientar o ajuste manual.</p>
                      )}
                    </div>
                    <Button
                      onClick={handleSubmitAdjustment}
                      disabled={isSubmittingAdjustment || !adjustmentPrompt.trim()}
                      className="w-full bg-primary hover:bg-primary/90 text-white"
                    >
                      {isSubmittingAdjustment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Gerando ajuste...
                        </>
                      ) : (
                        <>
                          <Wand2 className="mr-2 h-4 w-4" />
                          Gerar novamente
                        </>
                      )}
                    </Button>
                  </div>
                ) : null}

                {isAdjustmentInProgress ? (
                  <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-text-primary">
                    O ajuste está em processamento. Você pode acompanhar por aqui enquanto a IA finaliza a nova versão.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleDownloadAll}
                    disabled={isDownloadingAll || downloadableItems.length === 0}
                    variant="outline"
                    className="border-white/20 bg-white/5 hover:bg-white/15"
                  >
                    {isDownloadingAll ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Baixando...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Baixar peças
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleBackToForm}
                    variant="outline"
                    className="border-white/20 bg-white/5 hover:bg-white/15"
                  >
                    Novo briefing
                  </Button>
                  <Button
                    onClick={() => toast.success("Fluxo de validação concluído.")}
                    disabled={!allValidated}
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Finalizar validação
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-text-secondary/80 py-12">
              Nenhuma peça disponível para validação.
            </div>
          )}
        </div>
      ) : (
        <div className="glass-surface relative overflow-hidden rounded-[28px] border border-white/20 p-4 shadow-glass sm:p-6 lg:p-8">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-20 right-0 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />
          </div>

          <div className="relative space-y-6 sm:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="max-w-3xl"
            >
              <div className="max-w-3xl space-y-4">
                <div className="relative inline-flex overflow-hidden rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-text-primary backdrop-blur-md">
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-[-12%] w-1/2 rounded-full bg-gradient-to-r from-transparent via-sky-300/20 to-transparent"
                    animate={{ x: ["0%", "35%", "0%"], opacity: [0.2, 0.38, 0.2] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="relative inline-flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Gerador de peças
                  </span>
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
                    Nexus Design AI
                  </h3>
                  <p className="max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
                    O Nexus Design é o gerador de peças da Escola de Negócios e Seguros para criar campanhas com mais
                    agilidade.
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.85fr)]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="space-y-4"
              >
                <div className={contentSectionClass}>
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Configuração da geração</p>
                      <p className="text-xs text-text-secondary">Defina o formato, o canal e a modalidade antes de partir para a copy.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
                      <Layers3 className="h-3.5 w-3.5" />
                      {form.modo_geracao === "enxoval" ? "Fluxo enxoval" : "Fluxo peça única"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-2 block text-text-primary font-medium">Tipo de geração</Label>
                      <Select value={form.modo_geracao} onValueChange={(value) => setField("modo_geracao", value as "peca_unica" | "enxoval")}>
                        <SelectTrigger className="glass-surface h-12 rounded-2xl border-white/20 bg-white/10">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="peca_unica">Peça única</SelectItem>
                          <SelectItem value="enxoval">Enxoval</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="mb-2 block text-text-primary font-medium">Canal</Label>
                      <Select
                        value={form.canal}
                        onValueChange={(value) => setField("canal", value)}
                        disabled={form.modo_geracao === "enxoval"}
                      >
                        <SelectTrigger className="glass-surface h-12 rounded-2xl border-white/20 bg-white/10">
                          <SelectValue placeholder={form.modo_geracao === "enxoval" ? "Canais fixos do enxoval" : "Selecione"} />
                        </SelectTrigger>
                        <SelectContent>
                          {visibleChannels.map((channel) => (
                            <SelectItem value={channel} key={channel}>
                              {toLabel(channel)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="mb-2 block text-text-primary font-medium">Modalidade</Label>
                      <Select
                        value={form.kv}
                        onValueChange={(value) => setField("kv", value)}
                        disabled={availableKvs.length === 0}
                      >
                        <SelectTrigger className="glass-surface h-12 rounded-2xl border-white/20 bg-white/10">
                          <SelectValue placeholder="Selecione a modalidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableKvs.map((kv) => (
                            <SelectItem value={kv} key={kv}>
                              {toLabel(kv)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-2 text-xs text-text-secondary">
                        {form.modo_geracao === "enxoval"
                          ? "Exibe apenas os KVs em comum entre todos os canais do enxoval."
                          : form.canal
                            ? `Exibe apenas os KVs com template disponível para ${toLabel(form.canal)}.`
                            : "Selecione um canal para ver as modalidades disponíveis."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={contentSectionClass}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-primary">
                      <Type className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Mensagem e estrutura da peça</p>
                      <p className="text-xs text-text-secondary">Organize os blocos principais para dar mais direção criativa à geração.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="etiqueta" className="mb-2 block text-text-primary font-medium">
                        Etiqueta *
                      </Label>
                      <Input
                        id="etiqueta"
                        placeholder="Digite a etiqueta"
                        value={form.etiqueta}
                        onChange={(e) => setField("etiqueta", e.target.value)}
                        className="glass-surface h-12 rounded-2xl border-white/20 bg-white/10"
                      />
                    </div>

                    {isTudoSobreSeguros ? (
                      <div className="flex items-start gap-3 rounded-2xl border border-[#009db7]/30 bg-[#009db7]/10 px-4 py-3">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#009db7]" />
                        <p className="text-xs leading-5 text-text-secondary">
                          O KV <span className="font-semibold text-text-primary">Tudo Sobre Seguros</span> usa a logo TSS no lugar do título — ela é fixa e será preservada automaticamente. Preencha apenas etiqueta, frase, boxes e persona.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="title" className="mb-2 block text-text-primary font-medium">
                          Título *
                        </Label>
                        <Input
                          id="title"
                          placeholder="Digite o título da sua campanha"
                          value={form.titulo}
                          onChange={(e) => setField("titulo", e.target.value)}
                          className="glass-surface h-12 rounded-2xl border-white/20 bg-white/10"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="phrase" className="mb-2 block text-text-primary font-medium">
                        Frase principal *
                      </Label>
                      <Textarea
                        id="phrase"
                        placeholder="Sua mensagem principal de marketing"
                        value={form.frase}
                        onChange={(e) => setField("frase", e.target.value)}
                        className="glass-surface min-h-[120px] rounded-2xl border-white/20 bg-white/10"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <Label htmlFor="box1" className="mb-2 block text-text-primary font-medium">
                          Conteúdo Box 1 *
                        </Label>
                        <Textarea
                          id="box1"
                          placeholder="Texto do primeiro box"
                          value={form.box1}
                          onChange={(e) => setField("box1", e.target.value)}
                          className="glass-surface min-h-[110px] rounded-2xl border-white/20 bg-white/10"
                        />
                      </div>

                      <div>
                        <Label htmlFor="box2" className="mb-2 block text-text-primary font-medium">
                          Conteúdo Box 2
                        </Label>
                        <Textarea
                          id="box2"
                          placeholder="Texto do segundo box"
                          value={form.box2}
                          onChange={(e) => setField("box2", e.target.value)}
                          className="glass-surface min-h-[110px] rounded-2xl border-white/20 bg-white/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={contentSectionClass}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-primary">
                      <MonitorSmartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Direção visual da persona</p>
                      <p className="text-xs text-text-secondary">Descreva quem aparece na peça para ajudar a IA a manter consistência entre formatos.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="persona" className="mb-2 block text-text-primary font-medium">
                        Persona *
                      </Label>
                      <Input
                        id="persona"
                        placeholder="Ex: Mulher executiva sorrindo em escritório moderno"
                        value={form.persona}
                        onChange={(e) => setField("persona", e.target.value)}
                        className="glass-surface h-12 rounded-2xl border-white/20 bg-white/10"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    onClick={generate}
                    disabled={!canGenerate}
                    className="h-14 w-full rounded-2xl bg-primary text-base font-semibold text-white shadow-glow transition-all duration-300 hover:bg-primary/90"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-5 w-5" />
                        {form.modo_geracao === "enxoval" ? "Gerar Enxoval" : "Gerar Peça"}
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={reset}
                    type="button"
                    variant="outline"
                    className={secondaryActionButtonClass}
                  >
                    Limpar
                  </Button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="space-y-4"
              >
                <div className={cn("hidden lg:block", contentSectionClass)}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Resumo do briefing</p>
                      <p className="text-xs text-text-secondary">Uma leitura rápida do que já está definido antes de gerar.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-sky-300 transition-all duration-300"
                        style={{ width: `${briefingCompletion}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Campos obrigatórios preenchidos</span>
                      <span className="font-semibold text-text-primary">{briefingCompletion}%</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      {summaryChips.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
                        >
                          <p className="text-[11px] uppercase tracking-[0.16em] text-text-secondary/70">{item.label}</p>
                          <p
                            className={cn(
                              "mt-1 text-sm font-medium",
                              item.value.includes("Selecione") ? "text-text-secondary" : "text-text-primary",
                            )}
                          >
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={contentSectionClass}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-primary">
                      <ScanSearch className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Jornada da geração</p>
                      <p className="text-xs text-text-secondary">A primeira tela agora apoia melhor o processo até a revisão final.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {workflowSteps.map((step, index) => {
                      const Icon = step.icon;
                      return (
                        <div key={step.title} className="flex gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
                                Etapa {index + 1}
                              </span>
                              <p className="text-sm font-medium text-text-primary">{step.title}</p>
                            </div>
                            <p className="text-xs leading-5 text-text-secondary">{step.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={contentSectionClass}>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-primary">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Boas práticas rápidas</p>
                      <p className="text-xs text-text-secondary">Pequenos ajustes no briefing ajudam a chegar mais perto do resultado ideal.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {formTips.map((tip) => (
                      <div key={tip} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <BadgeCheck className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-xs leading-5 text-text-secondary">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
