# Validação VPS — Fase 4

- **Estado:** `ready_for_execution`
- **Implementação local:** `implemented_pending_vps_validation`
- **Responsável pelo deploy/testes manuais:** usuário
- **Promoção final:** somente após evidência real e aceite

## Nota de reconciliação — 22/07/2026

O código, os testes locais aplicáveis, o E2E fake do operador Hermes e a
migration remota do Supabase já foram reconciliados. Este documento passa a ser
o checklist autoritativo para fechar a promoção da Fase 4 em produção.

## Checklist planejado

- [ ] imagens e configuração publicadas;
- [ ] `marketing-ops`, Bridge e runtime Hermes healthy;
- [ ] descoberta do catálogo MCP em ambiente real;
- [ ] catálogo sem tools diretas legadas de mutação;
- [ ] migration e índices de correlação aplicados;
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
cd /opt/projeto-ens-unificado
bash scripts/bootstrap.sh
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml build app-frontend app-bridge marketing-ops hermes-api hermes-kanban
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 marketing-ops app-bridge hermes-api app-frontend
```

Se a VPS usar outro diretório padrão do projeto, ajuste apenas o `cd`.

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
