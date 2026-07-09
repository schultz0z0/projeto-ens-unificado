# Roadmap Nexus AI ENS

## Visao geral

O Nexus AI deve evoluir de um app com Hermes integrado para um sistema operacional de marketing da ENS.

A ideia central nao e ter apenas um chatbot, nem apenas um dashboard. O produto deve reunir planejamento, criacao, aprovacao, agenda, execucao, inteligencia e aprendizado em um unico ambiente.

O Hermes e o cerebro operacional. A interface e o cockpit. Os servicos internos do monorepo sao a camada de execucao.

## Modelo de interacao

O app deve manter uma area de conversa direta com o Hermes.

Essa area continua sendo o espaco livre para raciocinio, perguntas, analises, criacao, diagnosticos e comandos em linguagem natural.

Ao mesmo tempo, o app deve ter menus estruturados para as operacoes do dia a dia:

- campanhas;
- calendario;
- criativos;
- e-mail marketing;
- WhatsApp marketing;
- aprovacoes;
- dashboard;
- memoria validada;
- administracao.

Essas telas nao substituem o Hermes. Elas organizam o trabalho que o Hermes ajuda a criar, ler, editar e acompanhar.

Na pratica, o usuario pode trabalhar de dois jeitos:

1. Pelo chat, pedindo ao Hermes para criar, revisar, analisar ou atualizar coisas.
2. Pelas telas, navegando e editando campanhas, calendario, pecas e dashboards diretamente.

Os dois caminhos devem operar sobre os mesmos dados.

## Principios do produto

- O Hermes nao deve ser tratado como chatbot simples. Ele e o agente central de raciocinio, memoria, criacao, analise e operacao.
- O app deve ajudar o time a trabalhar melhor, nao apenas gerar textos ou imagens isoladas.
- O Hermes deve ter consciencia operacional do que acontece no app, respeitando permissoes, aprovacoes e auditoria.
- O usuario deve conseguir pedir ao Hermes para ler, criar, editar, resumir ou diagnosticar campanhas, itens de calendario, pecas, disparos, metricas e memorias.
- Toda automacao importante deve ser rastreavel, aprovada e reversivel quando necessario.
- O produto deve crescer como ambiente proprio da ENS, dentro do monorepo Nexus AI.
- Nao usaremos n8n como pilar de automacao. Quando uma automacao ou agente dedicado for necessario, criaremos um servico/container proprio no compose, seguindo o modelo de bridge, MCPs e demais servicos.
- O roadmap deve priorizar clareza operacional antes de complexidade tecnica.
- O que funcionar deve virar memoria reutilizavel para o Hermes.

## Produto-alvo

O produto-alvo e uma Central de Operacoes de Marketing ENS.

Ela deve permitir que o time:

- planeje campanhas por curso, produto, publico, canal e janela;
- gere estrategias e pecas com apoio do Hermes;
- organize disparos de e-mail marketing, WhatsApp marketing, conteudo e criativos;
- aprove materiais antes de uso;
- acompanhe status e performance;
- transforme aprendizados em memoria para campanhas futuras.

## Pilares

### 1. Hermes como copiloto operacional

O Hermes deve ser o ponto de partida para perguntas, planejamento e execucao assistida.

Exemplos:

- "Crie uma campanha para Graduação em Gestão de Seguros."
- "Monte uma regua de WhatsApp para fechamento de turma."
- "Analise por que essa campanha teve baixo retorno."
- "Transforme esse briefing em calendario de disparos."
- "Revise essa copy pelo tom de voz da ENS."

O resultado do Hermes nao deve ficar perdido no chat. Quando uma resposta gerar algo acionavel, ela deve poder virar campanha, tarefa, peca, calendario, insight ou memoria validada.

### 1.1 Hermes integrado aos dados do app

O Hermes deve conseguir operar sobre os dados reais do Nexus AI.

Isso pode ser feito por uma camada interna de ferramentas, MCPs ou servicos proprios do monorepo.

Capacidades desejadas:

- listar campanhas;
- ler detalhes de uma campanha;
- criar campanha a partir de briefing;
- atualizar status, objetivo, publico, canal e datas;
- criar itens no calendario;
- reagendar disparos;
- gerar e anexar copies;
- consultar pecas e criativos;
- enviar materiais para aprovacao;
- ler comentarios e decisoes;
- consultar metricas e funil;
- registrar aprendizados;
- salvar memoria validada;
- gerar resumos executivos.

O Hermes nao deve depender de "olhar a tela" para entender o app. Ele deve ter ferramentas internas para consultar e alterar dados de forma estruturada.

Para operacoes sensiveis, o Hermes deve pedir confirmacao ou passar por aprovacao:

- disparar mensagens;
- alterar campanha aprovada;
- arquivar campanha;
- remover dados;
- mudar configuracoes administrativas;
- aprovar material em nome de usuario humano.

Toda acao executada pelo Hermes deve ter rastro:

- quem pediu;
- o que foi alterado;
- quando aconteceu;
- qual ferramenta foi usada;
- estado anterior quando fizer sentido;
- estado novo.

### 1.2 Fila de aprovacao para acoes sensiveis

Quando o Hermes precisar executar uma acao sensivel, ele nao deve simplesmente executar direto.

Usuarios comuns podem pedir, construir e revisar a acao junto com o Hermes.

O Hermes deve ajudar o usuario comum a idealizar, estruturar, escrever, ajustar e validar a proposta antes de qualquer aprovacao superior.

Somente depois que o usuario comum validar a versao final da acao, o Hermes cria uma solicitacao de aprovacao para usuarios com role adequada, como `manager` ou `admin`.

Assim, a governanca nao bloqueia a criacao. Ela controla a execucao sensivel.

A solicitacao deve chegar para manager/admin como um pacote pronto para decisao.

O manager/admin nao deve precisar conversar com o Hermes para explicar o que fazer. A interface deve oferecer acoes diretas, como:

- aprovar;
- rejeitar;
- solicitar ajuste;
- cancelar.

Ao clicar em aprovar, o sistema deve acionar automaticamente o Hermes ou o servico responsavel para executar exatamente a tarefa ja preparada e validada.

Isso significa que a solicitacao precisa carregar todos os dados necessarios para execucao:

- acao pretendida;
- payload estruturado;
- conteudo final;
- campanha relacionada;
- publico ou segmento;
- canal;
- data e horario, quando houver;
- configuracoes de envio;
- justificativa;
- riscos;
- criterios de sucesso;
- estado validado pelo usuario solicitante.

Exemplos de solicitacoes:

- aprovar disparo de WhatsApp;
- aprovar disparo de e-mail;
- aprovar alteracao em campanha ja aprovada;
- aprovar arquivamento de campanha;
- aprovar publicacao de peca;
- aprovar uso de uma copy sensivel;
- aprovar alteracao em calendario oficial;
- aprovar criacao de automacao recorrente;
- aprovar envio para uma lista de contatos.

Essa solicitacao deve aparecer em um menu proprio de aprovacoes.

Campos desejados:

- titulo da acao;
- tipo de acao;
- campanha relacionada;
- solicitante;
- justificativa do Hermes;
- impacto esperado;
- dados que serao alterados;
- previa do conteudo, quando houver;
- riscos ou observacoes;
- payload pronto para execucao;
- versao validada pelo usuario solicitante;
- status;
- aprovador;
- data da decisao;
- comentario de aprovacao ou rejeicao.

Fluxo ideal:

1. Usuario comum pede algo ao Hermes.
2. Hermes identifica que a acao final sera sensivel.
3. Hermes ajuda o usuario a montar a proposta, conteudo, payload, calendario ou plano.
4. Usuario comum revisa e valida a versao final.
5. Hermes cria uma solicitacao de aprovacao ja pronta para execucao.
6. Manager ou admin revisa no menu de aprovacoes.
7. Manager ou admin clica em aprovar, rejeitar, solicitar ajuste ou cancelar.
8. Um worker interno detecta a decisao.
9. Se aprovado, o worker aciona automaticamente o Hermes ou servico responsavel para executar o pacote validado.
10. Se rejeitado, o Hermes registra o motivo, informa o usuario solicitante e pode sugerir alternativa.
11. Se ajuste for solicitado, o pacote volta para o usuario comum e Hermes trabalharem em nova versao.

Exemplo pratico:

1. Um usuario comum pede: "prepare um disparo de WhatsApp para a campanha de MBA".
2. Hermes gera a mensagem, revisa tom de voz, checa dados da campanha e monta o envio.
3. Usuario comum ajusta a copy e confirma que esta pronto.
4. Hermes salva um pacote pronto: mensagem final, campanha, segmento, canal, horario, justificativa e payload de execucao.
5. Manager/admin ve a previa, publico, campanha, data, risco e justificativa.
6. Manager/admin clica em aprovar.
7. Worker interno aciona Hermes ou o servico de disparo sem novo briefing.
8. Resultado fica registrado no historico da campanha.

Esse worker deve ser um servico proprio do monorepo, rodando em container no compose.

Ele pode funcionar como um scheduler ou processo recorrente interno:

- consulta aprovacoes pendentes de execucao;
- aciona Hermes ou o servico responsavel;
- registra resultado;
- atualiza status;
- notifica o usuario quando fizer sentido.

Estados sugeridos para uma aprovacao:

- pendente;
- aprovada;
- rejeitada;
- expirada;
- executando;
- executada;
- falhou;
- cancelada.

Essa fila vira a camada de governanca entre a inteligencia do Hermes e a operacao real do marketing.

### 2. Central de Campanhas

Uma campanha deve ser a unidade principal de trabalho.

Cada campanha pode ter:

- nome;
- objetivo;
- curso, produto ou iniciativa;
- publico;
- canal principal;
- canais secundarios;
- periodo;
- status;
- responsaveis;
- mensagens;
- criativos;
- calendario;
- performance;
- aprendizados.

Estados sugeridos:

- rascunho;
- planejada;
- em producao;
- em revisao;
- aprovada;
- agendada;
- em andamento;
- encerrada;
- arquivada.

### 3. Calendario de Disparos

O calendario deve funcionar como a visao operacional do marketing.

Ele deve organizar:

- e-mails;
- WhatsApps;
- posts;
- criativos;
- lembretes comerciais;
- datas de fechamento;
- revisoes;
- tarefas internas.

Visoes desejadas:

- mensal;
- semanal;
- lista;
- por campanha;
- por canal;
- por responsavel;
- por status.

O calendario nao precisa comecar disparando automaticamente. Primeiro ele deve organizar a operacao. Depois pode evoluir para agendamento e execucao assistida.

### 4. Esteira de criacao e aprovacao

Tudo que for gerado pelo Hermes ou por ferramentas criativas deve poder entrar em uma esteira.

Fluxo sugerido:

1. Briefing
2. Geracao
3. Revisao
4. Ajustes
5. Aprovacao
6. Agendamento
7. Execucao
8. Analise
9. Memoria

Essa esteira e importante para evitar:

- campanha sem revisao;
- copy desalinhada ao tom institucional;
- promessa comercial nao aprovada;
- dado de curso inventado;
- peca perdida em conversas antigas;
- retrabalho entre marketing, produto e comercial.

### 5. Dashboard de performance

O dashboard deve responder menos "quantos numeros temos?" e mais "o que precisamos fazer agora?".

Indicadores possiveis:

- leads;
- leads qualificados;
- taxa de resposta;
- taxa de conversao;
- matriculas;
- custo por lead;
- custo por matricula;
- receita atribuida;
- status por campanha;
- performance por canal;
- performance por curso;
- gargalos por etapa.

O Hermes deve interpretar os dados e gerar recomendacoes:

- campanha precisa de novo angulo;
- WhatsApp performou melhor que e-mail;
- urgencia esta fraca;
- CTA esta confuso;
- falta peca para etapa final;
- campanha sem aprendizado registrado.

### 6. Memoria e inteligencia institucional

O aprendizado operacional deve alimentar o Hermes.

Tipos de memoria:

- copies aprovadas;
- campanhas bem-sucedidas;
- campanhas que nao funcionaram;
- objeções frequentes;
- argumentos por curso;
- tom de voz aprovado;
- decisoes de marketing;
- padroes de funil;
- insights de performance;
- restricoes legais ou institucionais;
- boas praticas por canal.

Essa memoria deve ajudar o Hermes a melhorar com o tempo e reduzir repeticao de briefing.

### 7. Agentes e automacoes internas

Quando uma rotina precisar rodar de forma recorrente, o caminho preferido e criar um agente ou servico interno no monorepo.

Exemplos de futuros servicos:

- agente de agenda de campanhas;
- agente de revisao de copy;
- agente de analise de performance;
- agente de lembretes e pendencias;
- worker de disparos;
- worker de integracao com provedores de e-mail;
- worker de integracao com WhatsApp;
- servico de coleta de metricas;
- servico de relatorios periodicos.

Esses servicos devem viver como containers separados no compose, seguindo o padrao do ambiente Nexus AI.

## Roadmap por fases

### Fase 0: Saneamento e definicao de base

Objetivo: separar o que e produto atual do que e residuo historico.

Entregas:

- mapear telas e modulos que realmente continuam;
- listar codigo legado a remover futuramente;
- listar tabelas, buckets, funcoes e policies antigas no Supabase;
- definir nomes oficiais dos modulos;
- definir papel de cada servico do monorepo.

Resultado esperado:

Um app mais compreensivel e uma base mais facil de evoluir.

### Fase 1: Central de Campanhas

Objetivo: criar a estrutura principal de gestao de campanhas.

Entregas:

- cadastro de campanha;
- lista de campanhas;
- status de campanha;
- vinculo com curso, produto ou iniciativa;
- responsavel;
- periodo;
- objetivo;
- canal principal;
- notas e briefing;
- area para itens gerados pelo Hermes.

Resultado esperado:

O time passa a organizar campanhas dentro do Nexus AI.

### Fase 2: Calendario Operacional

Objetivo: transformar campanhas em agenda visual de execucao.

Entregas:

- calendario mensal;
- visao semanal;
- visao em lista;
- cards de disparos e tarefas;
- filtros por canal, campanha e status;
- datas importantes;
- itens de e-mail, WhatsApp, post, criativo e revisao.

Resultado esperado:

O app vira referencia diaria para saber o que vai sair, o que esta pendente e o que precisa de aprovacao.

### Fase 3: Hermes Campaign Builder

Objetivo: permitir que o Hermes transforme briefing em plano acionavel.

Entregas:

- criar campanha a partir do chat;
- gerar calendario sugerido;
- gerar sequencia de e-mails;
- gerar sequencia de WhatsApp;
- gerar ideias de criativos;
- gerar checklist de campanha;
- revisar tom de voz;
- registrar recomendacoes no workspace da campanha.

Resultado esperado:

O Hermes deixa de responder apenas em conversa e passa a construir objetos reais dentro do app.

### Fase 4: Esteira de aprovacao

Objetivo: criar governanca para materiais e decisoes.

Entregas:

- status de peca;
- comentarios;
- historico de versoes;
- aprovacao por responsavel;
- rejeicao com motivo;
- comparacao entre versoes;
- registro de quem aprovou e quando.

Resultado esperado:

O time ganha controle editorial e institucional sem perder velocidade.

### Fase 5: Execucao assistida

Objetivo: preparar o caminho para disparos e rotinas automatizadas.

Entregas:

- marcar item como pronto para disparo;
- criar fila de execucao;
- registrar payloads de envio;
- criar worker interno para processar envios;
- integrar provedores de e-mail quando definido;
- integrar provedor de WhatsApp quando definido;
- manter aprovacao humana antes de disparos sensiveis.

Resultado esperado:

O Nexus AI passa de planejamento para operacao real, mantendo controle e rastreabilidade.

### Fase 6: Dashboard e diagnostico

Objetivo: conectar execucao com leitura de resultado.

Entregas:

- painel por campanha;
- painel por canal;
- painel por curso;
- funil basico;
- comparativo entre campanhas;
- recomendacoes do Hermes;
- registro de aprendizados.

Resultado esperado:

O app nao apenas mostra numeros. Ele orienta decisoes.

### Fase 7: Hermes proativo

Objetivo: fazer o sistema alertar e sugerir antes que o usuario precise perguntar.

Entregas:

- alertas de campanha sem proximo passo;
- alerta de fechamento de turma;
- alerta de peca pendente;
- alerta de campanha sem revisao;
- sugestoes semanais de otimizacao;
- resumo diario ou semanal;
- agente de acompanhamento de calendario.

Resultado esperado:

O Nexus AI vira um parceiro operacional continuo do marketing.

## Modulos desejados

### Home / Chat Hermes

Entrada principal para raciocinio, criacao, analise e comandos.

### Campanhas

Gestao de campanhas, briefing, status, materiais e aprendizados.

### Calendario

Agenda de disparos, tarefas e revisoes.

### Criativos

Geracao e organizacao de pecas visuais.

### E-mail Marketing

Criacao, revisao e futura execucao de e-mails.

### WhatsApp Marketing

Criacao, revisao e futura execucao de mensagens e reguas.

### Aprovacoes

Fila de materiais pendentes de revisao.

### Dashboard

Performance, funil, diagnosticos e recomendacoes.

### Memoria Validada

Base de conhecimento operacional que o Hermes consulta e melhora com o tempo.

### Admin

Usuarios, permissoes, configuracoes e governanca.

## Limpeza futura

Como o repositorio tem historico de experimentos, sera importante criar uma fase especifica de limpeza.

Alvos:

- telas descartadas;
- componentes antigos;
- rotas nao usadas;
- migrations obsoletas;
- tabelas antigas no Supabase;
- buckets nao utilizados;
- edge functions antigas;
- scripts de teste soltos;
- documentos historicos que confundem a direcao atual.

Essa limpeza deve ser feita com cuidado, porque o monorepo representa o ambiente Nexus AI completo da ENS.

## Nao objetivos por enquanto

Neste momento, nao priorizar:

- automacao externa via n8n;
- disparo automatico sem aprovacao;
- dashboard complexo antes de ter campanhas organizadas;
- market intelligence avancado antes da central operacional estar solida;
- refatoracao tecnica grande antes de definir o produto-alvo;
- multiplos canais profundamente integrados ao mesmo tempo.

## Prioridade recomendada

A melhor ordem inicial e:

1. Central de Campanhas
2. Calendario Operacional
3. Hermes Campaign Builder
4. Aprovacoes
5. Execucao assistida
6. Dashboard
7. Hermes proativo

Essa ordem cria valor rapido sem depender de integracoes complexas logo no inicio.

## Norte do produto

O Nexus AI deve se tornar o lugar onde o marketing da ENS pensa, planeja, produz, aprova, executa e aprende.

Se uma campanha nasce fora do Nexus AI, ela deve poder entrar nele.

Se uma campanha nasce no Hermes, ela deve virar operacao.

Se uma campanha performa bem, ela deve virar memoria.

Se uma campanha performa mal, ela deve virar aprendizado.
