import { z } from "zod";

export type GenerationMode = "peca_unica" | "enxoval";

export type BannerCanal =
  | "01_feed_instagram"
  | "02_story_instagram"
  | "03_banner_interno_desktop"
  | "04_banner_interno_mobile"
  | "05_AIDA_whatsapp"
  | "05_whatsapp"
  | "06_banner_home_desktop"
  | "07_banner_home_mobile"
  | "08_topo_email";

export type ChannelDimension = {
  width: number;
  height: number;
};

export const CHANNEL_DIMENSIONS: Record<string, ChannelDimension> = {
  "01_feed_instagram": { width: 1080, height: 1350 },
  "02_story_instagram": { width: 1080, height: 1920 },
  "03_banner_interno_desktop": { width: 1440, height: 605 },
  "04_banner_interno_mobile": { width: 415, height: 500 },
  "05_AIDA_whatsapp": { width: 1080, height: 1080 },
  "05_whatsapp": { width: 1080, height: 1080 },
  "06_banner_home_desktop": { width: 1920, height: 500 },
  "07_banner_home_mobile": { width: 640, height: 640 },
  "08_topo_email": { width: 600, height: 400 },
};

const FormOptionsSchema = z.object({
  modos_geracao: z.array(z.enum(["peca_unica", "enxoval"])),
  canais_enxoval: z.array(z.string()),
  canais_disponiveis: z.array(z.string()),
  kvs_disponiveis: z.array(z.string()),
  templates: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
});

const JobItemSchema = z.object({
  item_id: z.string().uuid(),
  canal: z.string(),
  kv: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
  file_url: z.string().min(1).nullable(),
  storage_path: z.string().nullable().optional(),
  signed_url_expires_at: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  elapsed_seconds: z.number().nullable().optional(),
});

const BannerJobSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(["pending", "running", "done", "partial_done", "failed"]),
  created_at: z.string(),
  updated_at: z.string(),
  modo_geracao: z.enum(["peca_unica", "enxoval"]),
  progress: z.string(),
  itens: z.array(JobItemSchema),
  file_url: z.string().min(1).nullable().optional(),
  requested_by: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

const JobCreatedSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(["pending", "running"]),
  status_url: z.string(),
  created_at: z.string(),
});

const RefreshSignedUrlSchema = z.object({
  item_id: z.string().uuid(),
  file_url: z.string().min(1),
  signed_url_expires_at: z.string(),
});

const AdjustmentAcceptedSchema = z.object({
  status: z.literal("accepted"),
  message: z.string(),
});

export type FormOptions = z.infer<typeof FormOptionsSchema>;
export type BannerJob = z.infer<typeof BannerJobSchema>;
export type BannerJobItem = z.infer<typeof JobItemSchema>;
export type JobCreated = z.infer<typeof JobCreatedSchema>;
export type RefreshSignedUrlResult = z.infer<typeof RefreshSignedUrlSchema>;
export type AdjustmentAcceptedResult = z.infer<typeof AdjustmentAcceptedSchema>;

export type CreateBannerInput = {
  modo_geracao: GenerationMode;
  canal?: string;
  kv: string;
  etiqueta: string;
  titulo: string;
  frase: string;
  box1: string;
  box2: string;
  persona: string;
};

export type BannerAdjustmentInput = {
  prompt: string;
  referenceFile?: File;
};

const API_REQUEST_TIMEOUT_MS = 12000;

const normalizeApiBaseUrl = (rawUrl: string) => {
  const sanitized = rawUrl.trim();
  let url: URL;
  try {
    url = new URL(sanitized);
  } catch {
    url = new URL(`https://${sanitized}`);
  }

  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const pageProtocol = typeof window !== "undefined" ? window.location.protocol : undefined;

  if (pageProtocol === "https:" && url.protocol === "http:" && !isLocalhost) {
    url.protocol = "https:";
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
};

export const getImageGeneratorApiBaseUrl = () => {
  const envUrl =
    (import.meta.env.VITE_IMAGE_GENERATOR_API_URL as string | undefined) ??
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    (import.meta.env.NEXT_PUBLIC_API_BASE_URL as string | undefined);
  if (!envUrl) {
    throw new Error("Configuração ausente: VITE_IMAGE_GENERATOR_API_URL ou VITE_API_BASE_URL.");
  }
  return normalizeApiBaseUrl(envUrl);
};

export const resolveImageOutputUrl = (fileUrl: string | null | undefined) => {
  if (!fileUrl) return "";
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const normalizedPath = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
  return `${getImageGeneratorApiBaseUrl()}${normalizedPath}`;
};

type ApiErrorDetail = {
  loc?: Array<string | number>;
  msg?: string;
};

const parseErrorDetail = (detail: unknown) => {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const typedEntry = entry as ApiErrorDetail;
        if (!typedEntry.msg) return null;
        const field = typedEntry.loc?.length ? String(typedEntry.loc[typedEntry.loc.length - 1]) : "";
        return field ? `${field}: ${typedEntry.msg}` : typedEntry.msg;
      })
      .filter((value): value is string => Boolean(value));
    if (messages.length > 0) {
      return messages.join(" | ");
    }
  }
  return null;
};

const parseErrorMessage = async (response: Response) => {
  const raw = await response.text();
  if (!raw) return `Falha HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(raw) as { error?: string; detail?: unknown };
    const parsedDetail = parseErrorDetail(parsed.detail);
    return parsed.error ?? parsedDetail ?? `Falha HTTP ${response.status}`;
  } catch {
    return raw.slice(0, 300);
  }
};

const requestJson = async <T>(
  path: string,
  init: RequestInit,
  schema: z.ZodSchema<T>,
): Promise<T> => {
  const baseUrl = getImageGeneratorApiBaseUrl();
  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Tempo limite excedido ao chamar a API do gerador (${baseUrl}).`);
    }
    const reason = error instanceof Error ? error.message : "Falha de rede.";
    throw new Error(`Não foi possível conectar na API do gerador (${baseUrl}). ${reason}`);
  }
  clearTimeout(timeoutId);
  if (!response.ok) {
    const reason = await parseErrorMessage(response);
    throw new Error(`Erro na API do gerador: ${reason}`);
  }
  const json = await response.json();
  return schema.parse(json);
};

const makeHeaders = (userId?: string, includeJsonContentType = true) => {
  const headers: HeadersInit = {};
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }
  if (userId) headers["x-user-id"] = userId;
  return headers;
};

export const fetchImageFormOptions = async () => {
  return requestJson("/banners/form-options", { method: "GET" }, FormOptionsSchema);
};

export const createBannerJob = async (payload: CreateBannerInput, userId?: string) => {
  return requestJson(
    "/banners/json",
    {
      method: "POST",
      headers: makeHeaders(userId),
      body: JSON.stringify(payload),
    },
    JobCreatedSchema,
  );
};

export const getBannerJob = async (jobId: string, userId?: string) => {
  return requestJson(
    `/banners/${jobId}`,
    {
      method: "GET",
      headers: userId ? { "x-user-id": userId } : undefined,
    },
    BannerJobSchema,
  );
};

export const refreshBannerItemSignedUrl = async (jobId: string, itemId: string, userId?: string) => {
  const init: RequestInit = {
    method: "POST",
    headers: makeHeaders(userId),
  };
  try {
    return await requestJson(`/banners/${jobId}/itens/${itemId}/refresh-url`, init, RefreshSignedUrlSchema);
  } catch {
    return requestJson(`/banners/${jobId}/items/${itemId}/refresh-url`, init, RefreshSignedUrlSchema);
  }
};

export const adjustBannerItem = async (
  jobId: string,
  itemId: string,
  input: BannerAdjustmentInput,
  userId?: string,
) => {
  const trimmedPrompt = input.prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("Prompt de ajuste é obrigatório.");
  }

  const hasReferenceFile = !!input.referenceFile;
  const init: RequestInit = {
    method: "POST",
  };

  if (hasReferenceFile) {
    const formData = new FormData();
    formData.append("prompt", trimmedPrompt);
    formData.append("reference_image", input.referenceFile as File);
    init.headers = makeHeaders(userId, false);
    init.body = formData;
  } else {
    init.headers = makeHeaders(userId);
    init.body = JSON.stringify({ prompt: trimmedPrompt });
  }

  return requestJson(
    `/banners/${jobId}/items/${itemId}/adjust`,
    init,
    AdjustmentAcceptedSchema,
  );
};
