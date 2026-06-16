Este plano detalhado utiliza os agentes especializados disponíveis (UI/UX Designer e N8n Integrator) para garantir a excelência na implementação e a preparação robusta para o futuro backend.

### 1. UI/UX e Design System (Agente: UI/UX Designer)
**Objetivo:** Garantir consistência visual e usabilidade fluida, seguindo o padrão "Shadcn UI" do projeto.
*   **Navegação:** Adicionar ícones `Mail` e `Layout` à `Sidebar`, mantendo o estilo "glassmorphism" existente.
*   **Layout do Gerador de E-mail:**
    *   Projetar a interface de **2 Blocos** (Split View):
        *   **Esquerda (Interação):** Interface de chat compacta, focada na construção do conteúdo. Diferente do chat principal, este é contido no card.
        *   **Direita (Resultado):** Área de preview do HTML com barra de ferramentas superior (Download, Zerar).
*   **Landing Page:** Criar uma tela de "Em Desenvolvimento" elegante, alinhada à identidade visual (possivelmente usando o mascote).

### 2. Engenharia e Componentização (Engenheiro Sênior)
**Objetivo:** Implementar a lógica frontend modular e limpa.
*   **Componente `EmailGenerator.tsx`:**
    *   **Gerenciamento de Estado:** Implementar lógica para persistir o histórico do chat e o HTML gerado até que o usuário acione "Zerar Tudo".
    *   **Interatividade:** Permitir que o usuário refine o e-mail enviando novas mensagens no chat (ex: "Mude a cor do botão para azul"), atualizando o preview em tempo real (simulado).
    *   **Download:** Implementar a função de exportação do HTML final para arquivo local.
*   **Roteamento:** Atualizar `Index.tsx` para gerenciar as novas abas (`email`, `landing`) sem recarregar a página.

### 3. Preparação para Integração n8n (Agente: N8n Integrator)
**Objetivo:** Preparar o "terreno" para a futura conexão com o webhook, definindo contratos de dados claros.
*   **Service Layer (`src/lib/n8n-service.ts`):**
    *   Criar uma função `generateEmailMarketing(message, history)` estruturada.
    *   **Mock Inteligente:** Implementar um mock que retorna um HTML rico e responsivo, utilizando o **KV (Key Visual) da Escola de Negócios e Seguros**, simulando fielmente o output esperado do agente n8n.
    *   **Contrato de API:** Definir o payload JSON exato que o webhook do n8n receberá futuramente, facilitando a transição de "Mock" para "Produção".

### 4. Execução Passo-a-Passo
1.  **Sidebar & Rotas:** Atualizar navegação.
2.  **Estrutura Base:** Criar arquivos dos componentes.
3.  **Mock Service:** Criar o simulador de resposta n8n com HTML da ENS.
4.  **UI Implementation:** Construir o layout de 2 colunas e integrar com o serviço mock.
5.  **Review:** Verificar responsividade e funcionamento dos botões de ação.
