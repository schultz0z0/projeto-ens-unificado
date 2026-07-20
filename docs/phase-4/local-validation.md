# Validação local — Fase 4

- **Estado:** `not_executed`
- **Base:** 2026-07-20
- **Branch:** `main`
- **Política:** registrar apenas gates realmente executados

## Pré-condições planejadas

- `marketing-ops` com catálogo MCP atualizado e testes de contrato;
- runtime Hermes com skill e guardrails alinhados ao novo catálogo;
- Bridge configurando delegação curta e confirmação explícita;
- frontend apto a abrir deep links e mostrar o objeto criado/alterado.

## Checklist do gate local

- [ ] contratos MCP validados e documentados;
- [ ] testes de domínio e executor do plano verdes;
- [ ] testes do runtime Hermes verdes;
- [ ] E2E `frontend -> bridge -> Hermes -> MCP -> marketing-ops -> frontend`
  verde;
- [ ] retry idempotente sem duplicidade;
- [ ] conflito de versão com nova consulta e nova confirmação;
- [ ] mutações diretas bloqueadas no runtime;
- [ ] tenant/papel forjados rejeitados;
- [ ] logs redigidos, sem `delegation_token` nem `plan_token`;
- [ ] deep links abrindo o objeto correto.

## Evidências a registrar quando a execução começar

- comandos RED/GREEN por task;
- arquivos de teste realmente executados;
- falhas observadas e correções aplicadas;
- outputs resumidos, nunca secrets ou tokens.

## Decisão atual

Nenhum gate local da Fase 4 foi executado até este snapshot. Este documento é
intencionalmente um placeholder operacional, não uma evidência de teste.
