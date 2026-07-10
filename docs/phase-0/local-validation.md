# Validação local — Fase 0

## Status

- **Estado:** `pass_with_environment_limits`
- **Gate local:** `pass`
- **Data:** 10 de julho de 2026
- **Escopo:** inspeção estática, testes nativos, build, RLS remoto somente leitura e runtime disponível no Windows
- **Próximo estado:** `ready_for_production`; aguarda push/deploy do usuário e gate VPS
- **Fora do escopo:** alteração de dados do RAG MCP, push, deploy ou acesso à VPS

## Ambiente detectado

| Ferramenta | Resultado | Estado |
|---|---|---|
| PowerShell | 7.5.2 | `pass` |
| Git | 2.52.0.windows.1 | `pass` |
| Node.js | v24.11.1 | `pass` |
| npm | 11.6.2 | `pass` |
| Python | 3.11.9 | `pass` |
| `.venv` local ignorado | dependências de `apps/designer-api/requirements.txt` | `pass` |
| Docker CLI | não encontrado | `not_run_environment_missing` |
| Bash | não encontrado | `not_run_environment_missing` |
| `.env` raiz | existe e não está rastreado | `pass` |
| Supabase indicado pelo `.env` | produção; app e RAG são projetos distintos | `pass_observed` |
| Commit base | `fc04ad9` | `pass` |

Nenhum valor do `.env` foi impresso ou copiado para documentos. Os scripts receberam somente os nomes mapeados em memória.

## Convenção de resultado

- `pass`: executado com sucesso e saída conferida;
- `pass_with_warnings`: sucesso com warning não bloqueante registrado;
- `fail`: comando executado e encontrou falha ainda aberta;
- `not_run_environment_missing`: ferramenta necessária ausente;
- `blocked_external`: depende de push/deploy/ambiente externo.

## Estrutura e configuração

| Validação | Estado | Evidência |
|---|---|---|
| arquivos obrigatórios | `pass` | frontend, Bridge, Artifact, RAG, Graph e dois Compose presentes |
| proteção do `.env` | `pass` | `git ls-files .env` sem saída |
| YAML do Compose | `pass` | `compose-yaml-ok` usando parser `yaml` já instalado no frontend |
| PyYAML global | `not_run_environment_missing` | módulo ausente; substituído por parser Node equivalente |
| Compose runtime | `not_run_environment_missing` | Docker ausente |
| scripts Bash | `not_run_environment_missing` | Bash ausente; execução transferida ao gate Linux |

## Testes Node e TypeScript

| Componente | Comando | Resultado | Estado |
|---|---|---:|---|
| Chat Bridge | `npm test` | 55/55 | `pass` |
| Artifact Server | `npm test` | 8/8 | `pass` |
| RAG MCP | `npm test` | 26/26 | `pass` |
| RAG MCP | `npm run typecheck` | 0 erros | `pass` |
| Graph MCP | `npm test` | 18/18 | `pass` |
| Graph MCP | `npm run typecheck` | 0 erros | `pass` |

Audits de alta severidade:

- Chat Bridge: 0 vulnerabilidades;
- Graph MCP: 0 vulnerabilidades;
- RAG MCP: nenhuma alta/moderada; 1 baixa em `esbuild` de desenvolvimento.

## Frontend

As variáveis do Supabase foram carregadas do `.env` raiz e traduzidas de `NEXUS_APP_SUPABASE_*` para `VITE_SUPABASE_*`/`SUPABASE_*` somente no processo de teste.

| Validação | Resultado | Estado |
|---|---|---|
| `npx vitest run` | 33 arquivos, 120/120 testes | `pass` |
| `npm run build` | Vite 6.4.3, 3.291 módulos, build concluído | `pass_with_warnings` |
| `npm run lint` | 0 erros, 10 warnings preexistentes | `pass_with_warnings` |
| `validate:rls` | RLS do app validada | `pass` |
| `validate:rag-rls` | RLS legado validada | `pass` |
| `npm audit fix` | lockfile atualizado sem `--force` | `pass` |
| `npm ci` em checkout temporário limpo | 567 pacotes; 0 vulnerabilidades | `pass` |
| `npm run security:gate` | RLS + lint + build + audit; 0 vulnerabilidades | `pass` |

Warnings mantidos no backlog:

- bundle principal de aproximadamente 1,127 MB; chunk > 500 kB;
- import estático e dinâmico misto do client Supabase;
- `caniuse-lite` desatualizado;
- 10 warnings ESLint de hooks/fast refresh.

## Testes Python

Foi criado `.venv` ignorado pelo Git a partir de `apps/designer-api/requirements.txt`.

| Componente | Comando | Resultado | Estado |
|---|---|---:|---|
| Designer API | `pytest -q tests` com chave fictícia | 77/77, 4 warnings | `pass_with_warnings` |
| Hermes Docker helpers | `pytest -q tests` | 3/3 | `pass` |

A primeira execução do Designer encontrou 2 falhas de setup porque o construtor exige `GEMINI_API_KEY` mesmo nos mocks. A repetição usou `phase0-test-placeholder`, não uma credencial real, e aprovou os 77 testes. Warnings: APIs FastAPI/Starlette depreciadas e duas inconsistências de template já marcadas como não bloqueantes pelo teste.

## Auditoria Supabase somente leitura

### Supabase do app

- tabelas ativas confirmadas por Data API e contagem;
- `rag_marketing`: 37 registros;
- `rag_ens`: 403 registros;
- `rag_email_html`: 0;
- tabelas antigas Meta/Market Intelligence: 0;
- buckets ativos confirmados;
- nenhum insert, update, delete, DDL ou migration executado.

### Supabase do RAG MCP

- 135 documentos e 964 chunks;
- coleções `courses`, `insights`, `institutional` e `marketing` confirmadas;
- somente consultas de contagem/coleção;
- **nenhum registro alterado**, conforme limite do usuário.

Limitações:

- host PostgreSQL direto não resolveu DNS neste Windows;
- token da Management API retornou `401`;
- schema diff, dump e advisors continuam obrigatórios antes de DDL de produção;
- limpeza permanece `planned_not_applied` em `supabase-cleanup-plan.md`.

## Resumo quantitativo

- testes automatizados aprovados: **307**;
- typechecks aprovados: **2**;
- builds aprovados: **1** (repetido também dentro do security gate);
- security gate: **pass**, 0 vulnerabilidades no frontend;
- falhas locais abertas: **0**;
- warnings/limitações documentados: não bloqueiam o diagnóstico, mas permanecem no backlog.

## Checks não executáveis neste host

| Check | Estado | Destino |
|---|---|---|
| `docker compose config` efetivo | `not_run_environment_missing` | VPS Linux |
| build das imagens Docker | `not_run_environment_missing` | VPS Linux |
| health dos containers | `not_run_environment_missing` | VPS Linux |
| volumes/permissões/restart | `not_run_environment_missing` | VPS Linux |
| `scripts/validate.sh` | `not_run_environment_missing` | VPS Linux |
| gate de produção | `blocked_external` | após push/deploy do usuário |

## Conclusão local

Todos os checks aplicáveis ao ambiente atual passaram. A Fase 0 está `ready_for_production`, não `production_validated`. A conclusão global depende exclusivamente do gate VPS definido no ADR 0005.
