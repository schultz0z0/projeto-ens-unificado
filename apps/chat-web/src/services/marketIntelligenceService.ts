import { supabase } from "@/lib/supabase";

export type MarketTimeframe = "7d" | "30d" | "90d";

export type Competitor = {
  id: string;
  name: string;
  domain?: string | null;
  is_active?: boolean | null;
};

export type CompetitorAdStatus = "active" | "inactive" | "unknown";

export type CompetitorAd = {
  id: string;
  competitor_id: string;
  ad_library_id?: string | null;
  status?: CompetitorAdStatus | null;
  created_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  platform?: string | null;
  format?: string | null;
  copy_text?: string | null;
  landing_page_url?: string | null;
  thumbnail_url?: string | null;
};

export type MarketTrend = {
  id: string;
  term: string;
  demand: number;
  competition: number;
  delta_pct?: number | null;
  created_at?: string | null;
};

export type MarketFeedItem = {
  id: string;
  type: "opportunity" | "threat" | "new_ad" | "trend" | "copy_analysis";
  title: string;
  description?: string | null;
  severity?: "low" | "medium" | "high" | null;
  is_read?: boolean | null;
  created_at?: string | null;
};

export type MarketDashboardData = {
  competitors: Competitor[];
  ads: CompetitorAd[];
  trends: MarketTrend[];
  feed: MarketFeedItem[];
};

export type MarketDashboardError = {
  message: string;
  missingTables?: string[];
};

const timeframeToDays = (timeframe: MarketTimeframe) => {
  if (timeframe === "7d") return 7;
  if (timeframe === "90d") return 90;
  return 30;
};

const getSinceIso = (timeframe: MarketTimeframe) => {
  const days = timeframeToDays(timeframe);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const detectMissingTables = (message: string) => {
  const missing: string[] = [];
  const patterns = [
    { table: "competitors", regex: /\bcompetitors\b/i },
    { table: "competitor_ads", regex: /\bcompetitor_ads\b/i },
    { table: "market_trends", regex: /\bmarket_trends\b/i },
  ];

  const isMissingRelation = /does not exist|relation .* does not exist|42P01/i.test(message);
  if (!isMissingRelation) return [];

  for (const p of patterns) {
    if (p.regex.test(message)) missing.push(p.table);
  }
  return missing;
};

export const getMarketDashboardData = async (timeframe: MarketTimeframe): Promise<
  { data: MarketDashboardData; error: null } | { data: MarketDashboardData; error: MarketDashboardError }
> => {
  const empty: MarketDashboardData = { competitors: [], ads: [], trends: [], feed: [] };
  const since = getSinceIso(timeframe);

  try {
    const [competitorsRes, adsRes, trendsRes, feedRes] = await Promise.all([
      supabase
        .from("market_competitors")
        .select("id, name, domain, is_active")
        .order("name", { ascending: true }),
      supabase
        .from("market_competitor_ads")
        .select(
          "id, competitor_id, ad_library_id, status, created_at, started_at, ended_at, platform, format, copy_text, landing_page_url, thumbnail_url",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1500),
      supabase
        .from("market_trends")
        .select("id, term, demand:demand_score, competition:competition_score, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("market_intelligence_feed")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const errors = [competitorsRes.error, adsRes.error, trendsRes.error, feedRes.error].filter(Boolean);
    if (errors.length > 0) {
      const message = errors.map((e) => e?.message).filter(Boolean).join(" | ") || "Falha ao carregar dados.";
      const missingTables = detectMissingTables(message);
      return { data: empty, error: { message, missingTables: missingTables.length ? missingTables : undefined } };
    }

    return {
      data: {
        competitors: (competitorsRes.data ?? []) as Competitor[],
        ads: (adsRes.data ?? []) as CompetitorAd[],
        trends: (trendsRes.data ?? []) as MarketTrend[],
        feed: (feedRes.data ?? []) as MarketFeedItem[],
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha inesperada ao carregar dados.";
    return { data: empty, error: { message, missingTables: detectMissingTables(message) } };
  }
};
