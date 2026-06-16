# Plano de Investigação Profunda (Supabase RAG)

Você está certo, vamos verificar o estado real antes de assumir qualquer coisa.

## 1. Investigação Estrutural (Supabase CLI)

Criarei um script de diagnóstico (`scripts/inspect_rag_db.js`) para responder:

* **A tabela** **`chatbot_rag_documents`** **existe mesmo?**

* **Qual a dimensão da coluna** **`embedding`?** (É 768 ou 1536? Se for 1536, o Gemini falha).

* **Existem dados?** (Quantas linhas?)

* **Amostra de dados:** (O campo `content` está preenchido ou nulo?)

## 2. Análise Cruzada com Workflows

Com base no JSON que você forneceu:

* O workflow de **Ingestão** está apontando para `chatbot_rag_documents`.

* O workflow de **Chat** está apontando para `chatbot_rag_documents` e usando Gemini.

* **Hipótese de Falha:** Se o banco mostrar 0 linhas, sabemos que a ingestão falhou (talvez erro de permissão de escrita, mesmo com RLS). Se mostrar linhas, mas com dimensão errada, sabemos que a migração não pegou.

## 3. Relatório e Ação

Apresentarei os fatos: "A tabela tem X linhas, dimensão Y". Com isso, a decisão de limpar/re-ingerir será baseada em dados reais. Para posteriormente resolver o erro do chatbot responder comandos genericos mas dá erro 502 quando tenta responder comandos ligados ao RAG do chatbot.

**Posso rodar o script de inspeção do banco agora?**
