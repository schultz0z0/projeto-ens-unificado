# Inventário do frontend

## Escopo e fontes

- rotas: `apps/chat-web/src/App.tsx`;
- shell e navegação: `apps/chat-web/src/pages/Index.tsx` e `apps/chat-web/src/components/Sidebar.tsx`;
- páginas: `apps/chat-web/src/pages`;
- domínio de chat: `apps/chat-web/src/components/ChatInterface.tsx`, `components/chat` e `lib/chatService.ts`;
- serviços: `apps/chat-web/src/services` e `apps/chat-web/src/lib`;
- migrations relacionadas: `apps/chat-web/supabase/migrations`.

## Resumo atual

O runtime alcançável possui quatro rotas declaradas e uma rota catch-all. A home oferece somente as abas internas `chat` e `image`. As três ilhas sem rota de campanhas/Market Intelligence, e-mail mock e landing page foram removidas após análise e aprovação, sem alterar banco ou migrations.

## Rotas ativas

| Rota | Tela | Acesso | Dependências principais | Classificação | Fase-alvo | Evidência |
|---|---|---|---|---|---|---|
| `/login` | Login e recuperação | Público | Supabase Auth | `keep` | Transversal | `App.tsx:24`, `pages/Login.tsx` |
| `/` | Shell com Chat ou Gerador de Imagem | Autenticado | Supabase, Chat Bridge, Hermes, Designer API | `adapt` | Fases 2–4 | `App.tsx:27`, `pages/Index.tsx` |
| `/admin/users` | Administração de usuários | Admin | Supabase, Edge Functions/RPCs | `keep` | Fase 1 | `App.tsx:36`, `pages/admin/UserManagement.tsx` |
| `/manager/validated-works` | Memória validada | Manager/Admin | Supabase `validated_works`, Graph | `adapt` | Fases 4 e 7 | `App.tsx:45`, `pages/manager/ValidatedWorks.tsx` |
| `*` | Not found | Conforme roteamento | React Router | `keep` | Transversal | `App.tsx:54` |

## Navegação ativa

| Entrada | Comportamento | Classificação | Observação |
|---|---|---|---|
| Chatbot | Seleciona tab `chat` na home | `keep` | Entrada conversacional principal |
| Gerar Imagens | Seleciona tab `image` na home | `keep` | Usa `ImageGenerator`; não é o workspace de criativos futuro |
| Trabalhos Validados | Abre rota manager | `adapt` | Preservar como memória, não como banco operacional |
| Administração | Abre gestão de usuários | `keep` | Matriz de papéis será revisada na Fase 1 |
| Perfil | Modal de configurações | `adapt` | Pode receber preferências operacionais futuras |

## Módulos ativos a preservar

| Módulo | Responsabilidade | Classificação | Motivo |
|---|---|---|---|
| `ChatInterface` e `components/chat` | Runs, streaming, anexos, arquivos, artefatos e approval técnico | `keep` | Integração madura e independente do Marketing Ops |
| `chatService` | Sessões/mensagens Supabase e deleção coordenada | `keep` | Fonte atual do histórico do chat |
| `AuthContext`/`ProtectedRoute`/`roles` | Sessão e gating inicial de papéis | `adapt` | Marketing Ops/RLS serão autoridade definitiva |
| `ImageGenerator`/`imageGeneratorService` | Fluxo visual do app e Designer API | `keep` | Capacidade ativa; vínculo a campanhas virá depois |
| `ValidatedWorks`/`validatedWorks` | Curadoria de memória compartilhada | `adapt` | Integrar por referência a aprendizados/campanhas |
| `ChatHistorySidebar` | Navegação do histórico | `keep` | Continua no modelo conversacional |
| `ui/*` | Primitivos Shadcn/Radix | `keep` | Base de componentes reutilizável |

## Código residual removido

| Superfície | Estado observado antes do corte | Classificação final | Ação executada | Evidência |
|---|---|---|---|---|
| `pages/Campaigns.tsx` e `components/campaigns/*` | Ilha fechada, sem rota; UX de concorrentes, não workspace operacional | `removed` | 10 arquivos removidos | grafo de imports, rotas e bundle |
| `marketIntelligenceService` | Único client frontend das tabelas `market_*` | `removed_code_only` | serviço removido; banco preservado | busca global e inventário Supabase |
| `EmailGenerator` e `lib/n8n-service.ts` | Componente órfão e mock com delay/log | `removed` | 2 arquivos removidos | busca de imports e conteúdo do mock |
| `LandingPageGenerator`/`nexus-design/*` | Ilha fechada sem rota/consumidor | `removed` | 9 arquivos removidos | grafo de imports e bundle |

Validação pós-corte: 33 arquivos/120 testes passaram, build passou, lint terminou sem erros e a busca global não encontrou referências residuais. O primeiro security gate encontrou dependências vulneráveis; o lockfile foi atualizado sem `--force`, os 120 testes foram repetidos e o gate final passou com 0 vulnerabilidades.

## Código não alcançável mantido

- `components/NavLink.tsx`: utilitário órfão pequeno, fora do Grupo A aprovado;
- componentes Shadcn/Radix: biblioteca prevista para as próximas fases e eliminada do bundle quando não usada;
- migrations e tabelas `market_*`: histórico/dados não são removidos por uma limpeza de frontend;
- chaves n8n no `.env.example`: preservadas para decisão de configuração separada.

## Lacunas para o produto-alvo

- não existem rotas ativas de campanhas, calendário, aprovações de negócio ou dashboard operacional;
- não existe client do futuro Marketing Ops;
- o frontend ainda usa Supabase direto para vários domínios;
- papéis atuais controlam rotas, mas não substituem autorização server-side;
- approval modal atual é técnico e não pode ser reaproveitado como aprovação editorial;
- não há deep links para objetos operacionais;
- não há tratamento de concorrência de entidades de campanha.

## Decisões para as fases seguintes

1. Criar rotas novas e estáveis para Marketing Ops, sem reativar `Campaigns.tsx` como atalho.
2. Preservar chat e geração de imagem enquanto o workspace é construído.
3. Manter Market Intelligence fora do MVP; reavaliar dados e UX na Fase 7.
4. Migrar autorização de negócio para o serviço/RLS, mantendo gating visual como conveniência.
5. Tratar novos resíduos somente por inventário separado, com teste de ausência de import/rota e sem inferir remoção de dados.
