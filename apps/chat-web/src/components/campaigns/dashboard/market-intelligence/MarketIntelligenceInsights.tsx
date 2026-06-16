import React from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Brain, Globe, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { BlueOceanPoint, IntelligenceFeedItem, tooltipContentStyle } from "./useMarketIntelligenceDashboard";

type Props = {
  isLoading: boolean;
  blueOceanPoints: BlueOceanPoint[];
  intelligenceFeed: IntelligenceFeedItem[];
};

const formatRelativeTime = (iso: string) => {
  const d = new Date(iso);
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
};

const MarketIntelligenceInsights = ({ isLoading, blueOceanPoints, intelligenceFeed }: Props) => {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
      >
        <Card className="glass-surface border-none shadow-glass">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  Blue Ocean Radar
                </CardTitle>
                <CardDescription>Demanda (busca) vs. competição (densidade de anúncios)</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-white/40 border-white/30"
                onClick={() => toast.message("Em breve", { description: "Detalhamento dos termos e recomendações." })}
              >
                Detalhar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full rounded-xl border border-white/20 bg-white/20 p-2">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : blueOceanPoints.length === 0 ? (
                <div className="h-full w-full grid place-items-center text-center px-6">
                  <p className="text-sm font-medium text-slate-900">Sem dados de tendências</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Conecte o Trend Spotter (Google Trends + cruzamento de anúncios) para gerar oportunidades.
                  </p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis
                        type="number"
                        dataKey="demand"
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        label={{ value: "Volume de busca", position: "bottom", offset: 0, fill: "#64748b", fontSize: 12 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="competition"
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                        label={{ value: "Densidade de anúncios", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }}
                      />
                      <ReferenceLine x={50} stroke="#cbd5e1" strokeDasharray="3 3" />
                      <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="3 3" />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={tooltipContentStyle}
                        labelFormatter={(_, payload) => {
                          const term = (payload?.[0]?.payload as { term?: string } | undefined)?.term;
                          return term ? `Termo: ${term}` : "";
                        }}
                        formatter={(value: number | string, name: string) => {
                          const label = name === "demand" ? "Demanda" : name === "competition" ? "Competição" : name;
                          return [String(value), label];
                        }}
                      />
                      <Scatter data={blueOceanPoints} fill="#9b87f5">
                        {blueOceanPoints.map((p, idx) => (
                          <Cell
                            key={`${p.term}-${idx}`}
                            fill={p.status === "blue" ? "#10b981" : p.status === "red" ? "#ef4444" : "#f59e0b"}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      Oceano Azul
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" />
                      Saturado
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                      Nicho
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="glass-surface border-none shadow-glass h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-600" aria-hidden="true" />
              Feed de Inteligência
            </CardTitle>
            <CardDescription>Alertas gerados automaticamente pelas automações</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : intelligenceFeed.length === 0 ? (
              <div className="h-[320px] w-full grid place-items-center text-center px-6">
                <p className="text-sm font-medium text-slate-900">Sem alertas ainda</p>
                <p className="text-xs text-slate-600 mt-1">
                  Assim que o radar capturar anúncios e tendências, os insights aparecem aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {intelligenceFeed.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-2xl border border-white/20 bg-white/40 p-3 shadow-glass"
                  >
                    <div
                      className={cn(
                        "mt-0.5 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/60",
                        item.kind === "trend" && "text-purple-700",
                        item.kind === "ads" && "text-blue-700",
                        item.kind === "copy" && "text-amber-700",
                      )}
                    >
                      {item.kind === "trend" ? (
                        <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      ) : item.kind === "ads" ? (
                        <Zap className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Brain className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                        <span className="text-xs text-slate-500 shrink-0">{formatRelativeTime(item.createdAt)}</span>
                      </div>
                      <div className="mt-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "bg-white/40 border-white/20",
                            item.kind === "trend" && "text-purple-700",
                            item.kind === "ads" && "text-blue-700",
                            item.kind === "copy" && "text-amber-700",
                          )}
                        >
                          {item.kind === "trend" ? "Trend" : item.kind === "ads" ? "Ad Library" : "Copy"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-white/40 border-white/30"
                  onClick={() => toast.message("Em breve", { description: "Página completa de alertas e histórico." })}
                >
                  Ver todos os alertas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default MarketIntelligenceInsights;
