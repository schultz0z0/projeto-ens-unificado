# Registro de decisões da Fase 2

## F2-D-01 — Configurações integradas ao cabeçalho

- **Data:** 2026-07-18
- **Estado:** `accepted_as_built`

O requisito de “configuração” é atendido pelos controles funcionais de ciclo de
vida, reabertura, arquivamento, permissões e modo read-only no cabeçalho do
workspace. Uma sexta seção vazia não agrega valor nem altera o aceite.

## F2-D-02 — Hotfix de consulta no RAG durante QA

- **Data:** 2026-07-16
- **Estado:** `production_validated`

A migration `2026-07-16-optimize-mcp-search.sql` reestruturou a função de busca
do RAG para usar ramos indexáveis. O desvio em relação à expectativa inicial
“sem migration no RAG” foi necessário para remover timeout no autocomplete e
foi validado na VPS.

O limite arquitetural permanece: nenhuma campanha, participante, material,
timeline ou estado operacional é gravado no RAG. A mudança é de leitura e
performance; o Supabase do app continua sendo a única fonte transacional.

## F2-D-03 — Forward-fix local da lista

- **Data:** 2026-07-18
- **Estado:** `verified_local_pending_next_deploy`

O p95 de 847,61 ms foi causado por varredura de campanhas com autorização por
linha. A query passou a restringir explicitamente o tenant e a migration
`20260718183937_add_campaign_list_tenant_updated_index.sql` adicionou o índice
canônico de ordenação. Após `ANALYZE`, o p95 ficou entre 21,38 e 23,36 ms.

A migration não foi aplicada remotamente neste ciclo. Ela deve seguir backup,
dry-run, push, lint/advisors e smoke no próximo deploy controlado.

## F2-D-04 — Adoção ampla como métrica contínua

- **Data:** 2026-07-18
- **Estado:** `accepted_residual`

O piloto e as jornadas essenciais foram aceitos em produção. A eliminação
longitudinal de planilhas paralelas depende de observação operacional e não
pode ser inferida por testes técnicos. Ela segue como métrica de produto, sem
bloquear a entrada técnica da Fase 3.
