import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  MarketDashboardData,
  MarketDashboardError,
  MarketTimeframe,
  getMarketDashboardData,
} from "@/services/marketIntelligenceService";

export type ActivityPoint = { date: string } & Record<string, number>;
export type KeywordPoint = { term: string; count: number; fill: string };
export type BlueOceanPoint = { term: string; demand: number; competition: number; status: "blue" | "red" | "niche" };
export type IntelligenceFeedItem = {
  id: string;
  createdAt: string;
  title: string;
  kind: "ads" | "trend" | "copy";
};

export type MarketKpi = {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  changeText: string;
  iconName: "Users" | "Zap" | "RefreshCcw" | "Globe";
};

export const tooltipContentStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  backdropFilter: "blur(10px)",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.3)",
  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
} as const;

export const useMarketIntelligenceDashboard = () => {
  const [timeframe, setTimeframe] = useState<MarketTimeframe>("30d");
  const [refreshToken, setRefreshToken] = useState(0);
  const [data, setData] = useState<MarketDashboardData>({ competitors: [], ads: [], trends: [], feed: [] });
  const [error, setError] = useState<MarketDashboardError | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      const res = await getMarketDashboardData(timeframe);
      if (cancelled) return;

      setData(res.data);
      setError(res.error);

      if (res.error) {
        toast.error("Falha ao carregar inteligência de mercado", {
          description: res.error.missingTables?.length
            ? `Tabelas ausentes: ${res.error.missingTables.join(", ")}`
            : "Conecte as automações (n8n + Apify) e o Supabase para alimentar o dashboard.",
        });
      }

      setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [timeframe, refreshToken]);

  const refresh = () => setRefreshToken((n) => n + 1);

  const competitorsById = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const c of data.competitors) map.set(c.id, { id: c.id, name: c.name });
    return map;
  }, [data.competitors]);

  const sevenDaysAgoIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const activeAdsCount = useMemo(() => {
    return data.ads.filter((ad) => {
      if (ad.status === "active") return true;
      if (ad.status === "inactive") return false;
      if (ad.ended_at) return false;
      return true;
    }).length;
  }, [data.ads]);

  const newCreatives7dCount = useMemo(() => {
    return data.ads.filter((ad) => {
      if (!ad.created_at) return false;
      return ad.created_at >= sevenDaysAgoIso;
    }).length;
  }, [data.ads, sevenDaysAgoIso]);

  const competitorsCount = data.competitors.length;

  const blueOceanGapsCount = useMemo(() => {
    return data.trends.filter((t) => t.demand >= 60 && t.competition <= 40).length;
  }, [data.trends]);

  const topCompetitorsForChart = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ad of data.ads) {
      counts.set(ad.competitor_id, (counts.get(ad.competitor_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => competitorsById.get(id)?.name ?? "Concorrente");
  }, [data.ads, competitorsById]);

  const activitySeries = useMemo<ActivityPoint[]>(() => {
    const seriesByDate = new Map<string, ActivityPoint>();

    for (const ad of data.ads) {
      if (!ad.created_at) continue;

      const date = new Date(ad.created_at);
      const key = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const competitorName = competitorsById.get(ad.competitor_id)?.name ?? "Concorrente";
      if (!topCompetitorsForChart.includes(competitorName)) continue;

      const point = seriesByDate.get(key) ?? ({ date: key } as ActivityPoint);
      point[competitorName] = (point[competitorName] ?? 0) + 1;
      seriesByDate.set(key, point);
    }

    return [...seriesByDate.values()];
  }, [data.ads, competitorsById, topCompetitorsForChart]);

  const keywords = useMemo<KeywordPoint[]>(() => {
    const stopWords = new Set([
      "a",
      "o",
      "os",
      "as",
      "de",
      "do",
      "da",
      "dos",
      "das",
      "e",
      "em",
      "para",
      "por",
      "com",
      "sem",
      "um",
      "uma",
      "no",
      "na",
      "nos",
      "nas",
      "você",
      "voce",
      "seu",
      "sua",
      "seus",
      "suas",
      "mais",
      "menos",
      "curso",
      "cursos",
      "ens",
      "online",
    ]);

    const counts = new Map<string, number>();
    for (const ad of data.ads) {
      const text = ad.copy_text?.trim();
      if (!text) continue;

      const tokens = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 4 && !stopWords.has(t));

      for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    const palette = ["#9b87f5", "#7E69AB", "#D6BCFA", "#E0CCFA", "#8884d8", "#82ca9d"];
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term, count], idx) => ({ term, count, fill: palette[idx % palette.length] }));
  }, [data.ads]);

  const blueOceanPoints = useMemo<BlueOceanPoint[]>(() => {
    return data.trends
      .map((t) => {
        const status: BlueOceanPoint["status"] =
          t.demand >= 60 && t.competition <= 40 ? "blue" : t.competition >= 65 ? "red" : "niche";
        return { term: t.term, demand: t.demand, competition: t.competition, status };
      })
      .slice(0, 50);
  }, [data.trends]);

  const intelligenceFeed = useMemo<IntelligenceFeedItem[]>(() => {
    const items: IntelligenceFeedItem[] = [];

    // 1. Itens do Feed (Banco de Dados)
    for (const item of data.feed) {
      let kind: "ads" | "trend" | "copy" = "trend";
      if (item.type === "new_ad") kind = "ads";
      else if (item.type === "copy_analysis") kind = "copy";

      items.push({
        id: item.id,
        createdAt: item.created_at,
        title: item.title,
        kind,
      });
    }

    // 2. Itens derivados (Novos Anúncios)
    for (const ad of data.ads.slice(0, 3)) {
      const competitorName = competitorsById.get(ad.competitor_id)?.name ?? "Concorrente";
      const createdAt = ad.created_at ?? new Date().toISOString();
      // Evitar duplicatas se já vieram do feed
      if (!items.some((i) => i.title.includes(competitorName) && Math.abs(new Date(i.createdAt).getTime() - new Date(createdAt).getTime()) < 60000)) {
         items.push({
          id: `ad:${ad.id}`,
          createdAt,
          title: `${competitorName} adicionou um novo criativo.`,
          kind: "ads",
        });
      }
    }

    // 3. Itens derivados (Tendências)
    for (const t of data.trends.slice(0, 3)) {
      const createdAt = t.created_at ?? new Date().toISOString();
      const delta = typeof t.delta_pct === "number" ? ` (${t.delta_pct > 0 ? "+" : ""}${t.delta_pct}%)` : "";
      items.push({
        id: `trend:${t.id}`,
        createdAt,
        title: `Tendência: “${t.term}”${delta}.`,
        kind: "trend",
      });
    }

    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 10);
  }, [data.ads, data.trends, data.feed, competitorsById]);

  const kpis: MarketKpi[] = useMemo(
    () => [
      {
        label: "Players monitorados",
        value: competitorsCount.toLocaleString("pt-BR"),
        trend: "neutral",
        changeText: "base do radar",
        iconName: "Users",
      },
      {
        label: "Anúncios ativos",
        value: activeAdsCount.toLocaleString("pt-BR"),
        trend: "up",
        changeText: "no período",
        iconName: "Zap",
      },
      {
        label: "Novos criativos (7d)",
        value: newCreatives7dCount.toLocaleString("pt-BR"),
        trend: "up",
        changeText: "capturados",
        iconName: "RefreshCcw",
      },
      {
        label: "Gaps detectados",
        value: blueOceanGapsCount.toLocaleString("pt-BR"),
        trend: blueOceanGapsCount > 0 ? "up" : "neutral",
        changeText: "oceano azul",
        iconName: "Globe",
      },
    ],
    [activeAdsCount, blueOceanGapsCount, competitorsCount, newCreatives7dCount],
  );

  const chartPalette = [
    { stroke: "#9b87f5", fill: "rgba(155, 135, 245, 0.20)" },
    { stroke: "#7E69AB", fill: "rgba(126, 105, 171, 0.18)" },
    { stroke: "#82ca9d", fill: "rgba(130, 202, 157, 0.16)" },
    { stroke: "#ffc658", fill: "rgba(255, 198, 88, 0.14)" },
  ];

  return {
    timeframe,
    setTimeframe,
    refresh,
    isLoading,
    error,
    kpis,
    topCompetitorsForChart,
    activitySeries,
    keywords,
    blueOceanPoints,
    intelligenceFeed,
    chartPalette,
  };
};
