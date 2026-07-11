# Validação VPS Linux — Fase 0

## Status

- **Estado:** `pass`
- **Execução:** deploy realizado pelo usuário após `git pull`; evidência consolidada em 2026-07-11
- **Responsável pelo push/deploy:** usuário
- **Responsável pelo roteiro de validação:** Codex com o usuário
- **Aceite funcional:** confirmado pelo usuário após uso do frontend implantado
- **Versão validada:** `main` contendo os commits `53c8df2` e `a9bea0b`

## Pré-condições

- commit da Fase 0 revisado localmente;
- push realizado pelo usuário;
- backup confirmado;
- `.env` preservado e não impresso;
- acesso à VPS autorizado;
- janela de validação definida.

## Checklist não destrutivo

- [x] Confirmar a atualização da branch implantada por `git pull`, atestada pelo operador.
- [x] Confirmar o Compose efetivo pelos serviços materializados no `docker compose ps` fornecido.
- [x] Confirmar serviços, health checks e dependências críticas.
- [x] Validar que os serviços persistentes anteriores permaneceram ativos durante o rollout do frontend.
- [x] Confirmar redes e portas publicadas somente em loopback quando previsto.
- [x] Validar a rota pública pelo aceite funcional do usuário após uso real.
- [x] Confirmar que RAG e Graph permaneceram em serviços separados e saudáveis.
- [x] Verificar a amostra de logs fornecida sem secrets.
- [x] Confirmar inicialização limpa do frontend reconstruído.
- [x] Executar smoke funcional do frontend, confirmado pelo usuário.
- [x] Confirmar o caminho de rollback documentado; a Fase 0 não aplicou migrations nem alterou volumes de dados.
- [x] Registrar divergências observadas entre repositório e produção: nenhuma relatada pelo operador.

## Evidências recebidas

O operador executou `git pull` e o deploy na VPS Linux. A saída resumida registrou:

| Serviço | Evidência de runtime |
|---|---|
| `app-bridge` | ativo por 2 dias e `healthy` |
| `app-frontend` | container recriado no deploy; health inicialmente `starting` |
| `artifact-server` | ativo por 10 dias e `healthy` |
| `designer-api` | ativo por 10 dias e `healthy` |
| `graph-mcp` | ativo por 8 dias e `healthy` |
| `hermes-api` | ativo por 8 dias e `healthy` |
| `hermes-kanban` | ativo por 9 dias e `healthy` |
| `neo4j` | ativo por 10 dias e `healthy` |
| `rag-mcp` | ativo por 8 dias e `healthy` |
| `rag-mcp-ingestion-cron` | ativo por 10 dias; sem healthcheck declarado na saída |

Os logs do `app-frontend` mostraram a execução dos scripts de inicialização e terminaram em `Configuration complete; ready for start up`. A mensagem informativa sobre `default.conf` em filesystem somente leitura não impediu o startup. O estado `health: starting` foi capturado nos primeiros segundos do novo container; o usuário confirmou posteriormente que acessou e utilizou a aplicação com sucesso.

## Escopo da homologação

- o rollout da Fase 0 alterou documentação e frontend, sem migration de banco;
- os Supabases do app e do RAG permaneceram separados e sem mutação de schema nesta fase;
- os serviços persistentes de RAG, Graph, Hermes, artifacts e Neo4j não foram recriados pelo rollout apresentado;
- backup e rollback seguem o runbook versionado em `vps-deployment-runbook.md` e não exigiram restauração durante a homologação.

## Resultado

Gate VPS aprovado com evidência operacional fornecida e aceite funcional explícito do usuário. A Fase 0 passa a `production_validated`/`completed`, liberando a implementação da Fase 1.
