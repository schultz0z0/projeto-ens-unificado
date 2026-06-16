import { getFileExtension } from "@/lib/chatMessageParts";

const SAFE_RENDERABLE_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif"]);

export const parseAllowedStreamFileHosts = (rawValue: string | undefined | null) => {
  if (!rawValue) return [];

  const hosts = new Set<string>();
  rawValue
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      try {
        const normalizedValue = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        const host = new URL(normalizedValue).hostname.toLowerCase();
        if (host) hosts.add(host);
      } catch {
        // ignore invalid env entries in client helper
      }
    });

  return Array.from(hosts);
};

export const getAllowedStreamFileHosts = () => {
  const hosts = new Set<string>();

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname.toLowerCase());
    } catch {
      // ignore invalid env in client helper
    }
  }

  parseAllowedStreamFileHosts(import.meta.env.VITE_CHAT_STREAM_FILE_HOSTS as string | undefined).forEach((host) => {
    hosts.add(host);
  });

  if (typeof window !== "undefined" && window.location.hostname) {
    hosts.add(window.location.hostname.toLowerCase());
  }

  return Array.from(hosts);
};

export const isAllowedStreamFileUrl = (url: string, allowedHosts = getAllowedStreamFileHosts()) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return allowedHosts.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const isSafeRenderableImage = ({
  kind,
  name,
  mimeType,
}: {
  kind: "image" | "file";
  name: string;
  mimeType?: string;
}) => {
  if (kind !== "image") return false;
  if (mimeType === "image/svg+xml") return false;
  const extension = getFileExtension(name);
  return SAFE_RENDERABLE_IMAGE_EXTENSIONS.has(extension);
};
