Entendido. Vamos fazer a reestruturação completa: criar o novo (padrão OpenAI) e eliminar o velho (limpeza total).

### 1. Criação da Nova Estrutura (Padrão OpenAI 1536d)
Criaremos as tabelas definitivas, tipadas estritamente para o modelo `text-embedding-3-small`.

*   **Tabelas**: `rag_marketing`, `rag_ens`, `rag_email_html`
    *   Todas com coluna `embedding vector(1536)`.
    *   Todas com RLS ativado (apenas service_role acessa).
    *   Todas com índices HNSW para busca rápida.

*   **Funções de Busca (RPCs)**:
    *   `match_rag_marketing`
    *   `match_rag_ens`
    *   `match_rag_email_html`
    *   Assinaturas blindadas para evitar erros de ambiguidade.

### 2. Eliminação do Legado ("Lixo")
Após criar a estrutura nova, o script removerá os artefatos antigos para não deixar vestígios.

*   **DROP TABLE**: `chatbot_rag_documents` (Remove todos os dados antigos/misturados).
*   **DROP FUNCTION**: `match_chatbot_rag` (Remove a função antiga).

**Resultado Final:** Um Supabase limpo, com 3 tabelas especializadas prontas para receber os novos embeddings que você vai gerar pelo n8n.

Vou gerar o SQL para aplicar essa mudança de uma só vez.
