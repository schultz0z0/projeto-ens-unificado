# Próximos passos (QA/Security/SRE)

## 1) Vite/esbuild (dependências)

1. Atualizar Vite para uma versão não afetada.
2. Rodar build/lint/audit e um smoke E2E do caminho feliz.
3. Bloquear merge/deploy se `npm audit --audit-level=high` falhar.

Status neste repo: Vite atualizado para 6.4.1 e `npm audit --audit-level=high` limpo.

## 2) RAG (chatbot_rag_documents)

1. Remover `SELECT USING (true)` e políticas de escrita abertas.
2. Revogar privilégios de `anon` e `authenticated` na tabela.
3. Garantir que somente backends (service role) façam ingestão e retrieval.

Requisito operacional:
- n8n / backend Python devem usar credenciais server-side (service role key ou conexão Postgres) para ler/alterar o RAG.

## 3) Gate automático

Executar localmente (ou em CI):

```
npm run security:gate
```

Esse gate falha se:
- houver strings que parecem segredos no repo
- RLS de `profiles`, `generated_images` ou RAG permitir leitura pública
- lint/build/audit falharem

