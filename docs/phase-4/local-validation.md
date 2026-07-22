# Validação local — Fase 4

- **Estado:** `not_executed`
- **Base:** 2026-07-22
- **Branch:** `main`
- **Política:** registrar apenas gates realmente executados

## Pré-condições planejadas

- `marketing-ops` com catálogo MCP atualizado e testes de contrato;
- runtime Hermes com skill e guardrails alinhados ao novo catálogo;
- Bridge configurando delegação curta e confirmação explícita;
- frontend apto a abrir deep links e mostrar o objeto criado/alterado.

## Checklist do gate local

- [ ] contratos MCP validados e documentados;
- [ ] catálogo sem tools diretas legadas de mutação;
- [ ] migration aplicada em banco limpo e sobre baseline existente;
- [ ] testes de domínio e executor do plano verdes;
- [ ] testes do runtime Hermes verdes;
- [ ] build, lint e typecheck aplicáveis verdes;
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

## Decisão atual

Nenhum gate local da Fase 4 foi executado até este snapshot. Este documento é
intencionalmente um placeholder operacional, não uma evidência de teste.
