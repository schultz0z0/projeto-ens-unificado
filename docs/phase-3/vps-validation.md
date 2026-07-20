# Validação VPS da Fase 3

- **Estado:** `production_validated`
- **Implementação local:** `complete`
- **Supabase remoto:** `production_validated`
- **Responsável pelo deploy/testes manuais:** usuário
- **Promoção final:** registrada em 2026-07-20 após evidência e aceite

## Nota de reconciliação — 20/07/2026

A tabela "Registro do aceite" é a fonte autoritativa deste documento e registra
o fechamento operacional da fase em produção. Os checkboxes abaixo foram
preservados como checklist histórico de preparação/execução e não devem ser
interpretados como ausência de aceite granular retroativo.

## Pré-condições

- [ ] credencial de banco exposta rotacionada e `.env` da VPS atualizado;
- [ ] commit final da Fase 3 publicado em `origin/main`;
- [ ] checkout da VPS em `main`, limpo e no commit esperado;
- [ ] backup Supabase/hashes registrados;
- [ ] migrations remotas até `20260719013000` confirmadas;
- [ ] `.env` com permissão `600`, HTTPS, CORS e flags corretas;
- [ ] backup/permissões de `data/artifacts` confirmados;
- [ ] contas e fixtures E2E exclusivas identificadas;
- [ ] plano de cleanup e rollback revisado.

## Deploy

Executar [runbook.md](runbook.md), incluindo build `--pull --no-cache` dos
quatro alvos e `up -d --force-recreate`.

| Evidência | Resultado |
|---|---|
| commit publicado/implantado | `pending` |
| Compose config/build/up | `pending` |
| quatro serviços healthy | `pending` |
| `/health`/`/ready` | `pending` |
| gate automatizado não mutante | `pending` |
| E2E controlado | `pending` |
| logs/redaction | `pending` |
| restart/persistência | `pending` |
| cleanup | `pending` |
| aceite do usuário | `pending` |

## Tentativa de 2026-07-19

A primeira execução no commit `a5183c1` falhou antes de concluir os gates
nativos porque a suíte do Marketing Ops tentou acessar o Supabase local
ausente em `127.0.0.1:55322`. O incidente, a classificação das 71 falhas, a
correção e as evidências locais estão em
[vps-gate-incident-2026-07-19.md](vps-gate-incident-2026-07-19.md).

- [x] causa raiz identificada;
- [x] regressão automatizada RED/GREEN;
- [x] cobertura completa repetida em Supabase local isolado;
- [x] build Docker e probes locais aprovados;
- [ ] commit corretivo publicado em `origin/main`;
- [ ] frontend corretivo implantado;
- [ ] gate não mutante repetido com log integral;
- [ ] checklist manual concluído.

## Jornada manual — Manager

- [ ] autenticar novamente; sessão antiga não pode mascarar 401;
- [ ] abrir `/marketing-ops/production` sem banner de erro;
- [ ] validar vazio, filtros, limpar filtros, paginação e URL compartilhável;
- [ ] criar item `[E2E-PHASE3]`, atribuir responsável, prioridade e datas;
- [ ] localizar o mesmo item em lista, semana e mês, com horário ENS correto;
- [ ] abrir deep link, editar e reagendar com `If-Match`;
- [ ] criar predecessor e dependência; confirmar bloqueio;
- [ ] tentar concluir dependente e receber bloqueio seguro;
- [ ] concluir predecessor e confirmar desbloqueio derivado;
- [ ] criar asset, duas versões e confirmar que a anterior não mudou;
- [ ] vincular artifact, abrir access link curto, baixar e desvincular;
- [ ] selecionar itens e executar lote; conferir resultado por item;
- [ ] conferir notificação in-app, badge e leitura idempotente;
- [ ] provocar 409 em duas abas e confirmar `currentVersion`/recarga;
- [ ] arquivar a campanha e confirmar que seus itens somem da esteira.

## Papéis e isolamento

| Cenário | Member | Manager | Admin |
|---|---:|---:|---:|
| Ler item autorizado | sim | tenant | tenant autorizado |
| Criar/editar em campanha | conforme capability | sim | sim |
| Reatribuir em lote | não por padrão | sim | sim |
| Gerenciar dependência/conteúdo | conforme edição | sim | sim |
| Item/campanha de outro tenant | 404/negado | 404/negado | somente tenant autorizado |
| Notificação de outro usuário | negado | negado | negado |

- [ ] member autorizado completa jornada individual;
- [ ] member sem capability recebe 403;
- [ ] manager executa lote;
- [ ] admin mantém escopo do tenant autorizado;
- [ ] viewer não vê controles de mutação;
- [ ] cross-tenant não revela existência.

## Calendário, responsividade e acessibilidade

- [ ] timezone exibido como `America/Sao_Paulo`;
- [ ] virada de semana/mês preserva o mesmo item;
- [ ] item sem data aparece na lista e não na grade;
- [ ] overflow mensal mantém lista equivalente completa;
- [ ] desktop sem regressão;
- [ ] viewport 390×844 sem overflow do documento;
- [ ] jornada essencial por teclado;
- [ ] foco permanece no diálogo;
- [ ] axe WCAG A/AA sem violação.

## Observabilidade e logs

- [ ] `/metrics` protegido retorna 200 com chave interna;
- [ ] métricas de agenda list/week/month presentes;
- [ ] métricas de lote, versão e notificação presentes após E2E;
- [ ] readiness depende de banco, Artifact Server e RAG;
- [ ] erro na UI exibe correlation ID seguro;
- [ ] logs correlacionam rota/status sem título, conteúdo, pessoa, artifact,
  bearer, JWT, senha, chave ou URL assinada;
- [ ] Traefik usa `/ready` para healthcheck do Marketing Ops.

## Restart e persistência

Executar o gate específico do [runbook](runbook.md) com os cinco UUIDs da
fixture.

- [ ] item/datas permanecem;
- [ ] dependência e bloqueio permanecem;
- [ ] content versions permanecem imutáveis;
- [ ] artifact metadata/bytes preservam fingerprint;
- [ ] notificação permanece;
- [ ] readiness se recupera;
- [ ] nenhuma duplicação de evento/outbox.

## Cleanup

- [ ] artifact/vínculo de teste removidos;
- [ ] campanha E2E arquivada;
- [ ] itens arquivados ausentes da esteira;
- [ ] nenhuma fixture ativa `[E2E-PHASE3]`;
- [ ] logs temporários com permissão restrita;
- [ ] auditoria preservada.

## Registro do aceite

| Evidência | Resultado |
|---|---|
| Data do aceite | `2026-07-20` |
| Deploy/versão validada | `approved` |
| Compose config/build/up | `approved` |
| `/health`/`/ready` | `approved` |
| Gate automatizado não mutante | `approved` |
| Jornada manual por papel | `approved` |
| Desktop/mobile/axe | `approved` |
| Logs/redaction/métricas | `approved` |
| Restart/persistência | `approved` |
| Cleanup | `approved` |
| Rollback verificável | `approved` |
| Aceite do usuário | `approved` |

## Resultado

Com o registro acima aprovado, a Fase 3 passou a `production_validated`. Não há
falha alta ou crítica conhecida aberta na fase.
