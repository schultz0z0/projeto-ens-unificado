# Saneamento da Fase 2 e prontidão documental da Fase 3

- **Estado:** aprovado em princípio pelo `GO` de 2026-07-18; aguardando revisão deste registro
- **Branch canônica:** `main`
- **Escopo de deploy:** somente ambiente local neste ciclo
- **Fontes:** `Roadmap.md`, PRDs das Fases 2 e 3 e pacote `docs/phase-2/`

## 1. Objetivo

Restabelecer evidência reproduzível para os gates da Fase 2, reconciliar a
documentação com a homologação já realizada na VPS e preparar PRD, design e
plano de implementação da Fase 3. O ciclo termina com uma decisão técnica
objetiva de `go` ou `no-go` para iniciar a implementação da Fase 3, sem
implementar funcionalidades da Fase 3 e sem executar deploy externo.

## 2. Abordagens avaliadas

### A. Fechamento exclusivamente documental

Preservaria o código e registraria os dois gates vermelhos como exceções.

**Rejeitada:** lint e pgTAP são gates reproduzíveis neste computador. Aceitar
falhas conhecidas contrariaria o Definition of Done e enfraqueceria a
rastreabilidade.

### B. Saneamento técnico curto e reconciliação documental — escolhida

Corrige somente os gates reproduzidos, executa a regressão local disponível,
formaliza decisões arquiteturais já implantadas e reconcilia as evidências da
Fase 2 antes de preparar a Fase 3.

**Vantagem:** preserva escopo, reduz risco de regressão e torna a decisão sobre
a Fase 3 auditável.

### C. Reabertura funcional da Fase 2

Acrescentaria novas telas, fluxos ou refatorações antes de encerrar a fase.

**Rejeitada:** os itens identificados não exigem um novo incremento funcional.
Uma reabertura ampla atrasaria a Fase 3 e misturaria saneamento com evolução de
produto.

## 3. Escopo do ciclo

### Incluído

- remover os três erros de lint em
  `apps/chat-web/src/pages/marketing-ops/CampaignWorkspacePage.tsx` por meio de
  um type guard testado para detalhes de validação;
- corrigir as duas expectativas inconsistentes do pgTAP em
  `marketing_ops_workspace_rls.test.sql`, sem relaxar políticas RLS ou alterar
  o contrato seguro da timeline;
- executar Supabase local limpo, migrations, pgTAP, lint de banco, diff de
  schema, testes de concorrência e suítes do monorepo aplicáveis;
- criar um gate local reproduzível para a lista com 5.000 campanhas e p95 de
  até 500 ms, caso a medição possa ser isolada e determinística;
- caso o gate de performance não possa ser tornado determinístico sem ampliar
  o produto, registrar a medição observada, o risco residual e a decisão
  explícita de não bloquear a Fase 3;
- registrar como decisão da Fase 2 que “Configurações” não constitui uma sexta
  seção vazia: status, transições e arquivamento permanecem nos controles
  funcionais do cabeçalho;
- registrar a migration de otimização do RAG como exceção de performance
  homologada: ela altera apenas a função de busca, não grava dados de campanha
  nem torna o RAG fonte transacional;
- reconciliar PRD, README, progresso, rastreabilidade, riscos, SLO, validação
  local/VPS, runbook, rollback e handoff da Fase 2;
- preparar e revisar o PRD aprovado, o design técnico e o plano detalhado da
  Fase 3 no padrão documental das fases anteriores;
- entregar matriz final de gates e decisão de entrada na Fase 3.

### Excluído

- implementação de calendário, esteira, dependências ou conteúdo versionado;
- alteração de schema motivada pela Fase 3;
- deploy no Supabase remoto, GitHub ou VPS;
- alteração retroativa das evidências históricas da VPS sem base registrada;
- alegação de adoção ampla ou abandono de planilhas sem evidência do piloto;
- refatorações não relacionadas aos gates.

## 4. Arquitetura e decisões

### 4.1 Correção frontend

O formato desconhecido de `details.details` será refinado por uma função pura
que reconhece apenas uma lista de issues com `path` e `message` exibíveis. A UI
continuará fail-closed: payloads diferentes não serão renderizados como
detalhes de validação. O teste deve falhar antes da implementação e provar
tanto o caso válido quanto o payload malformado.

### 4.2 Correção pgTAP

As políticas e funções de produção não serão alteradas:

- a timeline continuará omitindo `signedUrl`; o teste deve exigir essa
  omissão e validar apenas campos permitidos;
- o cenário negativo usará um usuário realmente não participante, em vez de
  reutilizar um fixture promovido anteriormente a owner.

Os dois testes existentes constituem o estado RED. O estado GREEN exige a
suíte pgTAP completa sem reduzir a cobertura ou a quantidade planejada.

### 4.3 Performance

O cenário deve:

1. operar apenas no Supabase local descartável;
2. identificar e limpar seus fixtures;
3. medir a mesma consulta paginada usada pelo serviço;
4. registrar amostra, p95 e limite;
5. falhar acima de 500 ms;
6. evitar credenciais ou dados reais.

A medição temporal não será incluída em suíte unitária rápida se isso produzir
flakiness. Nesse caso, será um gate de integração explícito, executado após
`db reset`.

### 4.4 Evidência e estados

Cada afirmação final terá uma das classificações:

- `verified_local_2026-07-18`;
- `production_validated` com referência à homologação VPS existente;
- `accepted_residual` com responsável e impacto;
- `not_evidenced`, que bloqueia a promoção se afetar um critério obrigatório.

O roadmap permanece a fonte executiva, mas não poderá divergir do PRD e do
README da fase. Evidências antigas serão preservadas como histórico; handoffs
obsoletos receberão indicação explícita de substituição.

## 5. Preparação da Fase 3

### 5.1 Limite funcional

A Fase 3 evolui verticalmente o agregado existente `campaign_items`. Ela
entrega planejamento manual e acompanhamento, sem disparos, aprovação
institucional, automação do Hermes ou integrações de canal.

### 5.2 Corte recomendado

- uma query canônica abastece lista, semana e mês;
- a lista acessível é a primeira superfície funcional e a referência de
  equivalência;
- datas são persistidas em UTC e exibidas no timezone configurado;
- dependências são simples, direcionadas e sem ciclos;
- conteúdo separa identidade do asset e versões imutáveis;
- estados posteriores a `in_review` permanecem indisponíveis até as Fases 5 e
  6, evitando simular aprovação ou execução;
- ações em lote ficam limitadas a operações reversíveis explicitamente
  enumeradas;
- eventos internos são produzidos, mas a entrega inicial de notificação é
  somente in-app.

### 5.3 Pacote documental mínimo

- PRD da Fase 3 promovido a `approved`;
- `docs/phase-3/README.md`;
- `docs/phase-3/design.md`;
- rastreabilidade inicial e registro de riscos;
- plano datado em `docs/plans/`;
- documentos operacionais criados quando houver decisões concretas, sem
  preencher templates com alegações ainda não testadas.

## 6. Testes e gates

O saneamento será aceito quando:

- lint, typecheck, testes e build do frontend estiverem verdes;
- pgTAP estiver 100% verde após reset limpo;
- migrations, lint de banco e diff de schema estiverem verdes;
- serviço Marketing Ops, Artifact Server e RAG MCP mantiverem suas regressões;
- OpenAPI, Compose e script VPS passarem nas validações estáticas;
- security gate completar sem erro;
- o gate de performance estiver aprovado ou formalmente classificado como
  residual não bloqueante com evidência;
- nenhum segredo, URL assinada ou conteúdo sensível aparecer nas evidências;
- a documentação da Fase 2 não contiver estados contraditórios;
- PRD, design e plano da Fase 3 forem consistentes entre si e com o roadmap.

## 7. Rollback e segurança

As correções de código e teste são reversíveis por commit. Nenhuma migration
nova será aplicada remotamente. O Supabase local pode ser recriado por
`supabase db reset`. Se uma correção exigir relaxar autorização, expor payload
bruto ou alterar a fonte transacional, o ciclo deve parar com `no-go`.

## 8. Resultado esperado

O ciclo produz:

1. Fase 2 sem gates locais vermelhos conhecidos;
2. rastreabilidade coerente entre implementação, evidência local e
   homologação VPS;
3. riscos residuais explícitos, sem alegações não comprovadas;
4. pacote documental da Fase 3 pronto para aprovação;
5. recomendação técnica justificada para iniciar ou não a implementação da
   Fase 3.
