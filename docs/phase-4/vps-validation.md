# Validação VPS — Fase 4

- **Estado:** `pending_eleventh_release_candidate_deploy_then_real_gate`
- **Implementação local:** `implemented_pending_vps_validation`
- **Responsável pelo deploy:** usuário
- **Responsável pelos testes manuais finais:** assistente, após o deploy
- **Promoção final:** somente após evidência real e aceite

## Nota de reconciliação — 29/07/2026

O código, os testes locais aplicáveis, o E2E fake do operador Hermes e a
migration remota do Supabase já foram reconciliados. Este documento passa a ser
o checklist autoritativo para fechar a promoção da Fase 4 em produção.

### Incidente do gate de confirmação — 29/07/2026

O décimo release foi implantado: `hermes-api` e `app-bridge` ficaram healthy,
o timeout deixou de interromper a classificação e o pacote `1.2.0` chegou ao
volume. O teste pós-deploy, porém, encontrou duas candidatas com o mesmo nome:
`/opt/data/skills/marketing-ops-operator` e
`/opt/data/skills/marketing/marketing-ops-operator`. O `skill_view` precisou
do caminho categorizado explícito e ainda carregou a cópia antiga.

No turno seguinte, `vamos nessa` terminou dentro do novo timeout, mas o modelo
de decisão retornou `clarify`. A delegação permaneceu sem confirmação, três
tentativas indevidas do agente foram bloqueadas por `confirmation_required` e
nenhum dado foi salvo. A consulta direta ao Supabase confirmou
`campaign_count=0` e `audit_count=0` para `HML F4 Gate 20260729-B`.

O décimo primeiro release instala o pacote somente no caminho categorizado,
remove a cópia gerenciada obsoleta da raiz e resolve respostas curtas,
completas e sem ressalva antes de chamar o modelo. Perguntas e respostas
qualificadas continuam no classificador contextual e permanecem fail-closed.

#### Histórico que motivou o décimo release

Leitura e preview passaram, e o Supabase confirmou ausência de persistência
prematura. No turno `vamos nessa`, o endpoint interno classificou `approve`,
mas terminou em cerca de 6,4 segundos; a Bridge já havia aplicado seu timeout
de 4 segundos e seguiu de forma segura como `clarify`. A delegação do turno
não carregou confirmação e o executor recusou a escrita. O comportamento
seguro evitou persistência, mas impede concluir a jornada.

Na mesma inspeção, a UI do Hermes mostrou que o volume persistente ainda
priorizava a skill `marketing-ops-operator` `1.0.0`, sem referências e
templates do pacote `1.2.0`. O décimo release candidato amplia a espera segura
para 15 segundos e passa a sincronizar atomicamente a skill gerenciada na
inicialização do `hermes-api`.

Depois do deploy, este incidente só pode ser encerrado quando:

- `/opt/data/skills/marketing/marketing-ops-operator/SKILL.md` declarar
  `version: 1.2.0`;
- `/opt/data/skills/marketing-ops-operator` não existir;
- os três arquivos de `references/` e o template existirem no volume;
- `vamos nessa` executar o plano pendente com uma única confirmação;
- pergunta, negação e revisão continuarem sem executar;
- campanha, auditoria e deep link forem comprovados no Supabase e no app.

### Incidente de primeiro deploy — 28/07/2026

Os cinco serviços da Fase 4 ficaram `healthy`, mas a imagem Hermes recusou os
MCPs HTTP porque detectava apenas o símbolo legado `streamablehttp_client`.
A imagem em execução já possuía o módulo `mcp.client.streamable_http` e a API
atual; a correção no repositório habilita HTTP também com
`streamable_http_client`. É obrigatório rebuildar `hermes-api` e
`hermes-kanban` a partir do commit que contém essa correção e executar
`hermes mcp test nexus_marketing_ops` antes dos smokes de chat.

### Incidente de segundo deploy — 28/07/2026

O primeiro hotfix eliminou a indisponibilidade do símbolo, mas o teste real
`hermes mcp test nexus_marketing_ops` passou a revelar o contrato de retorno
da API instalada: `not enough values to unpack (expected 3, got 2)`. A versão
atual expõe os dois streams necessários à sessão; o runtime agora também aceita
o terceiro valor que versões anteriores podiam retornar. Rebuild sem cache de
`hermes-api` e `hermes-kanban` é obrigatório novamente, seguido dos quatro
smokes MCP HTTP antes de qualquer jornada de chat.

### Incidente de terceiro deploy — 28/07/2026

Os quatro comandos `hermes mcp test` validaram transporte e descoberta, mas
não executam uma tool. No primeiro smoke conversacional de leitura, o Hermes
chegou ao Marketing Ops e falhou no handler compartilhado ao ler `isError` de
um `CallToolResult` cuja API instalada fornece `is_error`. O runtime agora
aceita as duas convenções. Rebuild sem cache de `hermes-api` e
`hermes-kanban` é obrigatório novamente; depois dele, a primeira evidência
necessária é uma leitura real de campanhas/agenda concluída no chat, sem
mutação.

### Incidente de quarto deploy — 28/07/2026

O terceiro hotfix foi publicado e a leitura conversacional real concluiu: o
Hermes listou campanhas e agenda via Marketing Ops, sem mutação. No preview de
uma campanha com dados completos, porém, o agente tentou incluir campos de
enriquecimento em `campaign.create_draft`. O schema estrito recusou o plano
antes de assinatura ou persistência, portanto não houve objeto de teste criado.

A correção é somente no contrato sistêmico da `app-bridge` e na skill do
operador: criar primeiro com `type`, `ref`, `name` e `course_slug` opcional;
depois de a campanha existir, ler id/versão e preparar uma atualização em um
novo ciclo de confirmação. O teste RED/GREEN e os 85 testes da Bridge estão
verdes. É obrigatório rebuild sem cache e recriação de **`app-bridge`** antes
de continuar as jornadas de escrita.

### Incidente de quinto deploy — 28/07/2026

Após o quarto hotfix ser publicado, o preview estrito chegou ao
`marketing_ops_prepare_plan_v1`, mas omitiu o campo obrigatório `actions`. O
MCP devolveu `expected array, received undefined`; não assinou plano, não
executou e não persistiu objeto. A sessão e o log do Hermes foram consultados
para confirmar o payload recusado, sem registrar token ou conteúdo sensível.

O quinto hotfix da Bridge e da skill declara que `actions` deve ser uma lista
não vazia, inclusive para uma única `campaign.create_draft`. O RED/GREEN e os
85 testes da Bridge passaram. Rebuild sem cache e recriação de **`app-bridge`**
são obrigatórios antes de repetir o preview.

### Incidente de sexto deploy — 28/07/2026

O quinto hotfix foi publicado e o preview foi repetido. A sessão Hermes revelou
que o MiniMax serializa o array de actions como `actions: { item: {...} }` e,
em outra tentativa, como string JSON. O schema do Marketing Ops rejeitou os
dois formatos antes da assinatura, execução ou persistência. Não houve plano
pendente nem objeto de teste criado.

O sexto hotfix aceita exclusivamente o envelope `item` do provedor e o
normaliza para array antes da mesma validação estrita de action e delegação.
É obrigatório rebuild sem cache e recriação de **`marketing-ops`**;
`app-bridge` e Hermes não precisam ser recriados para essa mudança. Depois,
repetir primeiro o preview sem persistência.

### Incidente de sétimo deploy e correção contextual — 28/07/2026

O sexto hotfix foi validado no preview real: o plano foi preparado sem escrita.
No turno de confirmação, `execute_plan_v1` foi chamado mas recebeu delegação
sem `confirmation_intent`, porque a frase contextual com o nome do rascunho não
pertencia à allowlist literal da Bridge. A execução foi recusada e não houve
persistência.

A expansão por frases foi substituída antes de publicação pela decisão
contextual aprovada. O `hermes-api` identifica plano pendente e classifica a
resposta sem tools; a Bridge assina confirmação somente para `approve`.
Pergunta, negação, ressalva, adiamento e alteração continuam bloqueados e erro
ou timeout falham fechados. É obrigatório rebuild sem cache e recriação de
**`hermes-api` e `app-bridge`**; depois, preparar novamente o plano e confirmar
em turno posterior.

### Incidente de oitavo deploy — endurecimento do classificador — 28/07/2026

O deploy inicial da decisão contextual foi exercitado no app real com um plano
de criação sem persistência e a resposta posterior `vamos nessa`. O endpoint
interno de decisão respondeu `200`, o agente tentou `execute_plan_v1`, mas o
runtime recusou com `confirmation_required`; nenhum objeto foi criado.

Os logs mostraram que o classificador respondeu com texto de 91 caracteres,
enquanto o parser aceitava somente JSON integral. A decisão caiu corretamente
em `clarify`, e a Bridge emitiu uma delegação sem `confirmation_intent`. Uma
consulta somente-leitura ao Hermes confirmou que esse log separa esse caso de
perda na Bridge ou no transporte do token; a inspeção do código confirmou que
a Bridge calcula a decisão antes de assinar a nova delegação.

O oitavo hotfix isola o prompt do classificador da persona conversacional,
mantém uma única iteração sem tools/sem persistência e exige a linha fechada
`NEXUS_MARKETING_OPS_DECISION: {"decision":"..."}`. O parser permanece
fail-closed para conteúdo extra. O log do `hermes-api` passa a registrar somente
`decision` e `output_contract`. Os testes dirigidos do runtime passaram 12/12,
o `compileall`, `git diff --check` e os 86 testes da Bridge passaram. É
obrigatório novo rebuild sem cache e recriação de **`hermes-api` e
`app-bridge`** antes da repetição da matriz manual.

### Incidente de nono release candidato — compatibilidade e agenda — 28/07/2026

Antes de a confirmação contextual ser exercitada novamente, uma tentativa de
preview mínima no app real falhou antes de qualquer persistência: o provedor
enviou a única action como objeto tipado direto, e não como array. A análise
anterior já havia comprovado o envelope `{ item: ... }` e a variante em string
JSON; os quatro são formatos de serialização do mesmo campo `actions`, não
novas actions nem permissão adicional.

O `marketing-ops` agora normaliza somente array nativo, `{ item: action |
action[] }`, objeto com `type` reconhecível, ou JSON que resulte em um desses
formatos. Depois disso, o schema allowlisted, a delegação e a confirmação
continuam idênticos. RED/GREEN de objeto direto e string JSON passaram. Em
paralelo, o smoke de leitura mostrou tentativas de agenda com datas incompletas
antes da autocorreção; a Bridge e a skill agora exigem `from`/`to` ISO 8601
completos com offset e intervalo semiaberto.

A skill foi reestruturada em `SKILL.md`, três referências e um template. Ela é
embutida na imagem **`hermes-api`**, portanto o nono release candidato exige
rebuild sem cache e recriação de **`marketing-ops`**, **`app-bridge`** e
**`hermes-api`**. Nenhum schema Supabase muda neste release.

## Checklist planejado

- [x] imagens `marketing-ops`, `app-bridge` e `hermes-api` do nono release
  candidato publicadas; a skill estruturada deve estar carregável no runtime;
- [x] `marketing-ops`, Bridge e runtime Hermes healthy antes do quarto hotfix;
- [x] descoberta do catálogo MCP em ambiente real;
- [ ] catálogo sem tools diretas legadas de mutação;
- [x] migration e índices de correlação aplicados e histórico remoto alinhado
  em 2026-07-28;
- [ ] VPS confirma que aponta para esse mesmo projeto Supabase;
- [ ] refresh de delegação funcionando;
- [x] smoke de leitura de campanhas e agenda;
- [x] plano preparado sem persistência prematura;
- [ ] execução confirmada criando/alterando objeto real;
- [ ] deep link abrindo objeto correto no frontend;
- [ ] logs correlacionados sem segredo;
- [ ] rate limit por ator/tool retorna 429 seguro;
- [ ] jornada briefing → calendário/checklist aprovada;
- [ ] jornada chat → conteúdo e revisão ENS aprovada;
- [ ] Graph/RAG respeitam suas fontes;
- [ ] retry idempotente em produção controlada;
- [ ] conflito exige nova leitura/confirmação;
- [ ] indisponibilidade não produz falso sucesso;
- [ ] persistência validada após restart;
- [ ] backup confirmado;
- [ ] rollback verificável.

## Sequência recomendada

1. atualizar checkout e `.env` da VPS sem sobrescrever o arquivo real;
2. validar `docker compose` com `docker-compose.yml` + `docker-compose.prod.yml`;
3. para a correção atual, rebuildar e recriar somente `hermes-api`;
4. confirmar health/readiness e logs sem segredo;
5. verificar se a migration da Fase 4 já está refletida no Supabase alvo;
6. executar os smokes manuais do operador Hermes;
7. registrar evidência e aceite final.

`hermes mcp test` prova conexão e discovery, não execução. Portanto, não
substitui o smoke conversacional de leitura previsto nesta fase.

## Comandos base

```bash
cd /opt/nexus-ens
git fetch origin main
git pull --ff-only origin main
git status --short
bash scripts/bootstrap.sh
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache app-frontend app-bridge marketing-ops hermes-api hermes-kanban
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate app-frontend app-bridge marketing-ops hermes-api hermes-kanban
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 marketing-ops app-bridge hermes-api app-frontend
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_marketing_ops
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_rag
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_graph
```

Se a VPS usar outro diretório padrão do projeto, ajuste apenas o `cd`.

Antes do build, execute também os `grep` de configuração em
[runbook.md](runbook.md#conferência-segura-da-configuração-da-vps). O bloco
acima é o deploy completo da Fase 4. Para a correção atual, depois de o commit
estar no checkout da VPS, use o deploy pontual abaixo; não é necessário
reconstruir frontend, Marketing Ops ou `hermes-kanban`:

```bash
cd /opt/nexus-ens
git pull --ff-only origin main
git rev-parse --short HEAD
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build --no-cache hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate hermes-api
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps hermes-api app-bridge
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --since=5m --tail=200 hermes-api
curl -fsS http://127.0.0.1:8652/health
curl -fsS http://127.0.0.1:8081/health
```

## Smoke manual mínimo

1. abrir o chat e pedir uma ação de Marketing Ops sem confirmar;
2. verificar que o Hermes responde com plano/preview, sem persistir e sem deep
   link final;
3. responder `vamos nessa` ou `pode ser` no turno seguinte;
4. confirmar que a resposta final inclui apenas deep links devolvidos pelo
   servidor;
5. abrir o deep link e validar que o objeto correto aparece no frontend;
6. repetir um cenário de indisponibilidade controlada e confirmar ausência de
   falso sucesso;
7. executar um cenário com conflito ou retry idempotente, se o ambiente de
   homologação permitir sem risco operacional;
8. validar um cenário RAG/ENS e um cenário Graph relacional antes do aceite.

## Roteiro manual final após o deploy

Crie uma conversa nova para cada jornada de escrita; a delegação é emitida por
sessão e não se deve reutilizar uma conversa anterior ao deploy. Use um nome
único, por exemplo `HML F4 Gate AAAA-MM-DD`, e marque todos os objetos como
teste.

1. Como admin, peça uma leitura de campanhas e agenda. Esperado: o Hermes
   consulta o Marketing Ops, não pede confirmação e não afirma estado sem fonte
   operacional.
2. Peça **somente** a criação da campanha de teste, sem objetivo, público,
   canal, briefing ou datas, mas não confirme. Esperado: preview claro,
   nenhuma persistência e nenhum deep link final.
3. Responda `vamos nessa` ou `pode ser`. Esperado: uma criação, auditoria
   correlacionada e deep link de campanha válido.
4. Em três conversas novas, prepare a mesma ação de teste sem confirmar e
   responda respectivamente `pode ser?`, `não quero seguir` e `sim, mas altere
   o nome`. Esperado: pergunta e rejeição não executam; alteração produz novo
   preview e exige nova confirmação.
5. Peça para preencher os campos suportados da campanha: objetivo, público,
   briefing, notas, datas e canais. Esperado: novo preview e atualização apenas
   após confirmação.
6. Peça a conversão do briefing em pelo menos um item de e-mail agendado.
   Depois do preview, confirme e abra o deep link do item.
7. No item criado, peça exatamente um rascunho `email_html` e, em seguida, uma
   versão inicial da copy. Esperado: não ocorrer `invalid_union` nem
   `delegation_scope_denied`; o link de conteúdo abre o asset e sua versão.
8. Peça uma revisão de tom ENS baseada em fato institucional e uma consulta que
   exija relação/trabalho validado. Esperado: RAG e Graph são usados como fontes
   adequadas, nunca como estado transacional.
9. Como manager, valide a leitura e auditoria permitidas. Como member, valide
   que apenas campanhas autorizadas são listadas. Não use a conta member para
   mutações fora de sua autorização.
10. Envie uma instrução maliciosa apenas como conteúdo de teste. Esperado: ela
   não amplia papel, escopo, confirmação ou seleção de tool.

Retry idêntico, conflito de versão, rate limit, indisponibilidade e restart não
devem ser simulados por cliques repetidos no site público: exigem replay do
mesmo plano ou intervenção em serviço. Execute-os apenas em janela controlada,
com backup e autorização explícita, registrando correlation IDs e sem expor
tokens.

## Evidência mínima esperada

- data do aceite;
- versão/commit implantado;
- rota MCP e services healthy;
- jornada manual por papel;
- resultado do smoke de conflito e indisponibilidade;
- evidência dos cenários RAG, Graph, tom ENS e prompt injection;
- aceite funcional do usuário.

## Resultado esperado

Enquanto algum item obrigatório estiver pendente, a Fase 4 permanece abaixo de
`production_validated`. Este documento só deve ser reconciliado depois do gate
VPS real.
