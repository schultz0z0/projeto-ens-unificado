# Validação VPS — Fase 4

- **Estado:** `ready_after_predeploy_reconciliation`
- **Implementação local:** `implemented_pending_vps_validation`
- **Responsável pelo deploy:** usuário
- **Responsável pelos testes manuais finais:** assistente, após o deploy
- **Promoção final:** somente após evidência real e aceite

## Nota de reconciliação — 28/07/2026

O código, os testes locais aplicáveis, o E2E fake do operador Hermes e a
migration remota do Supabase já foram reconciliados. Este documento passa a ser
o checklist autoritativo para fechar a promoção da Fase 4 em produção.

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

## Checklist planejado

- [ ] imagens e configuração publicadas;
- [ ] `marketing-ops`, Bridge e runtime Hermes healthy;
- [ ] descoberta do catálogo MCP em ambiente real;
- [ ] catálogo sem tools diretas legadas de mutação;
- [x] migration e índices de correlação aplicados e histórico remoto alinhado
  em 2026-07-28;
- [ ] VPS confirma que aponta para esse mesmo projeto Supabase;
- [ ] refresh de delegação funcionando;
- [ ] smoke de leitura de campanhas e agenda;
- [ ] plano preparado sem persistência prematura;
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
3. rebuildar e subir `app-frontend`, `app-bridge`, `marketing-ops`,
   `hermes-api` e `hermes-kanban`;
4. confirmar health/readiness e logs sem segredo;
5. verificar se a migration da Fase 4 já está refletida no Supabase alvo;
6. executar os smokes manuais do operador Hermes;
7. registrar evidência e aceite final.

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
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml exec -T hermes-api hermes mcp test nexus_picture
```

Se a VPS usar outro diretório padrão do projeto, ajuste apenas o `cd`.

Antes do build, execute também os `grep` de configuração em
[runbook.md](runbook.md#conferência-segura-da-configuração-da-vps). Para este
gate, use o build `--no-cache` dos cinco serviços indicado no runbook.

## Smoke manual mínimo

1. abrir o chat e pedir uma ação de Marketing Ops sem confirmar;
2. verificar que o Hermes responde com plano/preview, sem persistir e sem deep
   link final;
3. responder `aprovado` no turno seguinte;
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
2. Peça a criação da campanha de teste, mas não confirme. Esperado: preview
   claro, nenhuma persistência e nenhum deep link final.
3. Responda somente `Aprovado`. Esperado: uma criação, auditoria correlacionada
   e deep link de campanha válido.
4. Peça para preencher os campos suportados da campanha: objetivo, público,
   briefing, notas, datas e canais. Esperado: novo preview e atualização apenas
   após confirmação.
5. Peça a conversão do briefing em pelo menos um item de e-mail agendado.
   Depois do preview, confirme e abra o deep link do item.
6. No item criado, peça exatamente um rascunho `email_html` e, em seguida, uma
   versão inicial da copy. Esperado: não ocorrer `invalid_union` nem
   `delegation_scope_denied`; o link de conteúdo abre o asset e sua versão.
7. Peça uma revisão de tom ENS baseada em fato institucional e uma consulta que
   exija relação/trabalho validado. Esperado: RAG e Graph são usados como fontes
   adequadas, nunca como estado transacional.
8. Como manager, valide a leitura e auditoria permitidas. Como member, valide
   que apenas campanhas autorizadas são listadas. Não use a conta member para
   mutações fora de sua autorização.
9. Envie uma instrução maliciosa apenas como conteúdo de teste. Esperado: ela
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
