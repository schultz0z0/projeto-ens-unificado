# SLO e observabilidade da Fase 2

- **Estado:** `baseline_established`
- **Baseline:** probes, métricas e logs homologados na VPS; carga da lista medida localmente em 2026-07-18
- **Validação:** homologação VPS + saneamento local

## Indicadores

| Indicador | Objetivo inicial | Alerta inicial | Fonte esperada | Estado |
|---|---:|---:|---|---|
| Disponibilidade `/health` | 99,9% mensal | 2 falhas consecutivas | probe/Compose | probe homologado |
| Disponibilidade `/ready` | 99,5% mensal | indisponível por 2 min | probe/Compose | readiness homologado |
| Lista de campanhas p95 | <= 500 ms | > 750 ms por 10 min | métrica HTTP + cenário 5.000 campanhas | 21,38–23,36 ms local; índice remoto pendente |
| Detalhe de campanha p95 | <= 500 ms | > 750 ms por 10 min | métrica HTTP | não medido |
| Mutação REST p95 | <= 1.000 ms | > 1.500 ms por 10 min | métrica HTTP | não medido |
| Erros 5xx | < 1% | > 2% por 5 min | status HTTP | instrumentado e smoke homologado |
| Outbox não publicada | < 15 min | evento pendente > 15 min | idade da outbox | persistência/restart homologados |
| Operação de material com erro | baseline a definir no piloto | > 5% por 10 min | `operation,result` | instrumentado |
| Lookup RAG indisponível | baseline a definir no piloto | 3 falhas consecutivas | `dependency,result` | instrumentado; hotfix de busca homologado |

Conflito de versão não é automaticamente erro de disponibilidade: deve ser contado como resultado de negócio e acompanhado separadamente. Perda de campanha, vínculo ou bytes após restart tem tolerância zero e bloqueia aceite, mesmo que o SLO mensal aparente estar verde.

## Métricas do Workspace

Sem IDs pessoais, nomes ou conteúdo em labels:

- campanhas criadas e transições por `from/to`;
- conflitos de versão;
- operações de material por operação/resultado;
- lookup de referência por resultado;
- campanhas sem owner;
- usuários ativos no workspace em 24 horas como agregado;
- conclusão de briefing como razão agregada;
- contagem e soma do tempo entre criação e `planned`;
- requisições, status, duração e dependência.

## Logs

Logs estruturados devem conter timestamp, correlation ID, rota, operação, status, duração e tenant/ator somente quando permitido. Não podem conter briefing, notas, objetivo, público, filename bruto, bearer, token de delegação, chave interna, URL assinada, bytes ou payload RAG.

## Evidência obrigatória

1. Task 14 fixa nomes e labels das métricas e testa cardinalidade/redaction.
2. Gate VPS confirma `/health`, `/ready`, métricas protegidas e healthcheck do Compose baseado em readiness.
3. Carga com 5.000 campanhas mede lista e detalhe sem carregar briefing, materiais ou timeline na listagem.
4. Logs de criação, conflito, material, RAG indisponível e archive são inspecionados por conteúdo proibido.
5. Alertas e baseline do piloto são registrados antes de ampliar o rollout.

Ownership: Backend/Plataforma responde por serviço, RLS e outbox; DevOps por probes/Compose/logs; Segurança por redaction; Produto pelas métricas de adoção e pelo rollout.
