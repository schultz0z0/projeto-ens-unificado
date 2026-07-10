# Glossário operacional

## Termos de produto

| Termo | Definição contratual |
|---|---|
| Campanha | Contêiner de objetivo, audiência, período, canais, responsáveis e itens. Não é sinônimo de campanha de mídia de um provedor externo. |
| Item | Unidade planejável e rastreável dentro de uma campanha, como post, e-mail, landing page, anúncio ou tarefa. |
| Conteúdo | Material textual, visual ou estrutural associado a um item. |
| Versão | Snapshot imutável do conteúdo e metadados submetidos a revisão. Toda aprovação referencia uma versão exata. |
| Pacote | Conjunto versionado de payloads/artefatos preparado para uma operação ou canal específico. |
| Canal | Destino operacional, por exemplo e-mail, site, Meta ou publicação orgânica. |
| Execução | Tentativa idempotente de aplicar um pacote autorizado em um canal, com status e recibo técnico. |
| Resultado | Resposta observada do provedor/worker para uma execução; não é presumida a partir da intenção. |
| Métrica | Observação quantitativa com fonte, dimensão e janela temporal explícitas. |
| Aprendizado | Insight validado derivado de evidência; pode ser promovido ao Graph/RAG conforme governança. |

## Aprovações e autoridade

| Termo | Definição | Fonte de verdade |
|---|---|---|
| Aprovação técnica | Permissão de curta duração para o Hermes executar uma ferramenta/comando potencialmente sensível no runtime. | Hermes/Chat Bridge |
| Aprovação editorial | Decisão humana de que uma versão de conteúdo está adequada para o negócio. | Marketing Ops |
| Autorização operacional | Permissão humana/sistêmica explícita para executar/publicar um pacote aprovado em canal e escopo definidos. | Marketing Ops |
| Aprovador | Ator com papel e scope válidos que registra uma decisão; o nome exibido não substitui a identidade autenticada. | Supabase/Marketing Ops |
| Delegação | Token/credencial assinada e curta que permite ao Hermes chamar ferramentas em nome de um ator, tenant e scopes específicos. | Serviço emissor confiável |
| Scope | Conjunto mínimo de ações permitidas, por exemplo `campaign:read` ou `execution:request`; nunca é inferido apenas pelo prompt. | Marketing Ops/auth |

Aprovação técnica, aprovação editorial e autorização operacional são decisões independentes. Uma não implica nenhuma das outras.

## Identidade e isolamento

| Termo | Definição |
|---|---|
| Ator | Identidade autenticada que inicia ou aprova uma ação: usuário, serviço ou worker. |
| Tenant | Fronteira lógica de dados, políticas e auditoria de uma organização. Toda entidade operacional pertence a exatamente um tenant. |
| Papel | Agrupamento administrável de capacidades, como `member`, `manager` ou `admin`. |
| Permissão | Autorização efetiva calculada server-side a partir de ator, tenant, papel, scope, recurso e estado. |
| Owner | Responsável por decidir e manter um domínio/componente; não significa necessariamente autor de cada registro. |
| Fonte de verdade | Store autorizado a determinar o estado atual de uma classe de dado. Cópias derivadas não podem sobrescrevê-lo sem contrato. |

## Agentes, memória e conhecimento

| Termo | Definição |
|---|---|
| Hermes | Agente que interpreta, planeja, gera e usa ferramentas dentro de uma delegação; não é a fonte de verdade operacional. |
| Chat Bridge | Camada de transporte e adaptação entre frontend e Hermes, responsável por runs/SSE/anexos/artefatos. |
| Marketing Ops | Serviço de domínio futuro que expõe API ao frontend e MCP ao Hermes, sendo autoridade de campanhas e execução. |
| Memória conversacional | Contexto de uma sessão usado para continuidade do diálogo; pode expirar e não substitui dados de negócio. |
| Trabalho validado | Artefato que um ator autorizou guardar para reuso, com proveniência e status. |
| RAG | Base recuperável de documentos oficiais e evidências textuais; não guarda estado transacional atual. |
| Graph | Base de relações e fatos validados; não concede autorização nem substitui ledger operacional. |
| Artefato | Arquivo produzido ou consumido, identificado de forma durável por ID/hash; URL assinada é somente acesso temporário. |

## Confiabilidade e operação

| Termo | Definição |
|---|---|
| Idempotency key | Chave estável que transforma repetição/retry da mesma intenção em uma única operação efetiva. |
| Correlation ID | Identificador propagado ponta a ponta para ligar UI, Bridge, Hermes, Marketing Ops, worker e provedor. |
| Outbox | Registros de eventos gravados na mesma transação do estado, publicados depois com retry seguro. |
| Reconciliação | Processo que compara estado interno e resposta externa, corrigindo operações pendentes ou divergentes. |
| Audit event | Registro append-only de ator, ação, alvo, versão, decisão, tempo e resultado. |
| Gate local | Conjunto de verificações executadas no ambiente de desenvolvimento antes de publicar código. |
| Gate VPS | Verificação pós-deploy na VPS Linux, executada somente depois que o usuário fizer o deploy. |
| `ready_for_production` | Estado após gate local; não significa produção validada. |
| `production_validated` | Estado alcançado somente após gate VPS e smoke tests aprovados. |
