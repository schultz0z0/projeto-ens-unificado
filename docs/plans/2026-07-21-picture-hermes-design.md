# Picture-Hermes — desenho técnico aprovado

**Data:** 21 de julho de 2026
**Status:** aprovado
**Relação com o roadmap:** implementação independente; Roadmap.md permanece inalterado
**Documento de produto:** PRD-picture-hermes-semi-nativo.md

## Objetivo

Substituir integralmente o Designer API por uma experiência Picture-Hermes
conversacional, persistente e isolada do chat normal. O chat fica à esquerda, a
pasta do trabalho à direita, e apenas a peça aprovada sobrevive ao comando
explícito de criar uma nova peça.

## Decisões arquiteturais

### Picture como serviço, Hermes como planejador

O código de picture-it-main será importado para services/picture-it. Sua engine
será usada como biblioteca por um serviço Bun, sem dar ao Hermes acesso à CLI,
a comandos do sistema ou a caminhos do host.

O Hermes cria um CreativeBrief e um CompositionPlan. O Picture valida,
materializa e executa o plano. Essa divisão mantém a capacidade de composição
da pasta graduação-test sem criar um segundo agente dentro do Picture.

### Artifact Server como fonte dos arquivos visíveis

O Artifact Server será evoluído de armazenamento individual para
armazenamento com ciclo de vida de workspace:

- arquivos recebem owner_id, workspace_id, relative_path, category e lifecycle;
- lifecycle workspace representa briefing, referências, planos e intermediários;
- lifecycle validated representa a peça aprovada;
- listagem por workspace forma o manifest do painel direito;
- promoção troca a candidata final para validated;
- limpeza em lote apaga apenas lifecycle workspace;
- bytes continuam deduplicados por SHA-256;
- previews continuam protegidos por URLs assinadas.

O diretório de execução do worker é descartável. Em uma retomada, os artefatos
podem ser materializados novamente.

### Um workspace ativo por usuário

No MVP existe no máximo um workspace ativo por tenant e usuário. O workspace
se relaciona a uma sessão de chat classificada como picture. A restrição fica
no banco, não apenas na interface.

### Chat persistido e separado

As mensagens continuam nas tabelas chat_sessions e chat_messages. A coluna
session_kind separa normal de picture:

- ChatInterface e ChatHistorySidebar consultam somente normal;
- a página Picture recupera somente a sessão vinculada ao workspace;
- recriar a sessão interna do Hermes não recria chat nem workspace.

### Jobs assíncronos e recuperáveis

Uma chamada MCP enfileira um job e retorna rapidamente. O worker usa leases
persistentes, serializa jobs por workspace e reprocessa leases expirados após
reinício. A interface faz polling somente durante estados não terminais.

### Ações humanas fora do MCP

Hermes pode consultar workspace, iniciar geração, revisar e consultar job.
Aprovar e criar nova peça são endpoints da interface e exigem clique humano.
Isso impede que o modelo promova ou apague trabalho sozinho.

## Fluxo principal

~~~text
Abrir página
  -> Bridge autentica usuário
  -> recupera/cria workspace ativo e sessão picture
  -> frontend hidrata chat e manifest

Enviar mensagem
  -> Bridge registra referências no workspace
  -> emite delegação curta vinculada ao workspace
  -> Hermes recebe modo Picture
  -> Hermes pergunta ou chama picture_start_job
  -> worker executa engine
  -> artefatos aparecem no Artifact Server
  -> frontend atualiza painel

Aprovar
  -> promove candidata final
  -> cria validated_works do tipo peca_visual
  -> workspace passa a validated

Criar nova peça
  -> popup de confirmação
  -> verifica aprovação
  -> apaga artefatos workspace
  -> preserva artefato validated
  -> apaga chat e estado Hermes antigos
  -> fecha workspace
  -> cria workspace e sessão picture vazios
~~~

## Componentes e responsabilidades

### apps/chat-web

- PictureWorkspacePage ou componente equivalente na aba image;
- chat dedicado reutilizando primitivas do chat atual;
- PictureWorkspaceFiles para lista e preview;
- PictureWorkspaceActions para aprovar e criar nova peça;
- client e hook próprios;
- suporte visual a peca_visual em ValidatedWorks.

### services/chat-bridge

- autenticação Supabase;
- BFF para endpoints Picture;
- criação/recuperação da sessão picture;
- delegação curta com workspace_id;
- contrato de prompt Picture, separado do intent image_generate;
- redaction do token técnico;
- proxy de manifest e URLs assinadas;
- limpeza de sessão Hermes durante criar nova peça.

### services/picture-it

- engine importada e corrigida;
- contratos Zod;
- repositórios Postgres;
- API interna;
- MCP Streamable HTTP;
- worker persistente;
- adaptador do Artifact Server;
- executor que materializa o pacote e usa a engine como biblioteca;
- health, readiness, logs e métricas básicas.

### services/artifact-server

- metadados de workspace;
- índice/listagem de manifest;
- promoção idempotente;
- limpeza em lote escopada;
- preservação de objetos ainda referenciados;
- testes de isolamento e idempotência.

### Supabase

- chat_sessions.session_kind;
- picture_workspaces;
- picture_jobs;
- extensão de validated_works para peca_visual;
- índices, constraints e RLS.

### services/hermes-runtime

- registro do MCP nexus_picture;
- variáveis e timeouts;
- skill Picture-Hermes;
- teste de atualização das configurações dos perfis.

## Segurança

O frontend nunca conversa diretamente com o Picture Service. A Bridge valida o
JWT do usuário e encaminha contexto autenticado. O Hermes recebe uma delegação
HS256 curta com usuário, tenant, sessão, workspace, run e scopes. O Picture
rejeita qualquer operação fora desses claims.

Paths são sempre relativos, normalizados e confinados. Nomes absolutos,
sequências de travessia, links simbólicos e categorias desconhecidas são
rejeitados. Tokens não entram em chat_messages, especificações de job ou logs.

O Artifact Server exige chave interna para upload, promoção, listagem e
limpeza. Uma URL de acesso só é emitida quando owner_id coincide com o usuário
autenticado.

## Recuperação e consistência

As operações críticas são idempotentes:

- garantir workspace ativo usa a restrição única no banco;
- iniciar job usa workspace_id mais idempotency_key;
- aprovar usa candidate_artifact_id como chave natural;
- reset usa o estado resetting e pode ser repetido;
- promoção de artefato já promovido retorna sucesso;
- limpeza de workspace já limpo retorna sucesso.

Falha em revisão nunca remove a candidata anterior. Falha depois da promoção e
antes do insert em validated_works é recuperada procurando pelo artifact_id.
Falha durante reset nunca alcança o artefato validated.

## Opções descartadas

### Persistência no navegador

Não atende a reinício do Hermes, troca de dispositivo, isolamento ou jobs
assíncronos.

### Guardar todos os arquivos para sempre

Contraria a necessidade de não poluir o histórico e aumenta custo operacional.

### Expor a CLI ao Hermes

Oferece capacidade, mas também filesystem e processo sem escopo. O contrato
estruturado preserva as operações da engine com isolamento.

### Manter Designer e Picture em paralelo

Contraria a substituição integral e prolonga dois contratos, duas UIs e duas
operações.

## Cutover

O cutover ocorre apenas após testes de engine, Artifact Server, banco, service,
Bridge e UI. Então:

1. a aba image passa a renderizar Picture-Hermes;
2. o Compose troca designer-api por picture-it;
3. variáveis antigas são removidas;
4. código do Designer API é excluído;
5. data/designer permanece intocado para retenção administrativa;
6. uma busca final prova que não há referência executável ao serviço antigo.

## Critérios arquiteturais de conclusão

- workspace persiste fora do Hermes e do navegador;
- um usuário não acessa workspace de outro;
- chat normal e Picture têm rotas e contratos distintos;
- todos os arquivos do painel vêm do manifest do Artifact Server;
- apenas clique humano aprova e reseta;
- peça promovida sobrevive à limpeza;
- worker se recupera de restart;
- nenhuma chamada paga ocorre na suíte padrão;
- apps/designer-api deixa de fazer parte do runtime.
