# Validação local parcial da Fase 2

- **Estado:** `task_2_changes_requested`
- **Ambiente:** Windows, PowerShell, Git Bash, Docker Desktop e Supabase CLI local
- **Data:** 2026-07-14
- **Código validado:** `1a49c4d` e ancestrais da Fase 2

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

## Resultado da revisão interrompida

A revisão independente final confirmou os gates acima, mas encontrou um bloqueio não coberto pelo harness oficial:

- sessão A: atualiza a campanha e, mantendo a transação aberta, tenta atualizar um `campaign_item`;
- sessão B: atualiza o mesmo `campaign_item` e depois tenta atualizar a campanha;
- resultado observado: deadlock PostgreSQL `40P01`;
- causa provável: `campaign_items_insert` e `campaign_items_update` ainda usam `can_access_campaign`, sem adquirir o advisory lock do agregado antes do row lock do item.

A revisão também estava auditando se um `member` sem autoridade de mutação, mas conhecendo o UUID de uma campanha do mesmo tenant, poderia manter advisory lock ao chamar helpers públicos. Esse probe foi interrompido pela pausa e deve ser concluído antes do aceite.

## Interpretação correta

Os 197 testes verdes não promovem a Task 2 para `completed`, porque o probe independente encontrou um caminho concorrente ausente da suíte. O estado correto é `changes_requested`. A evidência acima permanece útil como baseline de regressão para a correção.

## Avisos conhecidos

- 81 warnings do advisor já existiam fora dos objetos novos/alterados da Task 2;
- warnings `01007` da extensão `vector` aparecem durante reset/diff;
- nenhum desses avisos autoriza ignorar o deadlock de `campaign_items`;
- o Supabase do RAG não foi acessado ou alterado;
- nenhum projeto Supabase remoto foi mutado.
