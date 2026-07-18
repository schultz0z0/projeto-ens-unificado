# Validação local final da Fase 2

- **Estado:** `verified_local_2026-07-18`
- **Ambiente:** Windows, Docker Desktop e Supabase CLI `2.109.1`
- **Branch:** `main`
- **Escopo:** saneamento pós-homologação; nenhum deploy remoto

Este registro substitui os snapshots locais intermediários como fonte atual.
As provas históricas de implementação permanecem no Git e em
[vps-validation.md](vps-validation.md).

## Matriz executada

| Gate | Resultado |
|---|---|
| Parser de validation issues | 10/10 testes focados |
| Frontend lint | exit 0; zero erro e 10 warnings históricos |
| Frontend typecheck | exit 0 |
| pgTAP após reset/migrations | 228/228 |
| DB lint `marketing_ops,marketing_ops_private` | `results=[]` |
| DB schema diff | vazio |
| Marketing Ops padrão | 20 arquivos aprovados, 1 skipped; 129 testes aprovados, 2 skipped |
| Marketing Ops typecheck/build | exit 0 |
| Performance da lista | três p95: 21,38 ms, 21,58 ms e 23,36 ms |
| Concorrência | campanha/participante/item aprovados, sem `40P01` |
| Advisors | zero erro; 79 warnings totais, 8 em Marketing Ops, todos `auth_rls_initplan` |

## 1. Frontend

### RED

Os erros de validação do workspace eram tratados com três casts `any`, sem
parser fail-closed. O teste focado inicialmente falhou porque
`validationIssues.ts` não existia.

### GREEN

Foi criado um parser que aceita apenas objetos com `field` e `message`
string, ignora entradas malformadas e evita renderizar payload arbitrário.

```powershell
Set-Location apps/chat-web
npx vitest run src/lib/marketingOps/validationIssues.test.ts src/pages/marketing-ops/CampaignWorkspacePage.test.tsx
npm run lint
npm run typecheck
```

Resultado: 10 testes aprovados, zero erro de lint e typecheck aprovado. Os 10
warnings do lint são preexistentes e não pertencem ao parser.

## 2. Banco e pgTAP

### RED

O gate reproduziu 226/228 asserts:

- fixture marcada como não participante ainda possuía vínculo;
- assert da timeline exigia uma propriedade `signedUrl` com valor nulo, embora
  a projeção segura omita a propriedade.

### GREEN

A fixture passou a usar usuário sem membership/participação e o assert passou a
exigir ausência de `signedUrl`.

```powershell
Set-Location apps/chat-web
npx supabase db reset --local --workdir .
npx supabase test db --local --workdir .
npx supabase db lint --local --schema marketing_ops,marketing_ops_private --level warning --fail-on error
npx supabase db diff --local --schema marketing_ops,marketing_ops_private
```

Resultado: 228/228, lint sem erro e diff vazio.

## 3. Performance da lista

### RED e diagnóstico

Com 5.000 campanhas, cinco warmups e 20 amostras, o p95 inicial foi
847,61 ms. O plano executava `Seq Scan`, avaliava autorização para 5.003 linhas
e acumulava 75.713 buffer hits; a projeção de owners consumia cerca de 10 ms.

O filtro explícito de tenant, isoladamente, não resolveu o plano. Um índice
compatível com tenant e ordenação, após `ANALYZE`, reduziu a consulta para
`Index Only Scan`.

### GREEN

Correções:

- `where campaign.tenant_id = $17` na query canônica;
- índice `(tenant_id, updated_at desc, id desc)`;
- teste de performance isolado do `npm test` padrão, com seed/cleanup próprios.

```powershell
Set-Location services/marketing-ops
npm run test:campaign-list-performance
```

Três execuções frescas: 21,38 ms, 21,58 ms e 23,36 ms, abaixo do gate de
500 ms.

## 4. Regressão do serviço e concorrência

```powershell
Set-Location services/marketing-ops
npm test
npm run typecheck
npm run build
node ../../apps/chat-web/scripts/test_campaign_aggregate_concurrency.mjs
```

Resultado: suíte padrão aprovada, build/tipos aprovados e harness sem deadlock
para campanha/participante/item. O teste pesado de performance possui comando
explícito para evitar tornar a regressão unitária dependente de volume.

## 5. Advisors e resíduos

O advisor local retornou 79 warnings e zero erro. O recorte de Marketing Ops
contém 8 warnings `auth_rls_initplan`. Eles são classificados como otimização
de avaliação de políticas, não falha de isolamento. RLS, cross-tenant e papéis
permanecem cobertos pelos 228 asserts e pela homologação VPS.

## 6. Controle de deploy

- A migration
  `20260718183937_add_campaign_list_tenant_updated_index.sql` existe somente no
  histórico local neste momento.
- Não houve `supabase db push --linked`, `git push` ou deploy VPS.
- O próximo deploy deve seguir [supabase-deployment.md](supabase-deployment.md).

## Parecer

Todos os gates locais obrigatórios do saneamento estão verdes. Não há evidência
local vermelha conhecida nem falha alta/crítica aberta. O único delta de
ambiente é a migration de índice ainda pendente no Supabase remoto.
