import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Globe, PlugZap, Plus, Search, Trash2 } from "lucide-react";

const CampaignListView = () => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const competitors = React.useMemo(
    () =>
      [] as Array<{
        id: string;
        name: string;
        domain?: string;
        isActive: boolean;
        adsActive: number;
        adsInactive: number;
      }>,
    []
  );

  const filteredCompetitors = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return competitors;
    return competitors.filter((c) => c.name.toLowerCase().includes(q));
  }, [competitors, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="glass-surface shadow-glass rounded-2xl border border-white/20 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              Concorrentes monitorados
            </h2>
            <p className="text-sm text-slate-600">
              Gerencie quais players entram no radar e controle o histórico armazenado.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[460px]">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true" />
                <Input
                  placeholder="Buscar concorrente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white/40 backdrop-blur-md border-white/30 focus-visible:ring-primary/30 placeholder:text-slate-500"
                  aria-label="Buscar concorrente"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  className="gradient-primary text-white shadow-glass"
                  onClick={() =>
                    toast.message("Em breve", {
                      description: "A conexão de fontes será habilitada via integrações (n8n + Apify).",
                    })
                  }
                >
                  <PlugZap className="mr-2 h-4 w-4" aria-hidden="true" />
                  Conectar fontes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/40 border-white/30"
                  onClick={() =>
                    toast.message("Em breve", {
                      description: "Cadastro de concorrentes será liberado ao conectar a camada de dados.",
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Adicionar
                </Button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Dica: para economizar espaço no Supabase, você poderá apagar anúncios antigos por concorrente.
            </p>
          </div>
        </div>
      </div>

      {filteredCompetitors.length === 0 ? (
        <Card className="glass-surface shadow-glass border-white/20">
          <CardHeader>
            <CardTitle>Nenhum concorrente configurado</CardTitle>
            <CardDescription>
              Conecte as fontes para começar a coletar anúncios e construir o histórico (ativo e inativo).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/30 bg-white/30 backdrop-blur-md p-4">
                <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-slate-700" aria-hidden="true" />
                  Histórico persistente
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Quando um anúncio sair do ar, ele fica marcado como inativo, mas continua disponível para análise.
                </p>
              </div>
              <div className="rounded-xl border border-white/30 bg-white/30 backdrop-blur-md p-4">
                <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-slate-700" aria-hidden="true" />
                  Controle de espaço
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Você poderá excluir anúncios por concorrente (ou por data) para liberar espaço no Supabase.
                </p>
              </div>
            </div>

            <Separator className="bg-white/30" />

            <div className="flex flex-col md:flex-row gap-3">
              <Button
                type="button"
                className="gradient-primary text-white shadow-glass"
                onClick={() =>
                  toast.message("Próximo passo", {
                    description: "Abra a aba Inteligência e clique em Fontes para configurar.",
                  })
                }
              >
                <PlugZap className="mr-2 h-4 w-4" aria-hidden="true" />
                Ir para Fontes
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-white/40 border-white/30"
                onClick={() => setSearchTerm("")}
              >
                Limpar busca
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCompetitors.map((c) => (
            <Card key={c.id} className="glass-surface shadow-glass border-white/20">
              <CardHeader className="space-y-1">
                <CardTitle className="text-base text-slate-900">{c.name}</CardTitle>
                <CardDescription className="text-slate-600">{c.domain ?? "Sem domínio associado"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/30 bg-white/30 backdrop-blur-md p-3">
                    <p className="text-xs text-slate-600">Ativos</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{c.adsActive}</p>
                  </div>
                  <div className="rounded-xl border border-white/30 bg-white/30 backdrop-blur-md p-3">
                    <p className="text-xs text-slate-600">Inativos</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{c.adsInactive}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    className="gradient-primary text-white shadow-glass"
                    onClick={() => toast.message("Em breve", { description: "Abrirá o feed de anúncios do concorrente." })}
                  >
                    Ver anúncios
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white/40 border-white/30"
                    onClick={() =>
                      toast.message("Em breve", { description: "A limpeza de histórico será conectada ao Supabase." })
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Limpar histórico
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CampaignListView;
