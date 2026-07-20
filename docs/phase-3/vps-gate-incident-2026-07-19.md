# Incidente do gate VPS — 2026-07-19

- **Estado:** `historical_record`
- **Branch:** `main`
- **Tentativa afetada:** commit `a5183c1`
- **Gate afetado:** não mutante, com banco isolado/E2E/restart desativados
- **Supabase remoto:** não alterado por este saneamento

## Resumo

A primeira execução do gate não mutante na VPS chegou ao `npm test` do
Marketing Ops e falhou em cascata porque a suíte tentou conectar em
`127.0.0.1:55322`. Essa porta pertence ao Supabase local de testes, que não
existe na VPS e estava corretamente desativado por
`PHASE3_RUN_ISOLATED_DB_GATES=false`.

O trecho recebido contém:

| Evidência | Quantidade |
|---|---:|
| arquivos de teste | 16 failed, 12 passed, 1 skipped |
| testes | 71 failed, 110 passed, 2 skipped |
| marcadores `FAIL` | 71 |
| ocorrências explícitas de `ECONNREFUSED 127.0.0.1:55322` | 53 |
| erros diretos de conexão agrupados pelo runner | 49 |

As diferenças `500` versus `201`, `400` ou `503`, os erros de injeção e o
timeout restante são efeitos secundários: handlers e fixtures que dependiam do
banco receberam a mesma indisponibilidade. O log parcial não contém evidência
de 71 defeitos funcionais independentes.

## Causa raiz

`run_native_gates` executava estes comandos sem definir um banco de testes:

```text
npm test
npm run test:campaign-list-performance
npm run test:schedule-performance
```

As suítes usam, por contrato, o fallback local
`postgresql://postgres:postgres@127.0.0.1:55322/postgres`. O mesmo script já
possuía um bloco correto, `run_isolated_database_gates`, que sobe/resetava o
Supabase local e executava os três comandos com
`MARKETING_OPS_TEST_DATABASE_URL` explícita. A cobertura dependente de banco
estava duplicada no bloco nativo e inválida quando o opt-in isolado era
`false`.

Executar essa suíte contra `NEXUS_SUPABASE_DATABASE_URL` não seria uma
alternativa aceitável: os testes criam, alteram e removem fixtures. O banco de
produção nunca deve ser usado como banco de testes.

## Correções

1. O gate nativo mantém `npm ci`, typecheck, build, OpenAPI e audit do Marketing
   Ops, mas posterga os testes dependentes de banco para o gate isolado.
2. O gate isolado continua contendo a suíte funcional completa e os dois
   benchmarks com URL local explícita. Nenhuma cobertura foi removida.
3. O teste de segurança do script agora impede regressão: falha se `npm test`
   ou qualquer benchmark do Marketing Ops reaparecer no bloco nativo e também
   comprova que todos permanecem no bloco isolado.
4. O inventário Playwright do bloco nativo força as duas flags E2E para
   `false`; credenciais ou flags herdadas da VPS não podem habilitar mutações.
5. Durante a continuação dos gates, foi revelada uma condição de corrida no
   frontend: busca debounced e mudança de status podiam sobrescrever a URL com
   o penúltimo caractere. Alterações de filtros agora consolidam o valor
   corrente da busca na mesma atualização atômica.

## TDD e validação local

### RED

| Gate | Resultado observado |
|---|---|
| safety test novo | falhou ao encontrar `npm test` no bloco nativo |
| frontend completo, antes da correção da corrida | 1 failed, 178 passed |
| valor esperado/recebido | `gestão` / `gestã` na URL |

### GREEN

| Gate | Resultado |
|---|---|
| safety test do script | 2/2 |
| regressão determinística do debounce pendente | RED sem correção; GREEN com correção |
| reset Supabase local | todas as migrations reaplicadas |
| pgTAP | 322/322 |
| DB lint | zero erro |
| schema diff | vazio |
| Marketing Ops funcional | 181 pass, 2 skips condicionais |
| campanha 5.000 fixtures | p95 28,70 ms, limite 500 ms |
| agenda 10.000 fixtures | p95 37,40 ms, limite 500 ms |
| frontend completo | 180/180 |
| regressão de URL repetida | 5/5 |
| Artifact Server | 8/8 |
| RAG MCP | 26/26 |
| typecheck/build/OpenAPI/RLS/security/audits | aprovados |
| Docker `--pull --no-cache` | quatro alvos aprovados |
| runtime Docker | quatro alvos healthy; probes 200 |
| Marketing Ops readiness | banco, Artifact e RAG `ok` |
| navegador | `gestão` + `planned` preservados antes/depois de reload |
| `phase-3-vps.sh` completo em Linux descartável | PASS com isolated/E2E mutante/restart `false` |

O gate exato, executado após a criação do commit corretivo em uma cópia limpa
do `main`, aprovou contrato do ambiente, Compose, métricas protegidas, schema
remoto somente leitura, todos os gates nativos, E2E forçado a sete skips,
safety test, segundo probe e scanner de logs. O container de validação foi
removido ao final.

Os 10 warnings históricos de lint do frontend, o aviso de chunk grande e uma
vulnerabilidade `low` de esbuild no ambiente de desenvolvimento do RAG
continuam abaixo dos thresholds atuais; não foram introduzidos por este ciclo.

## Impacto e segurança

- nenhum schema ou dado do Supabase remoto foi modificado;
- `supabase db reset --local` atingiu somente `127.0.0.1:55322`;
- nenhum teste dependente de banco será apontado ao banco de produção;
- o primeiro gate da VPS não executou E2E mutante, reset isolado ou restart;
- este incidente foi fechado historicamente após o reteste e a homologação VPS
  aprovados em 2026-07-20.

## Próxima execução na VPS

A ação descrita acima foi executada e resultou em reteste aprovado, seguido da
homologação final da fase. Este documento permanece apenas como registro do
incidente e da correção.

Se o gate voltar a falhar, preservar o arquivo completo em
`tmp/phase-3-vps/` com permissão `600` e enviar o arquivo como anexo. Não
executar o gate isolado na VPS para contornar uma falha.
