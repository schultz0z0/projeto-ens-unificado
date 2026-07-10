# ADR 0002 — Fonte de verdade operacional

- **Status:** `accepted`
- **Data:** 2026-07-10
- **Decisor:** responsável do produto
- **Fases afetadas:** 1–8

## Contexto

O projeto distribui dados entre Supabase, volumes do Bridge/Hermes, Artifact Server, RAG e Neo4j. Campanhas futuras exigem consistência, concorrência controlada, histórico de versão, autorização e reconciliação. Memória conversacional, documentos recuperáveis e relações não oferecem as mesmas garantias transacionais.

## Decisão

O Supabase acessado pelo `marketing-ops` será a fonte de verdade para:

- tenants, membros e permissões do domínio;
- campanhas, itens, conteúdos e versões;
- solicitações/decisões de aprovação;
- autorizações operacionais e pacotes imutáveis;
- jobs, tentativas, recibos, auditoria e outbox;
- referências duráveis a artefatos e fontes de conhecimento.

Os demais stores mantêm fronteiras específicas:

- Artifact Server/Storage: binários e links temporários;
- RAG: documentos oficiais e evidência recuperável;
- Graph: relações, fatos e trabalhos validados;
- Chat Bridge: runs/eventos de transporte;
- Hermes: sessão e memória conversacional.

Sincronizações para RAG/Graph são derivadas de eventos confirmados e nunca sobrescrevem o ledger operacional sem uma operação validada no domínio.

## Alternativas consideradas

1. **Graph como banco principal:** rejeitada para transações, approvals e execução.
2. **Memória Hermes como estado:** rejeitada por volatilidade, falta de controle de concorrência e auditabilidade.
3. **Estado distribuído sem autoridade única:** rejeitada pelo risco de divergência e reconciliação ambígua.
4. **Guardar binários nas tabelas:** rejeitada; persistem-se IDs, hashes, MIME e proveniência.

## Consequências

- migrations, RLS, grants e constraints tornam-se parte do contrato do produto;
- toda integração precisa carregar `tenant_id`, ator e correlation ID validados;
- eventos externos usam outbox/idempotency key;
- RAG e Graph podem ficar temporariamente atrasados sem mudar o estado operacional;
- backup/restore do Supabase passa a ser requisito de deploy;
- o baseline de schema do app deve ser reconciliado antes da primeira migration da Fase 1.
