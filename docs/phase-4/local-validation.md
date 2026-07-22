# Validação local — Fase 4

- **Estado:** `partially_executed`
- **Base:** 2026-07-22
- **Branch:** `main`
- **Política:** registrar apenas gates realmente executados

## Pré-condições planejadas

- `marketing-ops` com catálogo MCP atualizado e testes de contrato;
- runtime Hermes com skill e guardrails alinhados ao novo catálogo;
- Bridge configurando delegação curta e confirmação explícita;
- frontend apto a abrir deep links e mostrar o objeto criado/alterado.

## Checklist do gate local

- [x] contratos MCP validados e documentados (Task 1, testes unitários);
- [x] catálogo sem tools diretas legadas de mutação (Task 1, discovery unitário);
- [x] catálogo de leitura da Task 2 e capacidades contextuais validados
  unitariamente;
- [ ] migration aplicada em banco limpo e sobre baseline existente;
- [x] testes unitários de domínio e executor do plano verdes;
- [ ] testes do runtime Hermes verdes;
- [ ] build, lint e typecheck aplicáveis verdes (build/typecheck do
  `marketing-ops` verdes; lint/frontend ainda pendentes);
- [ ] E2E `frontend -> bridge -> Hermes -> MCP -> marketing-ops -> frontend`
  verde;
- [ ] retry idempotente sem duplicidade;
- [ ] conflito de versão com nova consulta e nova confirmação;
- [ ] mutações diretas bloqueadas no runtime;
- [ ] tenant/papel forjados rejeitados;
- [ ] delegação expirada/reutilizada rejeitada;
- [ ] rate limit por ator e tool validado;
- [ ] prompt injection sem ampliação de autoridade;
- [ ] logs redigidos, sem `delegation_token` nem `plan_token`;
- [ ] logs/auditoria sem briefing, copy, nota ou conteúdo integral;
- [ ] deep links abrindo o objeto correto.
- [ ] briefing convertido em calendário/checklist após confirmação;
- [ ] resposta do chat convertida em versão vinculada;
- [ ] revisão pelo tom ENS fundamentada no RAG;
- [ ] Graph usado em cenário relacional sem substituir estado transacional;
- [ ] indisponibilidade comunicada sem falso sucesso;
- [ ] serviço reiniciado sem perder dados/auditoria;
- [ ] backup e rollback validados ou marcados não aplicáveis com justificativa.

## Evidências a registrar quando a execução começar

- comandos RED/GREEN por task;
- arquivos de teste realmente executados;
- falhas observadas e correções aplicadas;
- outputs resumidos, nunca secrets ou tokens.

## Registro Task 1 — 2026-07-22

- RED/GREEN detalhado em `implementation-progress.md`;
- 10 testes unitários dirigidos passaram;
- build e typecheck do `marketing-ops` passaram;
- pgTAP/reset/lint de banco bloqueados localmente porque Docker não está
  instalado; nenhum desses gates foi marcado como executado.

## Registro Task 2 — 2026-07-22

- discovery MCP e derivação de capacidades: 2 testes verdes;
- build e typecheck do `marketing-ops`: verdes após a implementação;
- consultas reutilizam os domínios das Fases 2–3 e suas transações com ator/RLS;
- integração real com PostgreSQL continua pendente pelo mesmo bloqueio de
  Docker registrado na Task 1.

## Registro Task 3 — 2026-07-22

- 12/12 testes passaram nas suítes de contratos, token, executor,
  idempotência e append de notas;
- build e typecheck do `marketing-ops` passaram após o GREEN;
- atomicidade real, RLS e replay contra PostgreSQL permanecem no gate de banco
  pendente; o comportamento de orquestração foi validado com dependências
  controladas.

## Decisão atual

Os gates unitários e de compilação das Tasks 1–2 foram executados. Gates de
banco, integração completa, frontend, runtime e VPS continuam pendentes e não
são inferidos a partir dessas evidências parciais.
