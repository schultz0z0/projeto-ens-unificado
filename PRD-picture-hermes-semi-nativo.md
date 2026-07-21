# PRD: Picture-Hermes — geração visual persistente e substituição do Designer API

**Status:** desenho aprovado para implementação
**Data:** 21 de julho de 2026
**Iniciativa:** independente do roadmap faseado do Nexus/Hermes
**Escopo de substituição:** 100% do apps/designer-api e da experiência atual de formulário

## 1. Resumo executivo

Este documento define a implementação do **Picture-Hermes**, uma experiência
dedicada de geração de peças visuais dentro do projeto ENS. O Picture-Hermes
substitui integralmente o Designer API atual na página **Geração de imagem**.

A nova experiência será um chat simples:

- à esquerda, o usuário conversa com o Hermes em um modo exclusivo do Picture;
- à direita, o usuário acompanha a “pasta do trabalho”, com briefing, prompts,
  JSONs, referências, imagens intermediárias e a peça final;
- o workspace permanece íntegro ao recarregar a página, navegar para outra área
  ou reiniciar/recriar a sessão interna do Hermes;
- apenas a ação explícita **Criar nova peça**, após aprovação e confirmação,
  elimina o chat e os artefatos temporários;
- a peça final aprovada permanece em **Trabalhos Validados**.

O chat normal do Hermes não muda: pedidos de imagem feitos nele continuam
usando a ferramenta nativa image_generate, sem acionar o Picture.

## 2. Decisões aprovadas

As decisões abaixo são requisitos fixos desta implementação:

1. O Designer API será eliminado e substituído pelo Picture.
2. A página Geração de imagem deixa de ser um formulário e passa a ser um chat
   dedicado ao Picture-Hermes.
3. O chat normal continua usando o gerador nativo do Hermes.
4. O Picture-Hermes terá um workspace persistente por usuário.
5. Recarregar a página ou resetar/recriar o Hermes não apaga o workspace.
6. A limpeza só acontece após clique explícito em **Criar nova peça**.
7. O usuário precisa aprovar uma peça final antes de criar outra.
8. A confirmação informa claramente o que será apagado e preservado.
9. Apenas a peça final e seus metadados mínimos permanecem em Trabalhos
   Validados; chat, briefing, JSONs, referências e intermediários são apagados.
10. O Artifact Server pode e deve evoluir para persistência, preview, promoção
    e limpeza dos arquivos de workspace.
11. Esta implementação é autônoma e não altera as fases nem a sequência do
    Roadmap.md.

## 3. Contexto técnico

### 3.1 Estado atual do produto

A página atual renderiza ImageGenerator.tsx, um formulário acoplado aos
endpoints do apps/designer-api. O serviço atual recebe opções do formulário,
cria jobs, gera peças com templates e modelos externos, mantém saídas próprias
e oferece preview, ajuste e download.

Essa arquitetura será retirada do produto, do frontend e do Docker Compose.
Dados antigos em data/designer não serão apagados automaticamente pela
migração; sua eventual remoção será uma operação administrativa separada.

### 3.2 Capacidade real do picture-it

O repositório picture-it-main oferece uma engine visual capaz de:

- gerar e editar imagens por FAL;
- remover e substituir fundos;
- recortar, ampliar, colorir, aplicar grão e vinheta;
- compor imagens e assets com Sharp;
- renderizar tipografia determinística com Satori;
- trabalhar com zonas, shapes, gradientes, máscaras e profundidade;
- executar pipelines declarativos em JSON.

A pasta graduação-test demonstra o nível de controle desejado: um pacote
contendo prompt.txt, steps.json, overlays.json, text-only.json, assets de marca
e renders. Esse exemplo foi montado manualmente e comprova a capacidade de
execução e composição do Picture.

Ele não comprova, por si só, uma automação completa de briefing para layout.
O Picture atual é uma CLI/engine, não um planner de campanha. Por isso, a
arquitetura mantém o Hermes como planejador e transforma o Picture em um
executor seguro, persistente e observável.

### 3.3 Lacunas da engine importada

Antes de atender ao produto, o Picture precisa ganhar:

- API de serviço e MCP de alto nível;
- contratos CreativeBrief e CompositionPlan;
- jobs persistentes e recuperáveis;
- workspace isolado por usuário;
- controle de acesso e delegação curta entre Bridge, Hermes e Picture;
- armazenamento e preview dos artefatos;
- aprovação e promoção da peça final;
- testes automatizados;
- Docker e operação integrada ao monorepo.

Também existem erros de TypeScript no código importado que precisam ser
corrigidos antes da integração.

## 4. Objetivo do produto

Permitir que uma pessoa peça, refine e aprove uma peça visual conversando com o
Hermes, enquanto acompanha os arquivos técnicos produzidos pelo Picture, sem
precisar manipular comandos ou JSONs manualmente.

## 5. Metas

- Entregar a capacidade completa de geração, edição e composição do Picture.
- Permitir briefings livres e revisões conversacionais.
- Manter o processo visual transparente por meio da pasta do trabalho.
- Preservar trabalho em andamento entre recargas e reinícios do Hermes.
- Manter apenas peças aprovadas no histórico definitivo.
- Garantir isolamento entre usuários e workspaces.
- Remover toda dependência de execução do Designer API.
- Preservar o gerador nativo do chat normal.

## 6. Não objetivos

- Transformar a interface em um Photoshop manual.
- Permitir edição direta dos JSONs pelo usuário final no MVP.
- Expor a CLI ou o filesystem bruto do Picture ao Hermes.
- Guardar permanentemente todos os intermediários.
- Misturar sessões Picture no histórico do chat normal.
- Migrar automaticamente jobs históricos do Designer API.
- Alterar o roadmap de Marketing Ops ou suas fases.
- Criar múltiplos workspaces ativos para o mesmo usuário no MVP.

## 7. Usuários

### 7.1 Usuário de marketing

Conversa com o Hermes, fornece briefing e referências, acompanha a geração,
pede revisões, aprova a peça e inicia um novo trabalho.

### 7.2 Gestor

Consulta peças visuais em Trabalhos Validados juntamente com os outros
artefatos aprovados.

### 7.3 Operação técnica

Configura modelos, chaves, limites, brand profiles, filas, observabilidade e
retenção.

## 8. Experiência da página

### 8.1 Estrutura

A aba **Geração de imagem** terá duas regiões:

~~~text
┌──────────────────────────────────┬─────────────────────────────┐
│ Chat Picture-Hermes              │ Arquivos do trabalho        │
│                                  │                             │
│ conversa                         │ Briefing                    │
│ perguntas                        │ Referências                 │
│ respostas                        │ Planejamento / JSONs         │
│ status                           │ Intermediários               │
│                                  │ Peça final                  │
│ anexos + campo de mensagem       │ preview do arquivo escolhido│
└──────────────────────────────────┴─────────────────────────────┘
~~~

Em desktop, o chat fica à esquerda e os arquivos à direita. Em telas menores,
os arquivos podem abrir em painel ou drawer, mantendo o chat como área
principal.

### 8.2 Simplicidade visual

A interface não replica o formulário antigo. Seus controles principais são:

- campo de mensagem;
- anexar referência;
- enviar;
- status da geração;
- aprovar peça;
- criar nova peça;
- árvore ou lista de arquivos;
- preview e download do arquivo selecionado.

### 8.3 Organização dos arquivos

O painel direito agrupa os artefatos por função:

- **Briefing:** brief.json, resumo e requisitos;
- **Referências:** imagens e arquivos enviados pelo usuário;
- **Planejamento:** prompt.txt, composition-plan.json, steps.json,
  overlays.json e arquivos equivalentes;
- **Intermediários:** bases geradas, recortes, composições e revisões;
- **Peça final:** candidata atual e, após aprovação, indicação de validada.

O usuário visualiza JSON e texto em preview legível, e imagens em preview
visual. Os caminhos apresentados são relativos ao workspace; caminhos físicos
do host nunca são expostos.

## 9. Persistência e ciclo de vida

### 9.1 Regra principal

O workspace pertence ao usuário e é persistido no backend. Ele não pertence ao
estado React, à aba do navegador nem à sessão efêmera do Hermes.

### 9.2 Eventos que não apagam o workspace

- recarregar a página;
- fechar e reabrir o navegador;
- navegar entre abas do produto;
- desconectar e autenticar novamente;
- reiniciar o container do frontend;
- reiniciar, resetar ou recriar a sessão interna do Hermes;
- reiniciar o Picture durante um job.

Ao retornar, o sistema recupera o workspace ativo, o chat persistido, o job
corrente e a lista de arquivos.

### 9.3 Estados do workspace

~~~text
drafting -> generating -> review -> validated -> resetting -> closed
                  \-> failed -> drafting/review
~~~

- drafting: briefing e conversa em andamento;
- generating: job do Picture em execução;
- review: existe uma candidata final para avaliação;
- validated: a candidata foi aprovada e promovida;
- resetting: limpeza idempotente em andamento;
- closed: workspace encerrado;
- failed: último job falhou, sem destruir o trabalho anterior.

### 9.4 Aprovação

O botão **Aprovar peça**:

1. verifica que existe uma candidata final concluída;
2. promove esse artefato de temporário para validado no Artifact Server;
3. cria um registro peca_visual em validated_works;
4. relaciona o registro ao workspace;
5. altera o workspace para validated.

A operação deve ser idempotente: repetir a mesma requisição não duplica o
trabalho validado.

### 9.5 Criar nova peça

O botão só fica habilitado após aprovação. Ao clicar, aparece:

> **Criar uma nova peça?**
>
> O chat, briefing, arquivos auxiliares, JSONs e versões intermediárias deste
> trabalho serão apagados permanentemente. A peça final aprovada continuará
> disponível em Trabalhos Validados.

Depois da confirmação:

1. o backend confirma que há uma peça validada;
2. preserva o artefato promovido;
3. apaga em lote os demais artefatos do workspace;
4. apaga mensagens e estado Hermes ligados à sessão Picture;
5. fecha o workspace;
6. cria uma sessão Picture e um workspace vazios.

O processo é idempotente e recuperável caso uma etapa intermediária falhe.

## 10. Separação entre os dois chats

### 10.1 Chat normal

- mantém o comportamento atual;
- continua usando intent image_generate;
- continua instruindo o Hermes a chamar image_generate;
- nunca recebe automaticamente o skill ou o contrato do Picture.

### 10.2 Chat Picture-Hermes

- usa uma sessão marcada como picture;
- não aparece no histórico de conversas normais;
- recebe instrução de modo Picture em todos os turnos;
- recebe o workspace_id ativo e uma delegação de curta duração;
- usa apenas as tools MCP do Picture para operações visuais;
- pode continuar após recriação da sessão Hermes porque o workspace é externo.

## 11. Arquitetura alvo

~~~text
Frontend
  ├─ Chat normal ───────────────> Chat Bridge ─> Hermes ─> image_generate
  └─ Página Picture-Hermes
       ├─ chat ─────────────────> Chat Bridge ─> Hermes ─> MCP Picture
       └─ arquivos/aprovação ───> Chat Bridge ─> Picture Service
                                                      │
                                                      ├─ Job Worker
                                                      ├─ picture-it engine
                                                      ├─ Supabase/Postgres
                                                      └─ Artifact Server
~~~

### 11.1 Frontend

Responsável por recuperar ou criar o workspace ativo, renderizar o chat
dedicado, acompanhar status e manifest, apresentar previews, solicitar
aprovação, exibir a confirmação de nova peça e mostrar peças visuais em
Trabalhos Validados.

### 11.2 Chat Bridge

É o BFF autenticado da experiência Picture:

- valida o JWT Supabase do usuário;
- garante propriedade da sessão e do workspace;
- separa sessão normal de sessão Picture;
- emite delegação técnica de curta duração;
- injeta o contrato Picture sem persistir segredos no chat;
- encaminha endpoints de workspace;
- assina URLs de preview pelo Artifact Server;
- recria a sessão Hermes sem recriar o workspace;
- orquestra a limpeza de sessão ao criar nova peça.

### 11.3 Hermes

É o planejador visual:

- interpreta o briefing;
- pergunta o que estiver faltando;
- consulta contexto institucional quando necessário;
- produz CreativeBrief e CompositionPlan;
- escolhe operações suportadas pelo Picture;
- inicia jobs e interpreta erros;
- conduz revisões em linguagem natural.

O Hermes não recebe acesso ao filesystem e não executa comandos CLI.

### 11.4 Picture Service

É um serviço Bun independente, importado de picture-it-main e evoluído para:

- validar contratos;
- persistir workspaces e jobs;
- materializar arquivos em diretório isolado;
- executar a engine Picture como biblioteca;
- publicar cada artefato relevante no Artifact Server;
- oferecer REST interno e MCP;
- recuperar jobs interrompidos;
- registrar duração, modelo e custo.

### 11.5 Artifact Server

Passa a ser a fonte persistente dos arquivos visíveis. Além do comportamento
atual, oferecerá:

- metadados de workspace_id e relative_path;
- tipo e categoria do arquivo;
- ciclo de vida workspace ou validated;
- listagem por workspace e proprietário;
- promoção idempotente de uma peça final;
- exclusão em lote apenas dos temporários;
- URLs assinadas para preview e download;
- deduplicação de bytes já existente.

O diretório local usado pelo worker é transitório e reconstruível a partir dos
artefatos persistidos.

### 11.6 Supabase/Postgres

Mantém a classificação das sessões, workspace ativo, jobs e leases, ligação
com o artefato final, ligação com validated_works e isolamento por
usuário/tenant.

## 12. Contratos de domínio

### 12.1 CreativeBrief

~~~json
{
  "title": "Graduação — Gestão Financeira",
  "campaign_type": "graduacao",
  "channel": "whatsapp",
  "objective": "captacao",
  "audience": "adultos buscando diploma superior",
  "offer": "Gestão Financeira",
  "copy_points": [
    "alta taxa de empregabilidade",
    "diploma superior em 2 anos"
  ],
  "cta": "Matricule-se",
  "visual_style": "institucional, clean, premium",
  "brand_profile": "ens_graduacoes",
  "output": {
    "width": 1080,
    "height": 1080,
    "format": "png"
  }
}
~~~

### 12.2 CompositionPlan

~~~json
{
  "version": 1,
  "base_prompt": "Fotografia publicitária institucional...",
  "pipeline": [
    {
      "op": "generate",
      "model": "banana-pro",
      "size": "1080x1080"
    },
    {
      "op": "grade",
      "name": "warm-editorial"
    },
    {
      "op": "compose",
      "overlays_file": "planning/overlays.json"
    }
  ],
  "final_path": "final/peca-final.png"
}
~~~

O contrato cobre toda a união de operações da engine Picture, com validação
estrita e sem aceitar caminhos absolutos.

### 12.3 ManifestEntry

~~~json
{
  "artifact_id": "uuid",
  "workspace_id": "uuid",
  "relative_path": "planning/steps.json",
  "category": "planning",
  "content_type": "application/json",
  "size": 961,
  "lifecycle": "workspace",
  "preview_url": "https://...",
  "preview_url_expires_at": "2026-07-21T20:00:00Z",
  "created_at": "2026-07-21T19:45:00Z"
}
~~~

## 13. Superfície MCP

O MCP deve ser pequeno, mas permitir o controle completo da engine por contrato
estruturado.

### 13.1 picture_get_workspace

Retorna estado, brief atual, job corrente, candidata final e manifest resumido.

### 13.2 picture_start_job

Recebe token de delegação, workspace_id, CreativeBrief, CompositionPlan,
referências já registradas e chave idempotente. Persiste o pacote, enfileira a
execução e retorna job_id.

### 13.3 picture_revise

Recebe pedido de revisão e um plano atualizado ou patch controlado. Cria nova
execução sem destruir a candidata anterior antes do sucesso.

### 13.4 picture_get_job

Retorna status, progresso, erro estruturado e artefatos produzidos.

Aprovação e criação de nova peça não ficam disponíveis ao modelo; são ações
explícitas do usuário na interface.

## 14. Jobs e recuperação

Os jobs são assíncronos e persistidos antes de começar. Cada job possui:

- status queued, running, succeeded, failed ou cancelled;
- lease com expiração;
- contador de tentativas;
- specification imutável;
- timestamps;
- modelo e custo estimado ou real;
- erro seguro;
- artefato final, quando houver.

O worker reivindica jobs com exclusão concorrente. Se o serviço reiniciar,
leases expirados voltam à fila até o limite de tentativas. Um job em falha não
remove a última peça candidata válida.

O frontend consulta o estado periodicamente durante queued e running, e
atualiza manifest e preview ao término.

## 15. Requisitos funcionais

### RF-01 — Recuperar workspace ativo

Ao abrir a página, recuperar o único workspace ativo do usuário ou criar um
vazio de forma idempotente.

### RF-02 — Persistir chat Picture

Mensagens Picture usam as tabelas de chat existentes, em sessão separada e
filtrada do histórico normal.

### RF-03 — Receber briefing livre

O Hermes deve conversar naturalmente, fazer perguntas e transformar o pedido
em contratos estruturados.

### RF-04 — Receber referências

Anexos do chat Picture são copiados ou registrados no workspace antes da
execução e aparecem em Referências.

### RF-05 — Gerar pacote técnico

Cada geração deve produzir e persistir os artefatos necessários para explicar
e reproduzir a execução.

### RF-06 — Executar capacidade total

O contrato cobre generate, edit, remove e replace background, crop, grade,
grain, vignette, text, compose, upscale e demais operações suportadas pela
engine importada.

### RF-07 — Mostrar manifest

O painel direito lista arquivos por categoria, com estado vazio, carregamento,
erro, preview e download.

### RF-08 — Revisar

Pedidos de alteração criam uma nova execução relacionada ao mesmo workspace.

### RF-09 — Aprovar explicitamente

Somente clique do usuário promove a candidata atual para peça validada.

### RF-10 — Criar nova peça

A ação exige estado validado, confirmação e limpeza do material temporário.

### RF-11 — Preservar peça final

A peça promovida continua acessível em Trabalhos Validados depois da limpeza.

### RF-12 — Recuperar após reset do Hermes

A Bridge recria a sessão Hermes, reapresenta o contexto do workspace e mantém o
mesmo workspace_id.

### RF-13 — Trabalhos Validados visuais

A página existente passa a filtrar e renderizar peca_visual, com thumbnail,
preview ampliado, download e metadados.

### RF-14 — Isolar chat normal

O chat normal não recebe modo, tools obrigatórias ou workspace Picture.

## 16. Requisitos não funcionais

### RNF-01 — Segurança

- nenhum path absoluto vindo do modelo;
- resolução de caminhos confinada ao diretório materializado;
- delegações curtas, assinadas e limitadas a usuário e workspace;
- Artifact Server acessível internamente para mutações;
- previews públicos apenas por URL assinada;
- chaves FAL somente no Picture Service;
- tokens técnicos removidos antes de persistência e logs.

### RNF-02 — Persistência

Recarregar página ou reiniciar serviços não pode apagar workspaces e jobs
registrados.

### RNF-03 — Concorrência

Um workspace ativo por usuário no MVP, com jobs serializados por workspace e
concorrência global configurável.

### RNF-04 — Idempotência

Criar workspace, iniciar job, aprovar e criar nova peça aceitam chave
idempotente ou possuem chave natural equivalente.

### RNF-05 — Observabilidade

Registrar workspace_id, job_id, user_id, tenant_id, correlation id, operação,
modelo, duração, tentativas, custo e falha, sem conteúdo sensível ou tokens.

### RNF-06 — Performance

Listagem de arquivos não baixa bytes. Previews usam URLs assinadas e polling
somente enquanto necessário.

### RNF-07 — Testabilidade

Engine, worker, contratos, lifecycle do Artifact Server, Bridge e UI possuem
testes sem consumo de créditos. Smoke tests reais com FAL são opt-in.

### RNF-08 — Operação

Health e readiness diferenciam processo vivo de dependências prontas. A
readiness falha se banco, Artifact Server ou configuração obrigatória estiverem
indisponíveis.

## 17. Modelo de dados

### 17.1 chat_sessions

Adicionar session_kind:

- normal por padrão;
- picture para a página dedicada.

Todas as consultas do chat normal filtram normal.

### 17.2 picture_workspaces

Campos mínimos:

- id;
- tenant_id;
- user_id;
- chat_session_id;
- status;
- active;
- current_job_id;
- candidate_artifact_id;
- validated_artifact_id;
- validated_work_id;
- title;
- created_at, updated_at e closed_at.

Uma restrição parcial garante um único workspace ativo por usuário e tenant.

### 17.3 picture_jobs

Campos mínimos:

- id e workspace_id;
- kind e status;
- idempotency_key;
- specification;
- progress;
- attempt_count e max_attempts;
- lease_owner e lease_expires_at;
- result_artifact_id;
- model_info e cost_info;
- error_code e error_message;
- timestamps.

### 17.4 validated_works

Adicionar:

- tipo peca_visual;
- artifact_id;
- artifact_filename;
- artifact_mime_type;
- artifact_width;
- artifact_height.

Para peças visuais, artifact_id é obrigatório. O campo content guarda somente
uma descrição curta e pesquisável, não os arquivos do workspace.

## 18. Segurança e autorização

### 18.1 Frontend para Bridge

Usa JWT Supabase do usuário, como o chat atual.

### 18.2 Bridge para Picture

Usa autenticação interna e contexto verificado do usuário.

### 18.3 Hermes para MCP Picture

A Bridge emite uma delegação curta contendo subject/user id, tenant id, role,
chat session id, workspace id, run id, scopes workspace:read e job:write,
expiração e jti.

O token é injetado em bloco técnico, removido de mensagens persistidas e
validado em toda tool. O Picture rejeita workspace diferente do claim.

### 18.4 Artifact Server

Mutações exigem chave interna. A Bridge só assina acesso se o proprietário do
artefato for o usuário autenticado.

## 19. Tratamento de erros

- Falta de dados no briefing: Hermes pergunta, sem criar job.
- Payload inválido: MCP retorna campos e códigos seguros.
- Modelo indisponível: job falha e pode ser reenfileirado.
- Falha em uma revisão: candidata anterior permanece.
- Hermes reiniciado: Bridge recria sessão e conserva workspace e job.
- Picture reiniciado: worker recupera jobs com lease expirado.
- Artifact Server indisponível: job não conclui antes de publicar artefatos.
- Aprovação repetida: retorna o mesmo validated_work_id.
- Reset repetido: recupera a limpeza sem apagar a peça promovida.

## 20. Observabilidade

Eventos mínimos:

- picture.workspace.created;
- picture.job.queued;
- picture.job.started;
- picture.artifact.published;
- picture.job.succeeded;
- picture.job.failed;
- picture.piece.validated;
- picture.workspace.reset_started;
- picture.workspace.reset_completed.

Métricas mínimas:

- jobs por status;
- duração por operação e modelo;
- tentativas;
- bytes e quantidade de artefatos;
- custo estimado;
- falhas por código;
- tempo entre geração e aprovação.

## 21. Substituição do Designer API

A conclusão exige:

- remover ImageGenerator.tsx;
- remover useImageGenerator.ts;
- remover imageGeneratorService.ts;
- remover o serviço designer-api dos Compose;
- remover dependências e variáveis VITE_IMAGE_GENERATOR e NEXUS_DESIGNER;
- excluir apps/designer-api do repositório após o cutover;
- substituir dependências do frontend e da Bridge;
- validar que nenhuma referência executável ao Designer permanece.

A migração não apaga automaticamente data/designer, buckets ou outputs antigos.
A remoção desses dados será deliberada, após aceite do novo fluxo.

## 22. Estratégia de entrega

Embora o plano técnico seja dividido em checkpoints testáveis, esta iniciativa
é independente do roadmap existente e será implementada como uma única frente:

1. importar e estabilizar a engine;
2. evoluir Artifact Server;
3. criar esquema persistente;
4. construir Picture Service, worker e MCP;
5. integrar Hermes e Bridge;
6. substituir a interface;
7. integrar Trabalhos Validados;
8. remover Designer API;
9. validar ponta a ponta e preparar cutover.

## 23. Critérios de aceite

1. A aba Geração de imagem apresenta chat à esquerda e arquivos à direita.
2. Um briefing conversacional gera uma peça usando o Picture.
3. Brief, prompt, plano, JSONs, referências e intermediários aparecem no painel.
4. Recarregar a página recupera chat, workspace, status e arquivos.
5. Recriar ou resetar o Hermes não perde o workspace.
6. Reiniciar Picture durante job não perde o job definitivamente.
7. O usuário consegue pedir revisão no mesmo chat.
8. Aprovar preserva a candidata como peca_visual.
9. Criar nova peça exige aprovação e confirmação.
10. Confirmar apaga chat e temporários, preservando a final.
11. A peça final abre e baixa em Trabalhos Validados.
12. Sessões Picture não aparecem no histórico do chat normal.
13. O chat normal continua usando image_generate.
14. Não existe rota, serviço ou dependência ativa do Designer API.
15. Testes automatizados passam sem chamadas pagas.
16. Um smoke test real pode ser executado explicitamente com FAL configurada.

## 24. Fora do roadmap

Este PRD e seu plano técnico não adicionam fase, marco ou dependência ao
Roadmap.md. A implementação possui branch, documentação, commits e aceite
próprios. Qualquer integração futura com Marketing Ops será decisão posterior.

## 25. Resultado esperado

O Picture-Hermes transforma a atual geração por formulário em uma estação
visual conversacional simples. O Hermes planeja, o Picture executa com controle
determinístico, o Artifact Server torna o processo visível e persistente, e o
usuário decide explicitamente quando a peça está pronta e quando o workspace
pode ser descartado.
