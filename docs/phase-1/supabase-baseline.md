# Baseline do Supabase do app

- **Estado:** `validated_locally`
- **Data:** 2026-07-11
- **Escopo:** Supabase do app exclusivamente
- **Fora do escopo:** Supabase do RAG e qualquer mutação remota de produção

## Resultado

A cadeia ativa foi substituída por um baseline reproduzível do schema remoto do app. As 24 migrations anteriores continuam versionadas em `apps/chat-web/supabase/legacy_migrations/` e não são executadas automaticamente. Uma migration posterior corrige duas funções legadas cujo tipo de retorno impedia o lint e a execução.

| Artefato | Evidência |
|---|---|
| Dump de schema fora do Git | `%TEMP%\nexus-phase-1\app-schema.sql`, 211.694 bytes, SHA-256 `8c4a870b93fd75e1d34009a2cc0cbf7561ddb063ff44bc03a3f2612729d77bd7` |
| Dump de dados fora do Git | `%TEMP%\nexus-phase-1\app-data.sql`, 11.308.811 bytes, SHA-256 `4d113cd2d408a3c04539f4dafed86eacd35af4bcc2e65c239bcd0b755a0e28aa` |
| Baseline ativo | `20260711150910_app_schema_baseline.sql` |
| Correção pós-baseline | `20260711151350_fix_keyword_match_similarity_type.sql` |
| Inventário do dump | 29 tabelas, 19 funções e 64 policies |
| PostgreSQL remoto/local | major 17 |

Os dumps não contêm os valores do `.env` e permanecem fora do repositório. O dump de schema foi inspecionado por padrões de credenciais antes de ser adotado.

## Divergência encontrada

O histórico remoto e os arquivos locais não descreviam a mesma sequência. As versões sincronizadas mais antigas eram `20251217`, `20251218000000`, `20251218000001`, `20251219000000`, `20251219000001`, `20251229120000`, `20251229124500` e `20251229125500`. O remoto também registrava versões sem arquivo local correspondente, incluindo `20251229`, `20260709163349` e `20260709175321`; o Git continha migrations posteriores que não apareciam como aplicadas no remoto.

Além da divergência, parte da criação original estava em `ignored_migrations`, alguns arquivos `remote_sync` eram placeholders e a cadeia ativa não conseguia reconstruir um projeto limpo. Por isso, reparar somente um número de versão não seria suficiente: o schema remoto foi capturado como fonte factual e a cadeia anterior foi arquivada integralmente.

## Segurança observada

O advisor remoto somente leitura retornou 17 avisos e nenhum erro. Os avisos são dívida preexistente do schema público: funções legadas com `search_path` mutável, funções no schema `smart_mail` e a extensão `vector` instalada em `public`. Eles não foram alterados diretamente em produção durante esta fase.

O lint local inicialmente reproduziu dois erros `42804`: `kw_match_rag_ens` e `kw_match_rag_marketing` declaravam `double precision`, mas `ts_rank_cd` retornava `real`. O pgTAP falhou 2/2 antes da correção. A migration pós-baseline adicionou cast explícito, schema qualification e `search_path` fixo; depois dela, o teste passou 2/2 e o lint retornou zero erro.

## Validação Windows

O desenvolvimento local usa Windows, PowerShell, Docker Desktop e Supabase CLI. Nenhum comando abaixo depende de Bash ou de path Linux:

```powershell
Set-Location apps/chat-web
npx supabase start
npx supabase db reset --local --no-seed
npx supabase test db --local supabase/tests/baseline_contract.test.sql
npx supabase db lint --local --level error --fail-on error
```

Resultado observado em 2026-07-11:

- banco recriado e as duas migrations aplicadas com exit `0`;
- pgTAP: 1 arquivo, 2 testes, todos aprovados;
- lint: `results=[]`, exit `0`;
- os avisos durante o restore são ACLs redundantes de funções da extensão `vector` presentes no dump remoto e não impedem o bootstrap.

O `config.toml` expõe portas somente para desenvolvimento local. Ele não é a configuração de produção.

## Adoção na VPS Ubuntu

O baseline já validado localmente **não autoriza** alteração automática do histórico remoto. Na VPS Ubuntu, a adoção deve ocorrer em janela de deploy e nesta ordem:

1. Atualizar o checkout e confirmar commit/branch esperados.
2. Carregar o `.env` raiz sem imprimir valores.
3. Gerar novos dumps de schema e dados em diretório protegido fora do Git.
4. Calcular SHA-256 e comparar o schema atual com o baseline aprovado.
5. Executar `supabase migration list --linked` e salvar a saída sanitizada como evidência.
6. Se e somente se o schema for equivalente, reparar as versões remotas divergentes com `supabase migration repair --linked --status reverted <versões-antigas>`.
7. Marcar o baseline equivalente como aplicado com `supabase migration repair --linked --status applied 20260711150910`.
8. Aplicar migrations posteriores com `supabase db push --linked --dry-run` e, após revisão, `supabase db push --linked`.
9. Rodar lint/advisors, smoke tests e registrar o resultado em `vps-validation.md`.

As versões a reparar devem ser copiadas da listagem obtida no próprio deploy, não de uma lista estática. Isso evita remover uma migration adicionada entre a captura de 2026-07-11 e a janela de produção. Em falha antes do `db push`, não há mudança de schema; em falha posterior, seguir o runbook de rollback e preservar os dumps.

## Separação dos projetos

- `NEXUS_APP_SUPABASE_*` é o contrato público/Auth do app.
- `NEXUS_SUPABASE_PROJECT_REF`, `NEXUS_SUPABASE_DATABASE_URL` e credenciais operacionais correspondem ao projeto do app usado por esta cadeia.
- `NEXUS_RAG_SUPABASE_*` pertence ao RAG e não foi lido para dump, link, migration, teste ou advisor desta etapa.
- o access token legado disponível localmente não foi aceito pelo CLI atual; a inspeção usou a conexão PostgreSQL do app via pooler, sem persistir ou imprimir a senha.

