import React, { useState } from "react";
import { Globe, Loader2, Minus, PlugZap, RefreshCcw, TrendingDown, TrendingUp, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import MarketIntelligenceCharts from "./MarketIntelligenceCharts";
import MarketIntelligenceInsights from "./MarketIntelligenceInsights";
import { MarketKpi, useMarketIntelligenceDashboard } from "./useMarketIntelligenceDashboard";

const MarketIntelligenceDashboard = () => {
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const {
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
  } = useMarketIntelligenceDashboard();

  const iconByName: Record<MarketKpi["iconName"], LucideIcon> = {
      Users,
      Zap,
      RefreshCcw,
      Globe,
    };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            Oceano Azul
          </h2>
          <p className="text-sm text-slate-600">
            Benchmarking de concorrentes, análise de copy e detecção de oportunidades.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-white/40 border-white/30 text-slate-700 shadow-sm"
            onClick={() => setIsSourcesOpen(true)}
          >
            <PlugZap className="mr-2 h-4 w-4" aria-hidden="true" />
            Fontes
          </Button>

          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/40 px-3 py-1 shadow-glass">
            <span className="text-xs font-medium text-slate-700">Janela</span>
            <div className="flex items-center gap-1">
              {([
                { key: "7d", label: "7d" },
                { key: "30d", label: "30d" },
                { key: "90d", label: "90d" },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-medium transition-colors",
                    timeframe === t.key
                      ? "bg-brand-primary/20 text-brand-primary"
                      : "text-slate-600 hover:bg-white/60"
                  )}
                  onClick={() => setTimeframe(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={refresh}
            disabled={isLoading}
            className="h-8 w-8 rounded-full"
            title="Atualizar dados"
          >
            <RefreshCcw className={cn("h-4 w-4 text-slate-500", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Erro ao carregar dados</p>
          <p>{error.message}</p>
          {error.missingTables && (
            <p className="mt-1 text-xs">
              Tabelas ausentes: {error.missingTables.join(", ")}. Rode a migration no Supabase.
            </p>
          )}
        </div>
      )}

      {/* KPIs Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = iconByName[kpi.iconName];
          return (
            <Card key={kpi.label} className="glass-surface border-none shadow-glass overflow-hidden relative">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Icon className="h-16 w-16" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {kpi.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-brand-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {isLoading ? <Skeleton className="h-8 w-24" /> : kpi.value}
                </div>
                <div className="flex items-center text-xs text-slate-500 mt-1">
                  {kpi.trend === "up" ? (
                    <TrendingUp className="mr-1 h-3 w-3 text-emerald-500" />
                  ) : kpi.trend === "down" ? (
                    <TrendingDown className="mr-1 h-3 w-3 text-rose-500" />
                  ) : (
                    <Minus className="mr-1 h-3 w-3 text-slate-400" />
                  )}
                  <span className={cn(
                    kpi.trend === "up" ? "text-emerald-600" : kpi.trend === "down" ? "text-rose-600" : "text-slate-500"
                  )}>
                    {kpi.changeText}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <MarketIntelligenceCharts
        isLoading={isLoading}
        activitySeries={activitySeries}
        topCompetitorsForChart={topCompetitorsForChart}
        palette={chartPalette}
        keywords={keywords}
      />

      <MarketIntelligenceInsights
        isLoading={isLoading}
        blueOceanPoints={blueOceanPoints}
        intelligenceFeed={intelligenceFeed}
      />

      <Dialog open={isSourcesOpen} onOpenChange={setIsSourcesOpen}>
        <DialogContent className="sm:max-w-[520px] glass-surface border-white/20 text-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-slate-800" aria-hidden="true" />
              Fontes de dados
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Gerencie as conexões que alimentam o Oceano Azul.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-white/30 bg-white/30 backdrop-blur-md p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-slate-900">Meta Ads Library</p>
                <p className="text-xs text-slate-600">Monitoramento de criativos via n8n</p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Ativo</Badge>
            </div>
            <div className="rounded-xl border border-white/30 bg-white/30 backdrop-blur-md p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-slate-900">Google Trends</p>
                <p className="text-xs text-slate-600">Tendências de busca via n8n</p>
              </div>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20">Pendente</Badge>
            </div>
            <div className="rounded-xl border border-white/30 bg-white/30 backdrop-blur-md p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-slate-900">Web Scraper (LPs)</p>
                <p className="text-xs text-slate-600">Análise de copy e promessas</p>
              </div>
              <Badge variant="outline" className="bg-slate-500/10 text-slate-700 border-slate-500/20">Inativo</Badge>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="bg-white/40 border-white/30"
              onClick={() => setIsSourcesOpen(false)}
            >
              Fechar
            </Button>
            <Button
              className="gradient-primary text-white shadow-glass"
              onClick={() =>
                toast.message("Configuração", {
                  description: "Use o n8n para configurar os webhooks de cada fonte.",
                })
              }
            >
              Configurar no n8n
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketIntelligenceDashboard;
