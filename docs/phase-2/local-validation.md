# Validação local parcial da Fase 2

- **Estado:** `task_2_implemented_pending_vps_validation`
- **Ambiente da evidência histórica:** Windows, PowerShell, Git Bash, Docker Desktop e Supabase CLI local no computador anterior
- **Data:** 2026-07-14
- **Código do baseline histórico:** `1a49c4d` e ancestrais da Fase 2
- **Correção atual:** `c921294`

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

| Gate nativo atual | Resultado |
|---|---|
| Contagem estrutural pgTAP | `plan(88)` e 88 asserts no arquivo RLS; execução `deferred_to_vps` |
| Total pgTAP esperado | 217 asserts (`2 + 95 + 32 + 88`); execução `deferred_to_vps` |
| Sintaxe do harness | `node --check`: exit code 0 |
| Lint do harness | ESLint: exit code 0 |
| Serviço sem banco | 4 arquivos e 21 testes Vitest aprovados |
| Typecheck do serviço | exit code 0 |
| Build do serviço | exit code 0 |
| Higiene do diff | `git diff --check`: sem erro |
| Revisão estática | zero achado `Critical` ou `Important` após o hardening de versão |
| Deploy remoto | não executado |

## Interpretação correta

Os 197 testes verdes permanecem apenas como baseline histórico. A correção atual pode avançar internamente para `implemented_pending_vps_validation`, mas não para `completed`, porque ainda faltam a observação RED no schema anterior, o GREEN no schema corrigido, os 217 asserts pgTAP e os gates reais de PostgreSQL/RLS/concorrência na VPS.

## Política de validação no computador de retomada

- **Decisão do usuário:** não usar ou instalar Docker Desktop, WSL ou Podman neste computador.
- **Gate local disponível:** testes unitários sem banco, lint, typecheck, build, validação documental e inspeções estáticas.
- **Gate diferido para VPS:** reset/migrations, pgTAP, RLS real, harnesses concorrentes, lint/advisors/diff de banco, imagens Linux, Compose, restart e persistência.
- **Regra de status:** mudanças dependentes desses gates ficam `implemented_pending_vps_validation`; nenhuma será descrita como RED/GREEN, aceita ou concluída antes da execução real.
- **Fechamento interno:** após Tasks 1–15, usar `implementation_complete_pending_vps_validation`, ainda dentro de `in_progress`.
- **Fechamento final:** somente após deploy do usuário, gate automatizado na VPS, inspeção de logs e testes manuais por papel.

## Avisos conhecidos

- 81 warnings do advisor já existiam fora dos objetos novos/alterados da Task 2;
- warnings `01007` da extensão `vector` aparecem durante reset/diff;
- nenhum desses avisos autoriza dispensar a prova RED/GREEN do deadlock de `campaign_items` na VPS;
- o Supabase do RAG não foi acessado ou alterado;
- nenhum projeto Supabase remoto foi mutado.
