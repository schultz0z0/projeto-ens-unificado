import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MarketingOpsClient } from '@/lib/marketingOps/client';
import { MarketingOpsApiError } from '@/lib/marketingOps/client';
import { marketingOpsKeys } from '@/lib/marketingOps/queryKeys';
import { localDateTimeToUtc, utcToLocalDateTime } from '@/lib/marketingOps/timezone';
import type {
  MarketingOpsCampaignChannel,
  MarketingOpsCampaignSummary,
  MarketingOpsItemKind,
  MarketingOpsItemPriority,
  MarketingOpsItemStatus,
  MarketingOpsProductionItem,
  MarketingOpsProductionItemCreate,
  MarketingOpsProductionItemPatch
} from '@/lib/marketingOps/types';

interface ProductionItemDialogProps {
  open: boolean;
  itemId: string | null;
  campaigns: MarketingOpsCampaignSummary[];
  timeZone: string;
  canWrite: boolean;
  client: MarketingOpsClient;
  createIdempotencyKey: () => string;
  onOpenChange: (open: boolean) => void;
  onCreated: (itemId: string) => void;
}

interface ItemForm {
  campaignId: string;
  title: string;
  kind: MarketingOpsItemKind;
  priority: MarketingOpsItemPriority;
  channel: MarketingOpsCampaignChannel | '';
  assigneeUserId: string;
  description: string;
  startsAt: string;
  dueAt: string;
}

const emptyForm = (): ItemForm => ({
  campaignId: '',
  title: '',
  kind: 'task',
  priority: 'normal',
  channel: '',
  assigneeUserId: '',
  description: '',
  startsAt: '',
  dueAt: ''
});

const selectClass = 'h-11 w-full rounded-[8px] border border-input bg-white/80 px-3 text-sm text-text-primary outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60';

function utcInput(value: string | null, timeZone: string): string {
  if (!value) return '';
  try {
    return utcToLocalDateTime(value, timeZone);
  } catch {
    return '';
  }
}

function inputUtc(value: string, timeZone: string): string | null {
  if (!value) return null;
  return localDateTimeToUtc(value, timeZone);
}

function formFromItem(item: MarketingOpsProductionItem, timeZone: string): ItemForm {
  return {
    campaignId: item.campaignId,
    title: item.title,
    kind: item.kind,
    priority: item.priority,
    channel: item.channel ?? '',
    assigneeUserId: item.assigneeUserId ?? '',
    description: item.description ?? '',
    startsAt: utcInput(item.startsAt, timeZone),
    dueAt: utcInput(item.dueAt, timeZone)
  };
}

function errorCorrelation(error: unknown): string | null {
  return error instanceof MarketingOpsApiError ? error.correlationId : null;
}

const READINESS_LABELS: Record<string, string> = {
  title: 'Título',
  assigneeUserId: 'Responsável',
  dueAt: 'Prazo',
};

function readinessGateFields(item: MarketingOpsProductionItem): string[] {
  const missing: string[] = [];
  if (!item.title?.trim()) missing.push('title');
  if (!item.assigneeUserId) missing.push('assigneeUserId');
  if (!item.dueAt) missing.push('dueAt');
  return missing;
}

function formatMissingFields(details: unknown): string {
  if (!details || typeof details !== 'object') return 'Preencha todos os campos obrigatórios antes de avançar.';
  const fields = (details as { fields?: string[] }).fields;
  if (!Array.isArray(fields) || !fields.length) return 'Preencha todos os campos obrigatórios antes de avançar.';
  const labels = fields.map(f => READINESS_LABELS[f] ?? f);
  return `Preencha os campos a seguir antes de marcar como pronto: ${labels.join(', ')}.`;
}

const transitionOptions: Record<
  Exclude<MarketingOpsItemStatus, 'completed' | 'cancelled'>,
  Array<{ to: MarketingOpsItemStatus; label: string; destructive?: boolean }>
> = {
  draft: [
    { to: 'ready', label: 'Marcar como pronto' },
    { to: 'cancelled', label: 'Cancelar item', destructive: true }
  ],
  ready: [
    { to: 'draft', label: 'Voltar a rascunho' },
    { to: 'in_review', label: 'Enviar para revisão' },
    { to: 'cancelled', label: 'Cancelar item', destructive: true }
  ],
  in_review: [
    { to: 'ready', label: 'Voltar para pronto' },
    { to: 'completed', label: 'Concluir item' },
    { to: 'cancelled', label: 'Cancelar item', destructive: true }
  ]
};

export function ProductionItemDialog({
  open,
  itemId,
  campaigns,
  timeZone,
  canWrite,
  client,
  createIdempotencyKey,
  onOpenChange,
  onCreated
}: ProductionItemDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [hydratedVersion, setHydratedVersion] = useState<number | null>(null);
  const isCreate = itemId === null;
  const itemQuery = useQuery({
    queryKey: marketingOpsKeys.productionItem(itemId ?? 'new'),
    queryFn: async () => (await client.getProductionItem(itemId as string)).data,
    enabled: open && itemId !== null
  });

  const activeCampaignId = form.campaignId || itemQuery.data?.campaignId || '';
  const participantsQuery = useQuery({
    queryKey: marketingOpsKeys.participants(activeCampaignId),
    queryFn: async () => (await client.listParticipants(activeCampaignId)).data,
    enabled: open && Boolean(activeCampaignId)
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setHydratedVersion(null);
      return;
    }
    if (itemQuery.data) {
      setForm(formFromItem(itemQuery.data, timeZone));
      setHydratedVersion(itemQuery.data.version);
    } else if (isCreate) {
      setForm(emptyForm());
      setHydratedVersion(null);
    }
  }, [isCreate, itemQuery.data, open, timeZone]);

  useEffect(() => {
    if (!open || !isCreate || !campaigns[0]) return;
    setForm((current) => current.campaignId
      ? current
      : { ...current, campaignId: campaigns[0].id });
  }, [campaigns, isCreate, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const editable = {
        title: form.title.trim(),
        kind: form.kind,
        priority: form.priority,
        channel: form.channel || null,
        assigneeUserId: form.assigneeUserId.trim() || null,
        description: form.description.trim() || null,
        startsAt: inputUtc(form.startsAt, timeZone),
        dueAt: inputUtc(form.dueAt, timeZone),
        metadata: {}
      };
      if (isCreate) {
        return client.createProductionItem({
          campaignId: form.campaignId,
          ...editable
        } satisfies MarketingOpsProductionItemCreate, createIdempotencyKey());
      }
      return client.updateProductionItem(
        itemId,
        itemQuery.data?.version ?? 0,
        editable satisfies MarketingOpsProductionItemPatch,
        createIdempotencyKey()
      );
    },
    onSuccess: async (response) => {
      setForm(formFromItem(response.data, timeZone));
      setHydratedVersion(response.data.version);
      queryClient.setQueryData(marketingOpsKeys.productionItem(response.data.id), response.data);
      await queryClient.invalidateQueries({ queryKey: ['marketing-ops', 'production', 'schedule'] });
      if (isCreate) onCreated(response.data.id);
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (to: MarketingOpsItemStatus) => client.transitionProductionItem(
      itemId as string,
      itemQuery.data?.version ?? 0,
      to,
      createIdempotencyKey()
    ),
    onSuccess: async (response) => {
      setForm(formFromItem(response.data, timeZone));
      setHydratedVersion(response.data.version);
      queryClient.setQueryData(marketingOpsKeys.productionItem(response.data.id), response.data);
      await queryClient.invalidateQueries({ queryKey: ['marketing-ops', 'production', 'schedule'] });
    }
  });

  const mutationError = saveMutation.error ?? transitionMutation.error;
  const conflict = mutationError instanceof MarketingOpsApiError && mutationError.status === 409
    ? mutationError
    : null;
  const transitions = useMemo(() => {
    const status = itemQuery.data?.status;
    return status && status !== 'completed' && status !== 'cancelled'
      ? transitionOptions[status]
      : [];
  }, [itemQuery.data?.status]);
  const missing = itemQuery.error instanceof MarketingOpsApiError && itemQuery.error.status === 404;
  const canSubmit = canWrite && Boolean(form.campaignId && form.title.trim());

  const setField = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    saveMutation.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit && !saveMutation.isPending) saveMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          saveMutation.reset();
          transitionMutation.reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[8px] border-white/60 bg-white/95 text-text-primary shadow-glass backdrop-blur-xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Novo item' : 'Detalhes do item'}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Crie um rascunho operacional vinculado a uma campanha.'
              : 'Edite agenda e responsável ou avance o item pela esteira.'}
          </DialogDescription>
        </DialogHeader>

        {itemQuery.isLoading || (!isCreate && itemQuery.data && hydratedVersion !== itemQuery.data.version) ? (
          <div aria-label="Carregando item" className="flex min-h-48 items-center justify-center">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-primary" />
            Carregando item
          </div>
        ) : missing ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Item não encontrado</AlertTitle>
            <AlertDescription>
              Ele pode ter sido removido do seu escopo ou o link está desatualizado.
              {errorCorrelation(itemQuery.error) ? (
                <span className="mt-1 block text-xs">Correlação: {errorCorrelation(itemQuery.error)}</span>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : itemQuery.isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não foi possível carregar o item</AlertTitle>
            <AlertDescription>
              Tente novamente.
              <Button type="button" variant="outline" onClick={() => itemQuery.refetch()} className="mt-3 block">
                <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={submit}>
            <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
              <Field label="Campanha" id="production-item-campaign">
                <select
                  id="production-item-campaign"
                  value={form.campaignId}
                  onChange={(event) => setField('campaignId', event.target.value)}
                  disabled={!isCreate || !canWrite}
                  className={selectClass}
                  required
                >
                  <option value="">Selecione</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Título" id="production-item-title">
                <Input
                  id="production-item-title"
                  value={form.title}
                  onChange={(event) => setField('title', event.target.value)}
                  maxLength={200}
                  disabled={!canWrite}
                  className="h-11 rounded-[8px] bg-white/80"
                  required
                />
              </Field>

              <Field label="Tipo" id="production-item-kind">
                <select
                  id="production-item-kind"
                  value={form.kind}
                  onChange={(event) => setField('kind', event.target.value as MarketingOpsItemKind)}
                  disabled={!canWrite}
                  className={selectClass}
                >
                  <option value="task">Tarefa</option>
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="post">Post</option>
                  <option value="creative">Criativo</option>
                  <option value="review">Revisão</option>
                  <option value="milestone">Marco</option>
                </select>
              </Field>

              <Field label="Prioridade" id="production-item-priority">
                <select
                  id="production-item-priority"
                  value={form.priority}
                  onChange={(event) => setField('priority', event.target.value as MarketingOpsItemPriority)}
                  disabled={!canWrite}
                  className={selectClass}
                >
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </Field>

              <Field label="Canal" id="production-item-channel">
                <select
                  id="production-item-channel"
                  value={form.channel}
                  onChange={(event) => setField('channel', event.target.value as MarketingOpsCampaignChannel | '')}
                  disabled={!canWrite}
                  className={selectClass}
                >
                  <option value="">Não definido</option>
                  <option value="email">E-mail</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website">Site</option>
                  <option value="paid_media">Mídia paga</option>
                  <option value="events">Eventos</option>
                  <option value="press">Imprensa</option>
                  <option value="other">Outro</option>
                </select>
              </Field>

              <Field label="Responsável" id="production-item-assignee">
                <select
                  id="production-item-assignee"
                  value={form.assigneeUserId}
                  onChange={(event) => setField('assigneeUserId', event.target.value)}
                  disabled={!canWrite || participantsQuery.isLoading}
                  className={selectClass}
                >
                  <option value="">Selecione</option>
                  {participantsQuery.data?.map((p) => (
                    <option key={p.userId} value={p.userId}>{p.displayName}</option>
                  ))}
                </select>
              </Field>

              <Field label={`Início (${timeZone})`} id="production-item-starts-at">
                <Input
                  id="production-item-starts-at"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setField('startsAt', event.target.value)}
                  disabled={!canWrite}
                  className="h-11 rounded-[8px] bg-white/80"
                />
              </Field>

              <Field label={`Prazo (${timeZone})`} id="production-item-due-at">
                <Input
                  id="production-item-due-at"
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) => setField('dueAt', event.target.value)}
                  disabled={!canWrite}
                  className="h-11 rounded-[8px] bg-white/80"
                />
              </Field>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="production-item-description">Descrição</Label>
                <textarea
                  id="production-item-description"
                  value={form.description}
                  onChange={(event) => setField('description', event.target.value)}
                  maxLength={5000}
                  disabled={!canWrite}
                  rows={4}
                  className={`${selectClass} h-auto min-h-24 py-3`}
                />
              </div>
            </div>

            <p className="mb-4 rounded-[8px] bg-slate-50 px-3 py-2 text-xs text-text-secondary">
              Informe o horário local de <strong>{timeZone}</strong>. A API persiste o instante em UTC.
            </p>

            {mutationError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>
                  {conflict
                    ? 'O item foi atualizado em outra sessão'
                    : mutationError instanceof MarketingOpsApiError && mutationError.code === 'item_requirements_missing'
                      ? 'Campos obrigatórios não preenchidos'
                      : 'Não foi possível salvar'}
                </AlertTitle>
                <AlertDescription>
                  {conflict?.currentVersion
                    ? `A versão atual é a versão ${conflict.currentVersion}. Recarregue antes de tentar novamente.`
                    : mutationError instanceof MarketingOpsApiError && mutationError.code === 'item_requirements_missing'
                      ? formatMissingFields(mutationError.details)
                      : mutationError.message}
                  {errorCorrelation(mutationError) ? (
                    <span className="mt-1 block text-xs">Correlação: {errorCorrelation(mutationError)}</span>
                  ) : null}
                  {conflict ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        saveMutation.reset();
                        transitionMutation.reset();
                        await itemQuery.refetch();
                      }}
                      className="mt-3"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" /> Recarregar item
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            {!isCreate && canWrite && transitions.length ? (
              <section aria-label="Transições do item" className="mb-4 rounded-[8px] border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium">Alterar status</p>
                <div className="flex flex-wrap gap-2">
                  {transitions.map((transition) => {
                    const readinessIssues = transition.to === 'ready' && itemQuery.data
                      ? readinessGateFields(itemQuery.data)
                      : [];
                    const blocked = readinessIssues.length > 0;
                    return (
                      <div key={transition.to}>
                        <Button
                          type="button"
                          variant={transition.destructive ? 'destructive' : 'outline'}
                          onClick={() => transitionMutation.mutate(transition.to)}
                          disabled={transitionMutation.isPending || blocked}
                          className="rounded-[8px]"
                          title={blocked
                            ? `Preencha antes: ${readinessIssues.map(f => READINESS_LABELS[f] ?? f).join(', ')}`
                            : undefined}
                        >
                          {transitionMutation.isPending && transitionMutation.variables === transition.to
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : null}
                          {transition.label}
                        </Button>
                        {blocked ? (
                          <p className="mt-1 text-xs text-amber-600">
                            Faltam: {readinessIssues.map(f => READINESS_LABELS[f] ?? f).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <DialogFooter className="gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-[8px]">
                Fechar
              </Button>
              {canWrite ? (
                <Button type="submit" disabled={!canSubmit || saveMutation.isPending} className="rounded-[8px]">
                  {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isCreate ? 'Criar item' : 'Salvar alterações'}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
