# ADR 0003 — Delegação confiável para ferramentas do Hermes

- **Status:** `accepted`
- **Data:** 2026-07-10
- **Decisor:** responsável do produto
- **Fases afetadas:** 1 e 4–8

## Contexto

O Bridge hoje valida o usuário e encaminha headers de tenant, papel e sessão ao Hermes. Headers internos e texto do prompt servem como contexto, mas podem ser copiados, ficar obsoletos ou chegar por caminhos não confiáveis. O código também aceita `user_metadata.tenant_id`, que é editável pelo usuário, e possui fallback permissivo quando o Supabase não está configurado.

## Decisão

Chamadas do Hermes ao MCP do Marketing Ops exigirão uma delegação assinada, de curta duração e de uso restrito, contendo no mínimo:

- `iss`, `aud`, `iat`, `nbf`, `exp` e identificador único;
- `tenant_id` e `actor_id` verificados;
- papel efetivo e scopes mínimos;
- `chat_session_id`, `run_id` e correlation ID quando aplicáveis;
- versão do contrato e, para mutações, idempotency key.

O Marketing Ops validará assinatura, audiência, expiração, tenant, scopes e estado do recurso em toda operação. A delegação não substitui RLS nem regras de domínio.

Antes de habilitar o MCP operacional:

1. remover `user_metadata` da resolução confiável de tenant;
2. fazer o Bridge falhar fechado em produção quando Auth não estiver configurado;
3. emitir tenant somente de `app_metadata` controlado ou vínculo server-side;
4. não aceitar papel/scopes enviados pelo cliente;
5. registrar decisões e negações na auditoria.

## Alternativas consideradas

1. **Confiar apenas nos headers `X-Nexus-*`:** rejeitada sem autenticação criptográfica e audiência.
2. **Repassar o JWT do usuário diretamente a todos os serviços:** insuficiente para scopes finos e aumenta exposição do token.
3. **Usar uma chave interna global para todas as ações:** rejeitada por não preservar ator, tenant nem menor privilégio.
4. **Autoridade derivada do prompt:** rejeitada; linguagem natural não é controle de acesso.

## Consequências

- haverá emissor/verificador e rotação de chaves;
- testes de token expirado, audiência errada, cross-tenant e scope ausente são obrigatórios;
- logs não podem registrar o token completo;
- ações longas devem materializar autorização operacional própria, não renovar delegação indefinidamente;
- o risco atual fica registrado como `BLOCKER` da Fase 1.
