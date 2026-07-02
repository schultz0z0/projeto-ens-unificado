import { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Loader2, Pencil, Search } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  getValidatedWorkStatusLabel,
  getValidatedWorkTypeLabel,
  parseTagsInput,
  VALIDATED_WORK_TYPES,
  ValidatedWork,
  ValidatedWorkStatus,
  ValidatedWorkType,
} from "@/lib/validatedWorks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type TypeFilter = "all" | ValidatedWorkType;
type StatusFilter = "all" | ValidatedWorkStatus;

const statusBadgeClass: Record<ValidatedWorkStatus, string> = {
  draft: "bg-amber-500/20 text-amber-700 border-amber-500/20",
  validated: "bg-emerald-500/20 text-emerald-700 border-emerald-500/20",
  deprecated: "bg-slate-500/20 text-slate-700 border-slate-500/20",
};

const formatDate = (value?: string | null) => {
  if (!value) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function ValidatedWorksPage() {
  const { user, profile } = useAuth();
  const [works, setWorks] = useState<ValidatedWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<ValidatedWork | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formStatus, setFormStatus] = useState<ValidatedWorkStatus>("validated");
  const [formCourseTitle, setFormCourseTitle] = useState("");
  const [formTags, setFormTags] = useState("");
  const [saving, setSaving] = useState(false);

  const loadWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("validated_works")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(250);
      if (error) throw error;
      setWorks((data ?? []) as ValidatedWork[]);
    } catch (error: unknown) {
      toast.error("Erro ao carregar trabalhos validados: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorks();
  }, []);

  const filteredWorks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return works.filter((work) => {
      if (typeFilter !== "all" && work.artifact_type !== typeFilter) return false;
      if (statusFilter !== "all" && work.status !== statusFilter) return false;
      if (!query) return true;
      return [
        work.title,
        work.content,
        work.related_course_title,
        work.created_by_name,
        work.validated_by_name,
        ...(work.tags ?? []),
      ].join("\n").toLowerCase().includes(query);
    });
  }, [works, searchTerm, typeFilter, statusFilter]);

  const openEdit = (work: ValidatedWork) => {
    setEditing(work);
    setFormTitle(work.title);
    setFormContent(work.content);
    setFormStatus(work.status);
    setFormCourseTitle(work.related_course_title ?? "");
    setFormTags((work.tags ?? []).join(", "));
  };

  const closeEdit = () => {
    setEditing(null);
    setFormTitle("");
    setFormContent("");
    setFormStatus("validated");
    setFormCourseTitle("");
    setFormTags("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Titulo e conteudo sao obrigatorios.");
      return;
    }
    try {
      setSaving(true);
      const now = new Date().toISOString();
      const becameValidated = editing.status !== "validated" && formStatus === "validated";
      const payload: Partial<ValidatedWork> = {
        title: formTitle.trim(),
        content: formContent.trim(),
        status: formStatus,
        related_course_title: formCourseTitle.trim() || null,
        tags: parseTagsInput(formTags),
      };
      if (becameValidated) {
        payload.validated_at = now;
        payload.validated_by_user_id = user?.id ?? null;
        payload.validated_by_name = profile?.full_name || profile?.email || "Usuario ENS";
      }

      const { error } = await supabase
        .from("validated_works")
        .update(payload)
        .eq("id", editing.id);
      if (error) throw error;
      toast.success("Trabalho validado atualizado.");
      closeEdit();
      loadWorks();
    } catch (error: unknown) {
      toast.error("Erro ao salvar: " + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const archiveWork = async (work: ValidatedWork) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("validated_works")
        .update({
          status: "deprecated",
          deprecated_by_user_id: user?.id ?? null,
          deprecated_at: new Date().toISOString(),
          metadata: {
            ...(work.metadata ?? {}),
            deprecated_by_name: profile?.full_name || profile?.email || "Usuario ENS",
          },
        })
        .eq("id", work.id);
      if (error) throw error;
      toast.success("Trabalho arquivado.");
      loadWorks();
    } catch (error: unknown) {
      toast.error("Erro ao arquivar: " + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-background">
      <Sidebar />
      <main className="ml-0 md:ml-20 p-4 md:p-8 space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Trabalhos Validados</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie a memoria compartilhada de copy, campanhas, briefings, insights, decisoes, prompts e estrategias.
            </p>
          </div>
          <Button variant="outline" onClick={loadWorks} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Atualizar
          </Button>
        </div>

        <div className="glass-surface rounded-xl border border-white/10 p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por titulo, curso, autor, validador ou conteudo..."
              className="pl-9 bg-white/5 border-white/10"
            />
          </div>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
            <SelectTrigger className="md:w-48 bg-white/5 border-white/10">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {VALIDATED_WORK_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{getValidatedWorkTypeLabel(type)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="md:w-48 bg-white/5 border-white/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="validated">Validados</SelectItem>
              <SelectItem value="draft">Rascunhos</SelectItem>
              <SelectItem value="deprecated">Arquivados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-20 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            Carregando memoria validada...
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredWorks.map((work) => (
              <Card key={work.id} className="glass-surface border-white/10">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getValidatedWorkTypeLabel(work.artifact_type)}</Badge>
                    <Badge variant="outline" className={statusBadgeClass[work.status]}>
                      {getValidatedWorkStatusLabel(work.status)}
                    </Badge>
                    {work.related_course_title ? <Badge variant="secondary">{work.related_course_title}</Badge> : null}
                  </div>
                  <CardTitle className="text-lg leading-snug">{work.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-5">{work.content}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Autor: {work.created_by_name || "nao informado"}</p>
                    <p>Validado por: {work.validated_by_name || "nao informado"} em {formatDate(work.validated_at)}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(work)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    {work.status !== "validated" ? (
                      <Button size="sm" onClick={() => openEdit({ ...work, status: "validated" })}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Validar
                      </Button>
                    ) : null}
                    {work.status !== "deprecated" ? (
                      <Button variant="destructive" size="sm" onClick={() => archiveWork(work)} disabled={saving}>
                        <Archive className="w-4 h-4 mr-2" />
                        Arquivar
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredWorks.length === 0 ? (
              <div className="xl:col-span-2 rounded-xl border border-white/10 p-12 text-center text-muted-foreground">
                Nenhum trabalho encontrado para os filtros atuais.
              </div>
            ) : null}
          </div>
        )}
      </main>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="sm:max-w-2xl" style={{ backgroundColor: "#ffffff" }}>
          <DialogHeader>
            <DialogTitle>Editar trabalho validado</DialogTitle>
            <DialogDescription>
              Alteracoes aqui afetam a memoria compartilhada que o Hermes consulta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="work-title">Titulo</Label>
              <Input id="work-title" value={formTitle} onChange={(event) => setFormTitle(event.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="work-status">Status</Label>
                <Select value={formStatus} onValueChange={(value) => setFormStatus(value as ValidatedWorkStatus)}>
                  <SelectTrigger id="work-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="validated">Validado</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="deprecated">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-course">Curso relacionado</Label>
                <Input id="work-course" value={formCourseTitle} onChange={(event) => setFormCourseTitle(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-tags">Tags</Label>
              <Input id="work-tags" value={formTags} onChange={(event) => setFormTags(event.target.value)} placeholder="marketing, gestao, pos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-content">Conteudo</Label>
              <Textarea
                id="work-content"
                value={formContent}
                onChange={(event) => setFormContent(event.target.value)}
                className="min-h-[220px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}
