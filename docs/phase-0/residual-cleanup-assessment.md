# Avaliação de código residual do frontend

## Status

- **Estado:** `approved_and_removed`
- **Decisão:** Grupo A aprovado pelo usuário em 2026-07-10
- **Ação executada:** 22 arquivos residuais removidos do checkout local
- **Escopo:** código não alcançável do `apps/chat-web/src`
- **Banco:** nenhuma migration ou tabela alterada
- **Publicação:** nenhuma; sem commit, push ou deploy nesta etapa

## Pergunta

É seguro remover os módulos antigos de campanhas/Market Intelligence, o gerador mock de e-mail e o fluxo antigo de landing page sem afetar o runtime atual do Projeto ENS?

## Metodologia

1. Partida em `apps/chat-web/src/main.tsx`.
2. Resolução de imports estáticos relativos e alias `@/`.
3. Busca global de símbolos e nomes de tabelas.
4. Inspeção das rotas declaradas em `App.tsx`.
5. Build Vite de produção.
6. Busca no bundle por textos exclusivos dos módulos candidatos.
7. Separação entre código, configuração, migration histórica e dados externos.

## Evidências

### Grafo estático

- módulos TypeScript/TSX alcançáveis a partir de `main.tsx`: 66;
- módulos não alcançáveis, excluindo testes e `vite-env.d.ts`: 54;
- arquivos das três ilhas antigas entre os não alcançáveis: 22;
- `NavLink.tsx` também aparece órfão;
- componentes Shadcn não usados hoje também aparecem órfãos, mas são biblioteca para as próximas fases e não foram classificados como lixo.

### Rotas

`App.tsx` não importa `pages/Campaigns.tsx`, `EmailGenerator` nem `LandingPageGenerator`. A home renderiza apenas `ChatInterface` e `ImageGenerator`.

### Build

Comando: `npm run build` em `apps/chat-web`.

Resultado observado:

- Vite 6.4.1;
- 3.291 módulos transformados;
- build concluído em 21,27 s;
- warnings existentes de chunk grande e import misto do Supabase;
- nenhuma falha.

Textos ausentes do `dist`:

- `Inteligência de Mercado`;
- `Concorrentes monitorados`;
- `Gerador de E-mail Marketing`;
- `nexus-design`;
- `Mock N8n Request`;
- `Conhecimento que Gera Valor`.

Isso confirma que as ilhas não fazem parte do bundle entregue atualmente.

## Grupo A — removido do código atual

### Campanhas/Market Intelligence antigo — 11 arquivos

- `apps/chat-web/src/pages/Campaigns.tsx`;
- `apps/chat-web/src/services/marketIntelligenceService.ts`;
- `apps/chat-web/src/components/campaigns/CampaignLayout.tsx`;
- `apps/chat-web/src/components/campaigns/dashboard/CampaignDashboard.tsx`;
- `apps/chat-web/src/components/campaigns/dashboard/market-intelligence/MarketIntelligenceCharts.tsx`;
- `apps/chat-web/src/components/campaigns/dashboard/market-intelligence/MarketIntelligenceDashboard.tsx`;
- `apps/chat-web/src/components/campaigns/dashboard/market-intelligence/MarketIntelligenceInsights.tsx`;
- `apps/chat-web/src/components/campaigns/dashboard/market-intelligence/useMarketIntelligenceDashboard.ts`;
- `apps/chat-web/src/components/campaigns/list/CampaignListView.tsx`;
- `apps/chat-web/src/components/campaigns/market-intelligence/MarketIntelligenceView.tsx`;
- `apps/chat-web/src/components/campaigns/market-intelligence/components/MarketEmptyState.tsx`.

Motivo: formam uma ilha fechada iniciada por uma página sem rota. O conteúdo representa concorrentes/Market Intelligence, não o Workspace Operacional aprovado.

### Gerador mock de e-mail — 2 arquivos

- `apps/chat-web/src/components/EmailGenerator.tsx`;
- `apps/chat-web/src/lib/n8n-service.ts`.

Motivo: `EmailGenerator` não possui consumidor e o serviço é explicitamente um mock com delay aleatório e `console.log`, não uma integração real.

### Landing page/Nexus Design antigo — 9 arquivos

- `apps/chat-web/src/components/LandingPageGenerator.tsx`;
- `apps/chat-web/src/components/nexus-design/NexusDesign.tsx`;
- `apps/chat-web/src/components/nexus-design/Preview.tsx`;
- `apps/chat-web/src/components/nexus-design/Stepper.tsx`;
- `apps/chat-web/src/components/nexus-design/types.ts`;
- `apps/chat-web/src/components/nexus-design/steps/ConfigStep.tsx`;
- `apps/chat-web/src/components/nexus-design/steps/ContentStep.tsx`;
- `apps/chat-web/src/components/nexus-design/steps/GeneratingStep.tsx`;
- `apps/chat-web/src/components/nexus-design/steps/ResultStep.tsx`.

Motivo: a única entrada é `LandingPageGenerator`, que não possui rota ou consumidor.

### Impacto estimado

- 22 arquivos de feature;
- aproximadamente 2.570 linhas dentro do conjunto de 23 arquivos medido com o utilitário órfão;
- nenhum impacto esperado no bundle atual;
- histórico continuará disponível no Git.

## Validação depois da remoção

Executada em `apps/chat-web`, carregando as variáveis públicas do Supabase a partir do `.env` da raiz sem exibir valores:

| Verificação | Resultado | Evidência resumida |
|---|---|---|
| `npx vitest run` | `pass` | 33 arquivos; 120 testes aprovados |
| `npm run build` | `pass` | Vite final 6.4.3; 3.291 módulos; CSS reduziu de ~105,24 kB para ~95,98 kB |
| `npm run lint` | `pass_with_warnings` | zero erros; 10 warnings preexistentes |
| `npm run security:gate` | `pass_after_lockfile_remediation` | primeiro audit encontrou 14 altas/6 moderadas; atualização compatível do lockfile, regressão e gate final resultaram em 0 vulnerabilidades |
| busca de referências | `pass` | nenhum símbolo/arquivo removido permanece referenciado pelo runtime |
| `git diff --check` | `pass` | sem erro de whitespace |

A falha inicial do security gate não foi causada pela remoção. A correção foi limitada ao lockfile, sem `--force`, e validada novamente por testes, RLS, lint, build e audit.

## Grupo B — seguro, mas opcional

### `apps/chat-web/src/components/NavLink.tsx`

O arquivo não é alcançável nem importado. Pode ser removido, mas é um utilitário pequeno e não está ligado aos três experimentos antigos. Recomenda-se remover junto para manter o inventário honesto; recriar é trivial se necessário.

### Chaves `NEXUS_N8N_URL` e `NEXUS_N8N_API_KEY` em `.env.example`

A busca encontrou essas chaves apenas no exemplo de ambiente. O Compose e o código atual não as consomem. Remover o exemplo não muda runtime, mas deve ocorrer na mesma limpeza do mock para não sugerir uma integração inexistente. Valores eventualmente presentes no `.env` real não serão lidos nem apagados por esta tarefa.

## Grupo C — não remover agora

### Migration `20260116_market_intelligence.sql`

Deve permanecer no histórico de migrations. Apagar a migration não remove tabelas de um Supabase já migrado e quebra a reprodutibilidade do schema desde o zero.

### Tabelas `market_*`

O código ativo não as usa, mas o estado e consumidores externos do Supabase ainda não foram confirmados. O repositório contém plano histórico para n8n/Apify e workflows antigos de Meta. A eventual remoção exige:

1. inventário do Supabase real;
2. busca de consumers externos;
3. contagem e backup dos dados;
4. janela de observação;
5. nova migration explícita de drop com rollback/restore.

### Componentes Shadcn/Radix não usados

Calendário, tabela, form, tabs, chart e outros componentes não alcançáveis hoje são biblioteca compartilhada e têm uso provável nas Fases 2, 3 e 7. Removê-los agora geraria churn sem benefício relevante no bundle, pois Vite já os exclui.

### Dependências `framer-motion` e `recharts`

`framer-motion` continua usado pelo `ImageGenerator`/`OrbLoader`. `recharts` permanece referenciado pelo componente de UI `chart.tsx` e será provável na Fase 7. Não remover nesta limpeza.

### Logo ENS

`/Logo da ENS.png` continua referenciado por metadados Open Graph e Twitter no `index.html`, portanto deve permanecer.

## Risco residual

| Risco | Avaliação | Mitigação |
|---|---|---|
| Import dinâmico não detectado | Baixo | Busca global + ausência no bundle |
| Consumidor externo das tabelas | Desconhecido | Não alterar banco/migrations |
| Reuso futuro do código antigo | Baixo | Git preserva histórico; novo produto tem arquitetura diferente |
| Dependência npm ficar sem uso | Baixo | Não remover dependências neste corte |

## Recomendação

O Grupo A já foi removido e validado. Manter `NavLink.tsx`, as chaves n8n do `.env.example`, migrations, tabelas, workflows históricos, componentes Shadcn e dependências fora deste corte. Reavaliar esses itens somente com inventário específico e, para banco, confirmação do runtime real e backup.
