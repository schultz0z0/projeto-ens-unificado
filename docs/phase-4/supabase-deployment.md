# Supabase / schema deployment — Fase 4

- **Estado:** `conditional_not_decided`
- **Data-base:** 2026-07-20
- **Observação:** a fase tenta reutilizar o schema atual; migration só entra se a
  correlação de auditoria exigir persistência adicional

## Hipótese atual

A Fase 4 pode ser implementada sem evolução estrutural do banco para leituras
MCP, plano assinado e deep links. A única mudança de schema hoje considerada
plausível é um bloco aditivo mínimo para metadados de correlação em
auditoria/eventos.

## Se houver migration

Ela deverá ser:

- aditiva;
- forward-only;
- coberta por pgTAP/contratos;
- acompanhada de dump, lint e diff;
- irrelevante para o caminho REST já validado.

## Se não houver migration

Este documento será reconciliado para `not_applicable` com justificativa
explícita no fechamento da Task 1.
