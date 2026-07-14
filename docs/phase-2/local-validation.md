# Validação local parcial da Fase 2

- **Estado:** `task_8_implemented_pending_vps_validation`
- **Ambiente da evidência histórica:** Windows, PowerShell, Git Bash, Docker Desktop e Supabase CLI local no computador anterior
- **Data:** 2026-07-14
- **Código do baseline histórico:** `1a49c4d` e ancestrais da Fase 2
- **Correção da Task 2:** `c921294`
- **Último código da fase:** `42d43f3`

## Evidência concluída

| Gate | Resultado |
|---|---|
| Supabase local | portas `55320–55329`; API `55321`; PostgreSQL `55322` |
| Reset e seed | exit code 0; migrations e fixtures aplicadas |
| pgTAP da Task 2 | 2 arquivos, 100 testes (`32 + 68`), aprovados |
| pgTAP completo | 4 arquivos, 197 testes, aprovados |
| DB lint | `results=[]`; zero erro |
| Advisors | 81 warnings preexistentes; zero achado nos objetos novos/alterados da Task 2 |
| Schema diff | vazio; banco reproduzível pelas migrations |
| Harness oficial de concorrência | PASS para campanha → participante versus participante; espera em advisory lock, sem `40P01` |
| Invariantes de owner | índice único `23505`, constraint diferida `23514` e exatamente um primary owner aprovados |
| Upgrade legado | `course_slug` preservado; dois owners mantidos; criador escolhido deterministicamente como primary |
| Writer da Fase 1 | criação autenticada sem `is_primary` continuou válida; primeiro owner promovido |
| Mass assignment | INSERT/UPDATE de campanha e escrita de participantes limitados por coluna nos caminhos testados |
| Deploy remoto | não executado |

## Bloqueio encontrado no baseline histórico

A revisão independente final confirmou os gates acima, mas encontrou um bloqueio não coberto pelo harness oficial:

- sessão A: atualiza a campanha e, mantendo a transação aberta, tenta atualizar um `campaign_item`;
- sessão B: atualiza o mesmo `campaign_item` e depois tenta atualizar a campanha;
- resultado observado: deadlock PostgreSQL `40P01`;
- causa provável: `campaign_items_insert` e `campaign_items_update` ainda usam `can_access_campaign`, sem adquirir o advisory lock do agregado antes do row lock do item.

A revisão também identificou que um `member` sem autoridade de mutação, mas conhecendo o UUID de uma campanha do mesmo tenant, podia chamar um helper público e manter o advisory lock até o fim da transação.

## Correção atual e evidência nativa

O commit `c921294` implementa:

- policies de INSERT/UPDATE de `campaign_items` com `can_edit_campaign`, lock antes do row lock, tenant explícito e estado `draft`;
- matriz pgTAP para viewer/editor/owner/manager/admin, membership inativa, campanha/item arquivados, ACLs e consumo indevido de lock;
- harness determinístico para campanha/participante, campanha/item e probes de duas sessões para viewer e member não participante;
- pré-autorização do helper antes do advisory lock;
- grants por coluna compatíveis com o writer da Fase 1;
- trigger autenticado que exige `version = old.version + 1` e mantém item arquivado read-only;
- recusa do harness a bancos remotos por padrão e limpeza de fixtures inclusive após falha.

| Gate nativo da correção da Task 2 | Resultado |
|---|---|
| Contagem estrutural pgTAP | `plan(98)` e 98 asserts no arquivo RLS; execução `deferred_to_vps` |
| Total pgTAP esperado | 228 asserts (`2 + 95 + 33 + 98`); execução `deferred_to_vps` |
| Sintaxe do harness | `node --check`: exit code 0 |
| Lint do harness | ESLint: exit code 0 |
| Serviço sem banco | 4 arquivos e 21 testes Vitest aprovados |
| Typecheck do serviço | exit code 0 |
| Build do serviço | exit code 0 |
| Higiene do diff | `git diff --check`: sem erro |
| Revisão estática | zero achado `Critical` ou `Important` após o hardening de versão |
| Deploy remoto | não executado |

## Interpretação correta

Os 197 testes verdes permanecem apenas como baseline histórico. As implementações atuais podem avançar internamente para `implemented_pending_vps_validation`, mas não para `completed`, porque ainda faltam a observação RED no schema anterior, o GREEN no schema corrigido, os 228 asserts pgTAP e os gates reais de PostgreSQL/RLS/concorrência na VPS.

## Política de validação no computador de retomada

- **Decisão do usuário:** não usar ou instalar Docker Desktop, WSL ou Podman neste computador.
- **Gate local disponível:** testes unitários sem banco, lint, typecheck, build, validação documental e inspeções estáticas.
- **Gate diferido para VPS:** reset/migrations, pgTAP, RLS real, harnesses concorrentes, lint/advisors/diff de banco, imagens Linux, Compose, restart e persistência.
- **Regra de status:** mudanças dependentes desses gates ficam `implemented_pending_vps_validation`; nenhuma será descrita como RED/GREEN, aceita ou concluída antes da execução real.
- **Fechamento interno:** após Tasks 1–15, usar `implementation_complete_pending_vps_validation`, ainda dentro de `in_progress`.
- **Fechamento final:** somente após deploy do usuário, gate automatizado na VPS, inspeção de logs e testes manuais por papel.

## Task 3 — contratos e máquina de estados

- **Commit:** `9740530`;
- **RED observado:** módulo `domain/contracts.js` ausente;
- **GREEN:** 13/13 testes de schema, prontidão, referência, transições e permissões;
- **Regressão nativa:** 34/34 testes sem banco e 1/1 teste isolado da matriz em `auth.test.ts`;
- **Typecheck/build:** exit code 0;
- **Diferido para VPS:** os quatro testes restantes de `auth.test.ts`, pois resolvem ator e contexto transacional em PostgreSQL real.

## Task 4 — CRUD, busca e concorrência otimista

- **Commit:** `9b19ec7`;
- **RED/GREEN nativo:** 3/3 testes de normalização de filtros, escape de prefixo e cursor estável;
- **Gate nativo:** 37/37 testes sem banco, typecheck e build aprovados;
- **Coleta dos testes PostgreSQL:** 12 cenários carregados pelo Vitest sem erro de compilação;
- **Implementação:** create progressivo, patch estrito, busca/filtros combináveis, cursor `updated_at/id`, `currentVersion`, transições, reabertura, arquivamento e preflight de autorização para replay idempotente;
- **Ordem de concorrência:** helper de autorização/advisory lock antes de `SELECT ... FOR UPDATE`;
- **Diferido para VPS:** os 8 cenários de `domain.test.ts` e 4 de `campaignTransitions.test.ts`, incluindo RLS, owner principal, auditoria, eventos, idempotência e SQL real.

## Task 5 — participantes e resolução segura de perfis

- **Commit:** `2c119f8`;
- **RED observado:** módulo `domain/participants.js` ausente;
- **Gate nativo:** 37/37 testes de regressão sem banco, 1/1 contrato de participantes e 1/1 matriz de permissões aprovados;
- **Typecheck/build:** exit code 0;
- **Implementação:** listagem, candidatos ativos do tenant, adição, alteração, remoção, transferência atômica do owner principal, versão do agregado, idempotência, auditoria, eventos e rotas REST;
- **Privacidade:** projeção limitada a `id`, nome seguro e avatar; nomes legados iguais a e-mail ou contendo `@` são substituídos por identificador neutro;
- **Hardening de lock:** editor falha no helper reservado a manager/admin antes de adquirir advisory lock;
- **Coleta dos testes PostgreSQL:** 5 cenários carregados pelo Vitest sem erro de compilação;
- **Diferido para VPS:** execução dos 5 cenários de domínio, dos 92 asserts do arquivo RLS e validação real de constraints, RLS, lock, replay e projeções de perfil.

## Task 6 — materiais e Artifact Server

- **Commit:** `aed3e1c`;
- **RED observado:** módulos `integrations/artifactClient.js` e `domain/materials.js` ausentes; configuração privada do Artifact Server também ausente;
- **Gate do Marketing Ops:** 4/4 contratos do cliente HTTP e 4/4 contratos de material sem banco aprovados;
- **Regressão nativa:** 38/38 testes base, 1/1 matriz de permissões e 1/1 contrato de participantes aprovados;
- **Artifact Server:** `npm ci --ignore-scripts` aprovado, zero vulnerabilidade, sintaxe válida e 8/8 testes aprovados;
- **Typecheck/build:** exit code 0;
- **Compose estático:** YAML parseado; URL/chave privadas, dependência `service_healthy` e volume `./data/artifacts:/app/data` confirmados; placeholders de chave foram reconciliados com `.env.example`;
- **Implementação:** upload binário com allowlist MIME/extensão e limite de 25 MiB antes da rede, vínculo de artifact próprio, access link de 300 segundos, unlink lógico, versão do agregado, idempotência, auditoria, eventos e compensação de upload quando a persistência falha;
- **Coleta dos testes PostgreSQL:** 3 cenários carregados pelo Vitest: replay sem duplicação, vínculo/acesso/unlink sem apagar bytes e rejeição de artifact de outro owner;
- **Tentativa da suíte global:** 57 testes passaram, 36 falharam e 2 ficaram skipped; a execução alcançou suítes dependentes do PostgreSQL indisponível em `127.0.0.1:55322` e não foi aceita como gate de regressão;
- **Diferido para VPS:** os 3 cenários PostgreSQL, RLS real, imagem Linux, `docker compose config/build/up`, health, restart e persistência dos bytes/metadados.

## Task 7 — referências oficiais de cursos no RAG

- **Commit:** `5d5cf8f`;
- **RED observado:** módulo `integrations/ragCourseClient.js` ausente, resolução canônica de campanha ausente e configuração RAG indefinida;
- **Gate da Task 7:** 4/4 contratos do cliente MCP, 4/4 contratos puros de resolução canônica e 2/2 contratos da rota aprovados;
- **Regressão nativa segmentada:** 59 checks sem banco aprovados, incluindo contratos anteriores de materiais/participantes e matriz de permissões;
- **RAG MCP:** 8 arquivos, 26/26 testes e typecheck aprovados; o novo cliente referencia somente `ens_rag_search` e `ens_rag_get_document`;
- **Typecheck/build do Marketing Ops:** exit code 0;
- **Compose estático:** endpoint `http://rag-mcp:8000/mcp`, timeout e dependência `rag-mcp: service_healthy` confirmados por parser YAML;
- **Implementação:** busca limitada a `collections=['courses']`, `intent='course_fact'`, evidência obrigatória e actor profile `marketing_ops`; resultados sem `metadata.course_id`, fora do tenant `ens` ou fora de `courses` são descartados;
- **Fail-closed:** documento, tenant, coleção e `course_id` são revalidados antes da persistência; o título do cliente é substituído pelo snapshot canônico; indisponibilidade não bloqueia edições que não tocam a referência;
- **Coleta PostgreSQL:** novo cenário em `domain.test.ts` confirma snapshot/timestamp canônicos e versão do agregado; execução `deferred_to_vps`;
- **Diferido para VPS:** persistência PostgreSQL real, RLS, chamada MCP Marketing Ops → RAG no Compose, indisponibilidade real e inspeção de logs;
- **Supabase do RAG:** nenhuma migration, escrita, deploy ou conexão direta realizada.

## Task 8 — timeline segura e auditoria minimizada

- **Commit:** `42d43f3`;
- **RED observado:** a suíte falhou primeiro pela ausência da rota/módulo; o hardening adicional também falhou ao receber ação e nome de campo não reconhecidos;
- **GREEN da task:** 7/7 testes de minimização, outbox, projeção, cursor, rota, feature gate e contrato público;
- **Regressão nativa segmentada:** 60/60 testes em 11 arquivos, mais 1/1 contrato puro de participantes e 4/4 contratos puros de materiais;
- **Typecheck/build:** exit code 0 após a implementação e após o hardening;
- **Implementação:** `auditSnapshot` reduz texto livre a `{ present, length, sha256 }`, redige campos secret-like e também minimiza payloads do outbox;
- **Projeção:** função privada `SECURITY DEFINER` com `search_path` fixo, ACL somente `authenticated`, autorização por campanha, cursor `(created_at,id)` e retorno sem `before_state`/`after_state`;
- **Defesa em profundidade:** ações desconhecidas viram `campaign.changed` e campos fora da allowlist são descartados tanto no SQL quanto no domínio;
- **Coleta PostgreSQL:** 1 assert estrutural e 6 asserts RLS/timeline adicionados; planos conferidos em 33 e 98, elevando o total esperado para 228;
- **Diferido para VPS:** execução da migration/função, 228 pgTAP, RLS member/manager/admin e cross-tenant, histórico bruto legado, paginação real e inspeção manual de conteúdo proibido.

## Avisos conhecidos

- 81 warnings do advisor já existiam fora dos objetos novos/alterados da Task 2;
- warnings `01007` da extensão `vector` aparecem durante reset/diff;
- nenhum desses avisos autoriza dispensar a prova RED/GREEN do deadlock de `campaign_items` na VPS;
- o Supabase do RAG não foi acessado ou alterado;
- nenhum projeto Supabase remoto foi mutado.

## Auditoria documental após a Task 8

| Verificação | Resultado |
|---|---|
| Pacote exigido pelo design | README, design, progresso, rastreabilidade, riscos, LGPD, SLO, runbook, rollback, validação local, deploy Supabase, validação VPS e handoff presentes |
| Links relativos em `docs/phase-2` | todos os alvos locais resolvidos |
| Estados remotos | Supabase `not_executed`; VPS `pending_user_execution`; nenhuma evidência antecipada |
| Supabase CLI | versão local `2.109.1`; sintaxe de `migration list`, `db dump`, `db push --dry-run`, `test db`, `lint` e `advisors` conferida via `--help` |
| Separação RAG/app | runbook e deploy proíbem variáveis/migrations do RAG |
| Continuidade | README, progresso e handoff apontam Task 9 como próxima frente |

Esta auditoria valida completude e coerência documental, não banco, containers ou deploy.
