Este plano detalha a implementação completa do sistema de histórico de conversas com isolamento de sessão, abrangendo desde a arquitetura de dados até a experiência do usuário (UI/UX).

### 1. Arquitetura de Dados (Supabase)
**Objetivo:** Garantir persistência e isolamento seguro das conversas.
*   **Novas Tabelas:**
    *   `chat_sessions`: Armazena os metadados da conversa (`id` UUID, `user_id`, `title`, `created_at`, `updated_at`).
    *   `chat_messages`: Armazena o conteúdo (`id`, `session_id`, `role` [user/assistant], `content`, `created_at`).
*   **Segurança (RLS):** Implementar políticas Row Level Security para garantir que cada usuário acesse apenas seus próprios chats.
*   **Performance:** Índices criados nas chaves estrangeiras para carregamento instantâneo do histórico.

### 2. Interface do Usuário (UI/UX)
**Objetivo:** Criar a "Secondary Sidebar" inspirada no Synapse, mas com o visual Nexus AI (Glassmorphism).
*   **Novo Componente `ChatHistorySidebar.tsx`:**
    *   **Posicionamento:** Localizado à esquerda do chat, à direita da Sidebar principal.
    *   **Header:** Botão "Novo Chat" (+ New Chat) destacado, com ícone `Plus` e estilo primário.
    *   **Lista de Histórico:** Lista scrollável de sessões anteriores, ordenadas da mais recente para a mais antiga.
    *   **Item da Lista:** Título da conversa (truncado), ícone de chat e estado "ativo" visualmente distinto.
    *   **Toggle:** Botão discreto (ícone `PanelLeftClose`/`PanelLeftOpen`) para recolher/expandir a barra, maximizando a área de chat.
    *   **Responsividade:** Em mobile, funcionará como um `Sheet` (gaveta) lateral.

### 3. Lógica de Integração e Estado
**Objetivo:** Conectar a UI ao Banco de Dados e ao N8N.
*   **Refatoração do `ChatInterface.tsx`:**
    *   **Gerenciamento de Sessão:** Substituir o ID de sessão local (`localStorage`) pelo ID da sessão selecionada no banco (`chat_sessions.id`).
    *   **Carregamento de Contexto:** Ao clicar em um item do histórico, o chat limpará o estado atual e buscará as mensagens daquela sessão específica no Supabase (`chat_messages`).
    *   **Persistência em Tempo Real:**
        *   Ao enviar uma mensagem, ela será salva na tabela `chat_messages`.
        *   Ao receber a resposta do N8N, ela também será salva.
        *   O título da sessão será gerado automaticamente (ex: "Conversa iniciada em...") ou atualizado com base na primeira mensagem.
    *   **Webhook N8N:** Continuará recebendo o `sessionId`, garantindo que o agente de IA mantenha a memória correta para aquela conversa específica.

### 4. Execução Passo-a-Passo
1.  **Database:** Criar migração SQL para as tabelas e aplicar no Supabase.
2.  **Frontend Services:** Criar funções em `src/lib/supabase.ts` para buscar sessões, criar sessão e salvar mensagens.
3.  **Componente Sidebar:** Implementar `ChatHistorySidebar` com o design system.
4.  **Integração:** Conectar a sidebar ao `ChatInterface` e implementar a lógica de troca de sessão.
5.  **Refinamento:** Adicionar animações de transição e estados de loading.
