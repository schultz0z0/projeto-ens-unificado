import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import {
  adjustBannerItem,
  BannerAdjustmentInput,
  BannerJob,
  BannerJobItem,
  CHANNEL_DIMENSIONS,
  CreateBannerInput,
  fetchImageFormOptions,
  FormOptions,
  GenerationMode,
  getBannerJob,
  resolveImageOutputUrl,
  refreshBannerItemSignedUrl,
  createBannerJob,
} from "@/services/imageGeneratorService";

type FormState = {
  modo_geracao: GenerationMode;
  canal: string;
  kv: string;
  etiqueta: string;
  titulo: string;
  frase: string;
  box1: string;
  box2: string;
  persona: string;
};

// KVs que não possuem campo de título (a logo do KV ocupa o espaço do título).
// O formulário oculta o campo Título e o backend não tenta editar título para esses KVs.
export const KVS_SEM_TITULO = new Set(["tudo-sobre-seguros"]);

const baseSchema = z.object({
  modo_geracao: z.enum(["peca_unica", "enxoval"]),
  canal: z.string().optional(),
  kv: z.string().min(1, "Selecione a modalidade."),
  etiqueta: z.string().trim().min(1, "Etiqueta é obrigatória.").max(40, "Etiqueta pode ter no máximo 40 caracteres."),
  titulo: z.string().trim().max(80, "Título pode ter no máximo 80 caracteres.").default(""),
  frase: z.string().trim().min(1, "Frase é obrigatória.").max(160, "Frase pode ter no máximo 160 caracteres."),
  box1: z.string().trim().min(1, "Box 1 é obrigatório.").max(120, "Box 1 pode ter no máximo 120 caracteres."),
  box2: z.string().trim().max(120, "Box 2 pode ter no máximo 120 caracteres.").default(""),
  persona: z.string().trim().min(1, "Persona é obrigatória.").max(300, "Persona pode ter no máximo 300 caracteres."),
});

const requestSchema = baseSchema.superRefine((value, ctx) => {
  if (value.modo_geracao === "peca_unica" && (!value.canal || !value.canal.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selecione o canal para peça única.",
      path: ["canal"],
    });
  }
  // Título obrigatório apenas para KVs que possuem campo de título.
  if (!KVS_SEM_TITULO.has(value.kv) && !value.titulo.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Título é obrigatório.",
      path: ["titulo"],
    });
  }
});

const ENXOVAL_CHANNEL_ORDER = [
  "01_feed_instagram",
  "03_banner_interno_desktop",
  "04_banner_interno_mobile",
  "05_whatsapp",
  "08_topo_email",
];

const FALLBACK_TEMPLATES: FormOptions["templates"] = {
  "01_feed_instagram": {
    chcs: ["Template (final).png"],
    graduacao: ["Template (final).png"],
    imersoes: ["Template (final).png"],
    institucional: ["Template (final).png"],
    pos: ["Template (final).png"],
    qualificacoes: ["Template (final).png"],
    "tudo-sobre-seguros": ["Template (final).png"],
  },
  "02_story_instagram": {
    graduacao: ["Template (final).png"],
    institucional: ["Template (final).png"],
    pos: ["Template (final).png"],
    qualificacoes: ["Template (final).png"],
  },
  "03_banner_interno_desktop": {
    graduacao: ["Template (final).png"],
    pos: ["Template (final).png"],
  },
  "04_banner_interno_mobile": {
    graduacao: ["Template (final).png"],
    pos: ["Template (final).png"],
  },
  "05_AIDA_whatsapp": {
    imersoes: ["Template (final).png"],
    pos: ["Template (final).png"],
    qualificacoes: ["Template (final).png"],
  },
  "05_whatsapp": {
    chcs: ["Template (final).png"],
    graduacao: ["Template (final).png"],
    imersoes: ["Template (final).png"],
    institucional: ["Template (final).png"],
    pos: ["Template (final).png"],
    qualificacoes: ["Template (final).png"],
    "tudo-sobre-seguros": ["Template (final).png"],
  },
  "06_banner_home_desktop": {
    graduacao: ["base_graduacao_03banner_desktop_home.png"],
    pos: ["base_pos_01feed_padrao.jpg"],
  },
  "07_banner_home_mobile": {
    graduacao: ["base_graduacao_03banner_mobile_home.png"],
    pos: ["base_pos_01feed_padrao.jpg"],
  },
  "08_topo_email": {
    chcs: ["email CHCS 2.png"],
    graduacao: ["Template (final).png"],
    imersoes: ["Template (final).png"],
    institucional: ["Template (final).png"],
    pos: ["Template (final).png"],
    qualificacoes: ["Template (final).png"],
    "tudo-sobre-seguros": ["Template (final).png"],
  },
};

const FALLBACK_FORM_OPTIONS: FormOptions = {
  modos_geracao: ["peca_unica", "enxoval"],
  canais_enxoval: ENXOVAL_CHANNEL_ORDER,
  canais_disponiveis: [
    "01_feed_instagram",
    "02_story_instagram",
    "03_banner_interno_desktop",
    "04_banner_interno_mobile",
    "05_AIDA_whatsapp",
    "05_whatsapp",
    "06_banner_home_desktop",
    "07_banner_home_mobile",
    "08_topo_email",
  ],
  kvs_disponiveis: [
    "chcs",
    "graduacao",
    "imersoes",
    "institucional",
    "pos",
    "qualificacoes",
    "tudo-sobre-seguros",
  ],
  templates: FALLBACK_TEMPLATES,
};

const normalizeChannel = (value?: string | null) => (value ?? "").trim().toLowerCase();

const toLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/^\d+\s*/, "")
    .replace(/\b\w/g, (s) => s.toUpperCase());

const resolveCommonKvs = (templates: FormOptions["templates"], channels: string[]) => {
  let commonKvs: Set<string> | null = null;

  for (const channel of channels) {
    const channelKvs = new Set(Object.keys(templates[channel] ?? {}));
    commonKvs = commonKvs === null ? channelKvs : new Set([...commonKvs].filter((kv) => channelKvs.has(kv)));
  }

  return [...(commonKvs ?? new Set<string>())].sort();
};

const resolveAvailableKvs = (options: FormOptions, modoGeracao: GenerationMode, canal: string) => {
  const hasTemplateCatalog = Object.keys(options.templates).length > 0;

  if (hasTemplateCatalog) {
    if (modoGeracao === "enxoval") {
      const commonKvs = resolveCommonKvs(options.templates, options.canais_enxoval);
      if (commonKvs.length > 0) return commonKvs;
    }

    if (canal) {
      const channelKvs = Object.keys(options.templates[canal] ?? {}).sort();
      if (channelKvs.length > 0) return channelKvs;
    }
  }

  return [...options.kvs_disponiveis];
};

const toPayload = (form: FormState): CreateBannerInput => {
  const normalizedBox2 = form.box2.trim();
  return {
    modo_geracao: form.modo_geracao,
    canal: form.modo_geracao === "peca_unica" ? form.canal : undefined,
    kv: form.kv.trim(),
    etiqueta: form.etiqueta.trim(),
    titulo: form.titulo.trim(),
    frase: form.frase.trim(),
    box1: form.box1.trim(),
    box2: normalizedBox2,
    persona: form.persona.trim(),
  };
};

const isExpired = (value?: string | null) => {
  if (!value) return false;
  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) return false;
  return Date.now() >= expiresAt - 30_000;
};

const MAX_ADJUSTMENT_REFERENCE_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ADJUSTMENT_REFERENCE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

const adjustmentInputSchema = z
  .object({
    prompt: z.string().trim().min(1, "Escreva um prompt de ajuste antes de enviar."),
    referenceFile: z.unknown().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.referenceFile == null) return;
    if (typeof File === "undefined" || !(value.referenceFile instanceof File)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceFile"],
        message: "Arquivo de referência inválido.",
      });
      return;
    }
    if (!ALLOWED_ADJUSTMENT_REFERENCE_TYPES.has(value.referenceFile.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceFile"],
        message: "Use apenas PNG ou JPG/JPEG no anexo.",
      });
    }
    if (value.referenceFile.size > MAX_ADJUSTMENT_REFERENCE_FILE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceFile"],
        message: "O anexo deve ter no máximo 10MB.",
      });
    }
  });

export const useImageGenerator = (userId?: string) => {
  const [options, setOptions] = useState<FormOptions>(FALLBACK_FORM_OPTIONS);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [form, setForm] = useState<FormState>({
    modo_geracao: "peca_unica",
    canal: "05_whatsapp",
    kv: "",
    etiqueta: "",
    titulo: "",
    frase: "",
    box1: "",
    box2: "",
    persona: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [job, setJob] = useState<BannerJob | null>(null);

  const loadOptions = useCallback(async () => {
    try {
      setIsLoadingOptions(true);
      const data = await fetchImageFormOptions();
      setOptions(data);
      setForm((current) => {
        const nextMode = data.modos_geracao.includes(current.modo_geracao) ? current.modo_geracao : "peca_unica";
        const nextChannel = data.canais_disponiveis.includes(current.canal)
          ? current.canal
          : (data.canais_disponiveis[0] ?? "");
        const nextKvs = resolveAvailableKvs(data, nextMode, nextChannel);

        return {
          ...current,
          modo_geracao: nextMode,
          canal: nextChannel,
          kv: nextKvs.includes(current.kv) ? current.kv : (nextKvs[0] ?? ""),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar opções.";
      toast.error("Falha ao carregar opções do gerador", { description: message });
      setOptions(FALLBACK_FORM_OPTIONS);
      setForm((current) => {
        const nextMode: GenerationMode = "peca_unica";
        const nextChannel = current.canal || FALLBACK_FORM_OPTIONS.canais_disponiveis[0] || "";
        const nextKvs = resolveAvailableKvs(FALLBACK_FORM_OPTIONS, nextMode, nextChannel);

        return {
          ...current,
          modo_geracao: nextMode,
          canal: nextChannel,
          kv: nextKvs.includes(current.kv) ? current.kv : (nextKvs[0] ?? ""),
        };
      });
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const availableKvs = useMemo(() => {
    return resolveAvailableKvs(options, form.modo_geracao, form.canal);
  }, [form.canal, form.modo_geracao, options]);

  useEffect(() => {
    if (availableKvs.includes(form.kv)) return;
    setForm((current) => {
      if (availableKvs.includes(current.kv)) return current;
      return { ...current, kv: availableKvs[0] ?? "" };
    });
  }, [availableKvs, form.kv]);

  const reset = useCallback(() => {
    setJob(null);
    setForm((prev) => ({
      ...prev,
      etiqueta: "",
      titulo: "",
      frase: "",
      box1: "",
      box2: "",
      persona: "",
    }));
  }, []);

  const getDoneItems = useCallback((snapshot: BannerJob) => {
    return snapshot.itens.filter((item) => item.status === "done" && !!item.file_url);
  }, []);

  const pollJobUntilFinished = useCallback(
    async (jobId: string) => {
      const timeoutMs = 30 * 60_000;
      const intervalMs = 3000;
      const start = Date.now();
      let snapshot = await getBannerJob(jobId, userId);
      setJob(snapshot);

      while (snapshot.status === "pending" || snapshot.status === "running") {
        if (Date.now() - start > timeoutMs) {
          throw new Error("Timeout aguardando a finalização da geração.");
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        snapshot = await getBannerJob(jobId, userId);
        setJob(snapshot);
      }

      if (snapshot.status === "failed") {
        throw new Error(snapshot.error ?? "A geração falhou.");
      }
      const doneItems = getDoneItems(snapshot);
      if (doneItems.length === 0) {
        throw new Error("A API finalizou sem retornar imagem processada.");
      }
      return snapshot;
    },
    [getDoneItems, userId],
  );

  const pollItemAdjustmentUntilFinished = useCallback(
    async (jobId: string, itemId: string) => {
      const timeoutMs = 30 * 60_000;
      const intervalMs = 2500;
      const start = Date.now();
      let snapshot = await getBannerJob(jobId, userId);
      setJob(snapshot);

      while (Date.now() - start < timeoutMs) {
        const target = snapshot.itens.find((item) => item.item_id === itemId);
        if (!target) {
          throw new Error("Item não encontrado no job após iniciar ajuste.");
        }
        if (target.status === "done") {
          return snapshot;
        }
        if (target.status === "failed") {
          throw new Error(target.error ?? "Ajuste falhou para esta peça.");
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        snapshot = await getBannerJob(jobId, userId);
        setJob(snapshot);
      }
      throw new Error("Timeout aguardando a finalização do ajuste.");
    },
    [userId],
  );

  const generate = useCallback(async () => {
    const parsed = requestSchema.safeParse(form);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? "Preencha os campos obrigatórios.";
      toast.error(firstIssue);
      return;
    }

    const payload = toPayload(parsed.data as FormState);
    setIsGenerating(true);
    setJob(null);

    try {
      const created = await createBannerJob(payload, userId);
      const finalJob = await pollJobUntilFinished(created.job_id);
      setJob(finalJob);
      const doneItems = getDoneItems(finalJob);
      if (finalJob.status === "partial_done") {
        toast.warning("Geração concluída parcialmente", {
          description: `${doneItems.length} peça(s) finalizada(s) com sucesso.`,
        });
        return;
      }
      toast.success("Imagem gerada com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar imagem.";
      toast.error("Erro ao gerar imagem", { description: message });
    } finally {
      setIsGenerating(false);
    }
  }, [form, getDoneItems, pollJobUntilFinished, userId]);

  const refreshItemUrlIfNeeded = useCallback(
    async (item: BannerJobItem) => {
      if (!job) return resolveImageOutputUrl(item.file_url);
      if (!item.file_url) return "";
      if (!isExpired(item.signed_url_expires_at)) return resolveImageOutputUrl(item.file_url);

      const refreshed = await refreshBannerItemSignedUrl(job.job_id, item.item_id, userId);
      setJob((current) => {
        if (!current) return current;
        return {
          ...current,
          itens: current.itens.map((jobItem) =>
            jobItem.item_id === item.item_id
              ? {
                  ...jobItem,
                  file_url: refreshed.file_url,
                  signed_url_expires_at: refreshed.signed_url_expires_at,
                }
              : jobItem,
          ),
        };
      });
      return resolveImageOutputUrl(refreshed.file_url);
    },
    [job, userId],
  );

  const submitAdjustment = useCallback(
    async (itemId: string, prompt: string, referenceFile?: File) => {
      if (!job) {
        throw new Error("Nenhum job disponível para ajuste.");
      }

      const parsed = adjustmentInputSchema.safeParse({
        prompt,
        referenceFile,
      });

      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos para ajuste.");
      }

      const payload: BannerAdjustmentInput = {
        prompt: parsed.data.prompt,
        referenceFile: parsed.data.referenceFile instanceof File ? parsed.data.referenceFile : undefined,
      };

      await adjustBannerItem(job.job_id, itemId, payload, userId);
      return pollItemAdjustmentUntilFinished(job.job_id, itemId);
    },
    [job, pollItemAdjustmentUntilFinished, userId],
  );

  const previewItems = useMemo(() => {
    if (!job) return [];
    if (job.modo_geracao === "peca_unica") {
      const item = job.itens.find((it) => it.status === "done" && !!it.file_url) ?? job.itens[0];
      if (!item) return [];
      const dimensions = CHANNEL_DIMENSIONS[item.canal] ?? { width: 1080, height: 1080 };
      return [
        {
          ...item,
          file_url: resolveImageOutputUrl(item.file_url),
          label: toLabel(item.canal),
          dimensions,
        },
      ];
    }
    const byChannel = new Map(job.itens.map((item) => [normalizeChannel(item.canal), item]));
    const expectedChannels = options?.canais_enxoval?.length ? options.canais_enxoval : ENXOVAL_CHANNEL_ORDER;
    const normalizedExpected = new Set(expectedChannels.map((channel) => normalizeChannel(channel)));
    const orderedChannels = [
      ...expectedChannels,
      ...job.itens
        .map((item) => item.canal)
        .filter((channel) => !normalizedExpected.has(normalizeChannel(channel))),
    ];

    return orderedChannels.map((channel) => {
      const item = byChannel.get(normalizeChannel(channel));
      const dimensions = CHANNEL_DIMENSIONS[channel] ?? { width: 1080, height: 1080 };
      return {
        item_id: item?.item_id ?? `${job.job_id}:${channel}`,
        canal: channel,
        kv: item?.kv ?? form.kv,
        status: item?.status ?? "pending",
        file_url: resolveImageOutputUrl(item?.file_url),
        storage_path: item?.storage_path ?? null,
        signed_url_expires_at: item?.signed_url_expires_at ?? null,
        error: item?.error ?? null,
        started_at: item?.started_at ?? null,
        completed_at: item?.completed_at ?? null,
        elapsed_seconds: item?.elapsed_seconds ?? null,
        label: toLabel(channel),
        dimensions,
      };
    });
  }, [form.kv, job, options?.canais_enxoval]);

  const canGenerate = useMemo(() => {
    if (isLoadingOptions || isGenerating) return false;
    return true;
  }, [isGenerating, isLoadingOptions]);

  return {
    options,
    form,
    job,
    isLoadingOptions,
    isGenerating,
    canGenerate,
    setField,
    loadOptions,
    generate,
    reset,
    previewItems,
    refreshItemUrlIfNeeded,
    submitAdjustment,
    toLabel,
    availableKvs,
  };
};
