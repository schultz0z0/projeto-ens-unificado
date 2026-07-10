# PRD — Fase 5: Governança e Aprovações

- **Status:** draft
- **Dependências:** Fases 3–4 concluídas
- **Resultado:** conteúdo e ações sensíveis avançam somente após decisão humana rastreável

## Resumo

A fase cria dois fluxos de negócio: aprovação editorial de uma versão e autorização operacional de um pacote sensível. Eles permanecem separados da aprovação técnica de comandos do Hermes.

## Problema

Sem versão congelada, papel de aprovador e trilha de decisão, um material pode ser alterado depois da revisão ou uma ação pode ser executada com payload diferente do aprovado.

## Objetivos

- congelar exatamente o que será avaliado;
- permitir aprovar, rejeitar, pedir ajuste, cancelar e expirar;
- diferenciar conteúdo de ação sensível;
- oferecer fila clara a manager/admin;
- aplicar segregação de funções;
- criar `action_package` imutável após autorização;
- preparar execução determinística.

## Não objetivos

- executar disparos;
- substituir o modal técnico do Hermes;
- permitir aprovação automática por IA;
- criar workflow genérico para qualquer processo da empresa;
- integrar todos os canais.

## Tipos

### Editorial

Avalia uma `content_version`: copy, mensagem, peça, plano ou calendário conforme escopo.

### Operacional

Autoriza uma ação sensível com campanha, público, canal, horário, configuração, justificativa, riscos e payload congelados.

## Estados

`pending`, `approved`, `rejected`, `changes_requested`, `cancelled`, `expired`.

Estado de execução não pertence à aprovação. Execução usa entidade própria.

## Requisitos funcionais

### F5-RF-01 — Solicitação editorial

Referenciar uma versão imutável, solicitante, campanha, contexto, justificativa e aprovadores elegíveis.

### F5-RF-02 — Solicitação operacional

Referenciar um pacote completo com ação, payload, campanha, público/segmento, canal, data/hora, configurações, risco e critério de sucesso.

### F5-RF-03 — Fila

Exibir pendências autorizadas com filtros por tipo, campanha, solicitante, prazo, risco e status.

### F5-RF-04 — Decisão

Aprovador pode aprovar, rejeitar ou pedir ajuste; solicitante/gestor autorizado pode cancelar. Decisão exige comentário quando rejeitada ou ajustada.

### F5-RF-05 — Segregação

Políticas configuram quando solicitante não pode aprovar a própria solicitação. O padrão para ação sensível é separação.

### F5-RF-06 — Expiração

Solicitações possuem validade. Pacote expirado não pode executar e exige nova solicitação.

### F5-RF-07 — Alteração

Alterar versão ou payload invalida a solicitação anterior. A nova versão inicia novo ciclo.

### F5-RF-08 — Ajustes

`changes_requested` retorna ao solicitante com comentário e vínculo à versão anterior. Novo envio cria versão/revisão rastreável.

### F5-RF-09 — Action package

Aprovação operacional cria ou libera pacote imutável, com hash e referência à decisão.

### F5-RF-10 — Notificações

Gerar eventos para nova solicitação, ajuste, decisão, expiração e cancelamento. Canais externos não são obrigatórios.

### F5-RF-11 — Hermes

O Hermes pode preparar e submeter após confirmação do usuário. Não pode decidir em nome do aprovador.

### F5-RF-12 — Histórico

Exibir versões, decisões, autores, timestamps, comentários e razão de invalidação.

## Dados

- `approval_requests`;
- `approval_request_targets` ou referência tipada;
- `approval_decisions`;
- `action_packages`;
- políticas/eligibilidade quando necessário;
- auditoria e eventos.

## UX

- preview fiel da versão/payload;
- destaque para público, canal, horário e risco;
- comparação entre versões quando houver ajuste;
- decisões diretas sem exigir nova conversa com Hermes;
- confirmação reforçada em ação de alto risco;
- acessibilidade e responsividade;
- status não depende apenas de cor.

## Permissões

Member prepara e solicita no escopo. Manager aprova conforme política. Admin administra políticas e pode atuar em escopos reservados. Elegibilidade é validada no momento da decisão, não apenas na abertura da tela.

## Segurança

- versão/payload com hash;
- decisão transacional;
- anti-replay;
- aprovador revalidado;
- comentário tratado como dado não confiável;
- links/artefatos verificados;
- auditoria imutável;
- nenhuma execução direta no endpoint de aprovação;
- data/hora e timezone explícitos.

## Observabilidade

- solicitações por tipo/status;
- tempo até decisão;
- taxa de ajustes/rejeição;
- expirações;
- tentativas não autorizadas;
- invalidações por mudança;
- correlation ID até o pacote.

## Critérios de aceite

- [ ] Solicitação editorial referencia versão imutável.
- [ ] Solicitação operacional contém payload completo.
- [ ] Fila exibe apenas solicitações autorizadas.
- [ ] Rejeição/ajuste exige comentário.
- [ ] Segregação impede autoaprovação quando aplicável.
- [ ] Papel é revalidado na decisão.
- [ ] Aprovação expirada não libera pacote.
- [ ] Mudança de conteúdo/payload invalida decisão anterior.
- [ ] Ajuste mantém histórico entre versões.
- [ ] Aprovação operacional gera pacote imutável com hash.
- [ ] Hermes submete, mas não decide.
- [ ] Modal técnico continua independente.
- [ ] Toda decisão é auditada e correlacionada.

## Testes

Máquinas de estado, elegibilidade, segregação, expiração, hashes, concorrência de decisão, invalidação, RLS, E2E solicitante/aprovador e tentativas de replay.

## Gate local

Fluxos editorial e operacional completos, três papéis, expiração, ajuste, concorrência, acessibilidade, notificações internas, rollback e auditoria.

## Gate VPS

Smoke com dados de teste, timestamps/timezone, políticas, persistência, eventos, logs, reinício e rollback. Nenhum provedor real é acionado.

## Riscos

| Risco | Mitigação |
|---|---|
| Workflow excessivamente genérico | Dois tipos explícitos no primeiro corte |
| Aprovação de versão errada | Referência imutável + hash + preview |
| Autoaprovação indevida | Segregação configurável, padrão seguro |
| Fila virar gargalo | Filtros, SLA visível e ajustes rápidos |
| Confusão com modal Hermes | Linguagem e componentes separados |

## Gate de saída

A Fase 6 inicia quando pacote aprovado é imutável, elegibilidade e segregação estão validadas, e nenhum endpoint de decisão causa efeito externo direto.
