# ADR 0005 — Gates local e VPS

- **Status:** `accepted`
- **Data:** 2026-07-10
- **Decisor:** responsável do produto
- **Fases afetadas:** 0–8

## Contexto

O desenvolvimento ocorre localmente em Windows, enquanto produção roda em VPS Linux com Docker Compose, volumes, Traefik, DNS/TLS e secrets próprios. Testes locais não comprovam permissões Linux, rede efetiva, persistência ou configuração de produção. Ao mesmo tempo, o usuário reservou para si o push e o deploy.

## Decisão

Toda fase terá dois gates registrados:

- **Gate local:** inspeções, testes, build, lint/typecheck, segurança, migrations aplicáveis e documentação.
- **Gate VPS:** depois do deploy do usuário, validar commit, Compose efetivo, containers, health, rede, volumes, migrations, logs, smoke, reinício, backup e rollback.

Estados oficiais:

- `in_progress`: trabalho ou gate local pendente;
- `ready_for_production`: gate local concluído; aguarda push/deploy/gate VPS;
- `production_validated`: gate VPS aprovado; fase concluída;
- `blocked`: impedimento registrado que inviabiliza o próximo gate.

O Codex não fará push nem deploy sem nova autorização. O usuário executará esses passos seguindo o runbook, e a validação será retomada com o commit efetivamente implantado.

## Alternativas consideradas

1. **Declarar concluído após testes locais:** rejeitada; não cobre diferenças Linux/produção.
2. **Testar somente na VPS:** rejeitada por elevar risco e tempo de rollback.
3. **Deploy automático pelo agente:** rejeitada por limite de autoridade definido pelo usuário.
4. **Gate informal por observação manual:** rejeitada; evidências e comandos precisam ser registrados.

## Consequências

- a Fase 0 pode chegar a 100% local e `ready_for_production`, mas não a `production_validated` sem ação do usuário;
- ausência de Docker/Bash local vira limitação explícita, não aprovação presumida;
- runbooks e rollback fazem parte da Definition of Done;
- a Fase 1 pode ser planejada após os artefatos bloqueantes da Fase 0, mas sua implementação não deve mascarar um gate de produção pendente quando o responsável exigir fechamento sequencial.
