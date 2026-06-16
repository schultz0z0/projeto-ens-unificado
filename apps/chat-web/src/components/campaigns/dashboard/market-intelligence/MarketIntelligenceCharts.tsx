import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Brain, Zap } from "lucide-react";
import { motion } from "framer-motion";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { ActivityPoint, KeywordPoint, tooltipContentStyle } from "./useMarketIntelligenceDashboard";

type Props = {
  isLoading: boolean;
  activitySeries: ActivityPoint[];
  topCompetitorsForChart: string[];
  palette: Array<{ stroke: string; fill: string }>;
  keywords: KeywordPoint[];
};

const MarketIntelligenceCharts = ({
  isLoading,
  activitySeries,
  topCompetitorsForChart,
  palette,
  keywords,
}: Props) => {
  return (
    <div className="grid gap-6 md:grid-cols-7">
      <motion.div
        className="md:col-span-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <Card className="glass-surface border-none shadow-glass">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
                  Radar de Atividade (Ad Library)
                </CardTitle>
                <CardDescription>Novos criativos capturados por dia (janela selecionada)</CardDescription>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                Ao vivo
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : activitySeries.length === 0 ? (
                <div className="h-full w-full grid place-items-center text-center px-6">
                  <p className="text-sm font-medium text-slate-900">Sem atividade registrada</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Conecte o Watchdog (n8n + Apify) para preencher o histórico de anúncios.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activitySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Legend />
                    {topCompetitorsForChart.map((name, idx) => (
                      <Area
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stackId="1"
                        name={name}
                        stroke={palette[idx % palette.length]?.stroke}
                        fill={palette[idx % palette.length]?.fill}
                        strokeWidth={2}
                        isAnimationActive
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        className="md:col-span-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <Card className="glass-surface border-none shadow-glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" aria-hidden="true" />
              Análise de Promessas & Copy
            </CardTitle>
            <CardDescription>Termos mais recorrentes nas copys (janela selecionada)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : keywords.length === 0 ? (
                <div className="h-full w-full grid place-items-center text-center px-6">
                  <p className="text-sm font-medium text-slate-900">Sem conteúdo suficiente</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Quando o scraping salvar a copy dos anúncios, este ranking aparece automaticamente.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={keywords} layout="vertical" margin={{ top: 5, right: 24, left: 16, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="term"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={120}
                      tick={{ fill: "#4b5563", fontSize: 13, fontWeight: 500 }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,0,0,0.03)" }}
                      contentStyle={tooltipContentStyle}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={30}>
                      {keywords.map((entry, idx) => (
                        <Cell key={`${entry.term}-${idx}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default MarketIntelligenceCharts;

