# Validação VPS da Fase 3

- **Estado:** `pending_user_execution`
- **Implementação local:** `complete`
- **Supabase remoto:** `deployed_pending_vps_validation`
- **Responsável pelo deploy/testes manuais:** usuário
- **Promoção final:** somente após evidência e aceite

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

## Resultado

Enquanto algum item obrigatório estiver pendente, a fase permanece
`implementation_complete_pending_vps_validation`. Após todos os resultados
verdes e aceite explícito do usuário, registrar data, commit e evidências e
promover para `production_validated`.
