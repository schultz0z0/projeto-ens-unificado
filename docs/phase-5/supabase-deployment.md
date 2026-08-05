# Deploy Supabase — Fase 5

- **Estado:** `not_started`
- **Projeto alvo:** Supabase do app, nunca o Supabase do RAG
- **Responsável pelo deploy:** responsável autorizado

Nenhuma migration da Fase 5 foi criada ou aplicada neste snapshot.

## Pré-condições

- gate local de banco completo;
- arquivo de migration revisado e versionado;
- projeto remoto identificado inequivocamente;
- backup externo de schema e dados com hashes;
- lista local/remota de migrations reconciliada;
- dry-run contendo somente mudanças conhecidas da Fase 5.

## Sequência controlada

1. confirmar identidade do projeto do app;
2. criar e verificar backup;
3. listar migrations locais e remotas;
4. executar `supabase db push --linked --dry-run`;
5. revisar DDL, RLS, grants, índices e ausência de drops inesperados;
6. aplicar a migration autorizada;
7. executar lint/advisors e consultas de invariantes;
8. fazer smoke com fixtures identificadas como teste;
9. registrar hashes, timestamps e resultado sem secrets.

## Invariantes pós-deploy

- tabelas e enums da Fase 5 presentes;
- RLS forçada e grants mínimos;
- versão/payload/decisões append-only conforme contrato;
- nenhuma alteração no Supabase do RAG;
- migrations local/remota alinhadas;
- dados existentes das Fases 1–4 preservados.
