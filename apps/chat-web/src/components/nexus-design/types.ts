export type Step = 1 | 2 | 3;

export type ChannelId = "feed_instagram" | "story_instagram" | "banner_site";
export type KvId = "graduacao" | "pos" | "mba";

export type ChannelOption = {
  id: ChannelId;
  label: string;
  subtitle: string;
};

export type KvOption = {
  id: KvId;
  label: string;
};

export const channels: ChannelOption[] = [
  { id: "feed_instagram", label: "Feed Instagram", subtitle: "1080 × 1350" },
  { id: "story_instagram", label: "Story Instagram", subtitle: "1080 × 1920" },
  { id: "banner_site", label: "Banner Site", subtitle: "Wide" },
];

export const kvOptions: KvOption[] = [
  { id: "graduacao", label: "Graduação" },
  { id: "pos", label: "Pós-graduação" },
  { id: "mba", label: "MBA Executivo" },
];

export type KeysForm = {
  etiqueta: string;
  titulo: string;
  frase: string;
  box1: string;
  box2: string;
  persona: string;
};

export const initialForm: KeysForm = {
  etiqueta: "",
  titulo: "",
  frase: "",
  box1: "",
  box2: "",
  persona: "",
};

export const getChannelSizeLabel = (channel: ChannelId) => {
  if (channel === "feed_instagram") return "1080 × 1350";
  if (channel === "story_instagram") return "1080 × 1920";
  return "Widescreen";
};

export const getKvLabel = (kv: KvId) => {
  return kvOptions.find((option) => option.id === kv)?.label ?? "";
};

