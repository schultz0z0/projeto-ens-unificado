# Rastreabilidade de requisitos — Fase 4

- **Estado:** `planned`
- **Implementação:** `in_progress`
- **Revisão:** 2026-07-22

## Matriz requisito → design → task

| Requisito | Design | Task | Estado |
|---|---|---|---|
| F4-RF-01 Consulta fundamentada | 3, 6.1, 12 | 2 | `implemented_unit_validated` |
| F4-RF-02 Uso do RAG | 5, 10 | 5, 7 | `planned` |
| F4-RF-03 Uso do Graph | 5 | 5, 7 | `planned` |
| F4-RF-04 Preview | 4.2, 7.2 | 3, 4, 5 | `planned` |
| F4-RF-05 Confirmação | 4.2, 7 | 3, 5 | `planned` |
| F4-RF-06 Delegação | 5, 10, 11 | 1, 3, 5, 6 | `planned` |
| F4-RF-07 Deep link | 9 | 4, 7 | `planned` |
| F4-RF-08 Idempotência | 4.2, 7.3, 10 | 3, 6 | `planned` |
| F4-RF-09 Conflito | 7.3, 8, 12 | 3, 4, 5 | `planned` |
| F4-RF-10 Operação parcial | 7.3, 8, 12 | 3, 4 | `planned` |
| F4-RF-11 Auditoria | 4.4, 11 | 1, 6, 7 | `planned` |
| F4-RF-12 Limites | 2, 4.2, 10 | 1, 5, 7 | `planned` |

## Matriz Roadmap → design → task

| Entrega do Roadmap | Design | Task | Estado |
|---|---|---|---|
| MCP de consulta e mutação controlada | 4.2, 6, 7 | 1–3 | `planned` |
| Criação de campanha em rascunho | 6.2, 7 | 1, 3, 5, 7 | `planned` |
| Atualização com confirmação | 4.2, 7, 8.1 | 3, 5, 7 | `planned` |
| Geração de calendário e itens | 8.8 | 3, 5, 7 | `planned` |
| Criação e vínculo de conteúdo | 8.4–8.6, 8.9 | 3, 5, 7 | `planned` |
| Revisão pelo tom de voz ENS | 4.5, 8.9 | 5, 7 | `planned` |
| Conversão de resposta do chat em objeto | 8.9 | 3, 5, 7 | `planned` |
| Auditoria correlacionada com chat e run | 4.4, 11 | 1, 6, 7 | `planned` |

## Matriz de critérios de aceite

| Critério | Design | Task/teste | Estado |
|---|---|---|---|
| Lista somente campanhas autorizadas | 6.1, 10 | 2, 7 | `domain_reused_integration_pending` |
| Estado operacional vem do Marketing Ops | 4.1, 4.5 | 2, 5, 7 | `mcp_reads_implemented` |
| Cria rascunho após confirmação | 4.2, 7 | 3, 5, 7 | `planned` |
| Objeto aparece no frontend sem reconciliação | 9 | 4, 7 | `planned` |
| Retry não duplica objeto | 7.3 | 3, 7 | `planned` |
| Tenant/papel forjados são rejeitados | 10 | 1, 2, 3, 7 | `planned` |
| Delegação expirada/reutilizada falha | 10 | 1, 5, 7 | `planned` |
| Conflito exige nova consulta/decisão | 7.3, 8.1 | 3, 5, 7 | `planned` |
| Conteúdo do chat vira versão vinculada | 8.9 | 3, 5, 7 | `planned` |
| Deep link abre objeto correto | 9 | 4, 7 | `planned` |
| Auditoria liga ator/chat/run/tool | 4.4, 11 | 1, 6, 7 | `planned` |
| Hermes não aprova/executa ação sensível | 2, 10 | 1, 5, 7 | `planned` |
| Indisponibilidade não gera falso sucesso | 7.3, 12 | 4, 5, 7 | `planned` |

## Matriz de segurança e observabilidade

| Requisito | Design | Task/teste | Estado |
|---|---|---|---|
| Allowlist e autoridade server-side | 7.1, 10 | 1, 3 | `planned` |
| Sem tools MCP diretas de mutação | 4.6, 6.2 | 1, 5 | `planned` |
| Rate limit por ator e ferramenta | 10 | 1, 2, 3 | `planned` |
| Prompt injection não amplia autoridade | 10, 12 | 5, 7 | `planned` |
| Logs sem texto integral/tokens | 10, 11 | 6, 7 | `planned` |
| Métricas por tool/resultado | 11 | 6 | `planned` |
| Idempotency hit e conflito observáveis | 11 | 3, 6 | `planned` |
| Chat → run → tool → audit → objeto | 4.4, 11 | 1, 6, 7 | `planned` |

## Gates transversais

| Gate | Design | Task | Estado |
|---|---|---|---|
| Catálogo MCP versionado | 6, 7 | 1 | `implemented_unit_validated` |
| Leituras MCP da Fase 4 | 6.1 | 2 | `implemented_unit_validated` |
| Sem mutação direta fora do plano | 4.2, 7 | 1, 3, 5 | `catalog_verified` |
| Auditoria/correlação | 11 | 1, 6 | `planned` |
| Runtime Hermes alinhado | 3.1, 4.2, 12 | 5 | `planned` |
| E2E ponta a ponta | 12, 13, 14 | 7, 8 | `planned` |
| Gate local | 13 | 8 | `planned` |
| Gate VPS | 14 | 8 | `planned` |

Os checklists de `local-validation.md` e `vps-validation.md` são parte desta
matriz. Itens não aplicáveis devem ser marcados com justificativa, nunca
silenciosamente removidos.

## Leitura inicial

- F4-RF-01, F4-RF-04, F4-RF-05 e F4-RF-06 aproveitam muito do que foi
  antecipado na Fase 1, mas precisam ser estendidos para o escopo real da
  Fase 4.
- F4-RF-07 e F4-RF-11 são os pontos com maior probabilidade de exigir contrato
  novo; os contratos foram congelados no design e serão implementados nas
  Tasks 1, 4 e 6.
- F4-RF-02 e F4-RF-03 são requisitos de fronteira arquitetural; a
  implementação deve provar que RAG e Graph continuam complementares, nunca
  transacionais.

## Critério de encerramento desta matriz

Esta matriz só muda de `seeded` para `closed` quando cada requisito tiver:

- task concluída;
- evidência local ou VPS quando aplicável;
- referência explícita em `implementation-progress.md`;
- ausência de conflito aberto entre design, contrato MCP e comportamento real.
- critério de aceite, segurança, observabilidade e entrega do Roadmap em estado
  `verified` ou `not_applicable` justificado.
