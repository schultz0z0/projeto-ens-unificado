# Handoff de continuação — Fase 4

- **Estado:** `phase_4_closed`
- **Snapshot:** 2026-07-29
- **Dependência anterior:** Fase 3 `production_validated`
- **Código:** implementação e gate VPS concluídos

## Ordem de leitura

1. [README.md](README.md)
2. [implementation-progress.md](implementation-progress.md)
3. [local-validation.md](local-validation.md)
4. [runbook.md](runbook.md)
5. [vps-validation.md](vps-validation.md)

## Ponto exato de continuação

Não há continuação pendente da Fase 4. O próximo ciclo pode iniciar a Fase 5
usando PRD, design, rastreabilidade e gate VPS desta fase como baseline
`production_validated`.

O pacote `1.2.4` foi implantado no caminho canônico. Health de Hermes e Bridge,
skill instalada e catálogo com 10 tools passaram. No gate final, a campanha
`HML F4 Final 20260729-C` recebeu uma nota append-only somente após a
confirmação contextual `vamos nessa`; o link Markdown `Abrir campanha` foi
clicado e abriu o objeto correto na versão 3. Supabase e auditoria confirmaram
a mesma execução.

O histórico abaixo é mantido como trilha de decisões e incidentes; não
representa trabalho pendente.

Os pacotes `1.2.1` e `1.2.2` foram implantados. Asset + versão inicial, deep
link, frontend, Supabase, auditoria, idempotência, timeline, agenda, RAG,
Graph, admin, manager, member e prompt injection passaram.

O reteste da revisão ENS após `1.2.2` leu o histórico, mas revelou um bloqueador
novo: o Hermes não encontrou o título exato na janela consultada, aproximou
`HML Fase 4.1` de `HML F4`, ocultou o alvo resolvido no preview e criou a
versão 2 no asset `Email inicial`. O asset solicitado
`HML F4 Email HTML 20260729-C1` permaneceu na versão 1. O diagnóstico do chat,
os logs e o Supabase concordam; a mutação incorreta não foi apagada.

O pacote `1.2.3` foi publicado e passou nos dois cenários: criou a versão 2 no
asset correto e falhou fechado para o título inexistente. A rota retornada
também abriu o item/asset corretos, mas apareceu no chat como texto simples.

O pacote `1.2.4` e sua regressão RED→GREEN foram publicados e validados. O
bloco do décimo sexto release em `runbook.md` permanece apenas para reprodução
ou recuperação operacional.

O escopo local da Fase 4 está concluído e o histórico de migration remoto está
alinhado. Os hotfixes já publicados validaram a leitura real de
campanhas/agenda no chat de produção, confirmando transporte, tool e resposta
ponta a ponta sem mutação.

O preview seguinte revelou que o agente tentava misturar enriquecimento com
`campaign.create_draft`, cujo schema é estrito. O Marketing Ops recusou antes
de assinatura/persistência. Há um quarto hotfix local, testado com RED/GREEN e
85/85 testes da Bridge: ele instrui criação somente com `type`, `ref`, `name`
e `course_slug` opcional e exige um segundo ciclo para `campaign.update`.
O sexto hotfix foi publicado e o preview passou no app real, sem persistência.
A confirmação contextual em turno posterior foi recusada porque a Bridge só
reconhecia frases literais. A correção contextual substituiu esse detector:
`hermes-api` classifica a resposta contra o plano pendente, sem tools, e a
Bridge assina confirmação somente para `approve`. O primeiro teste publicado
provou o fail-closed, mas revelou que o modelo respondia fora do JSON estrito.
O oitavo hotfix isola o classificador da persona conversacional, exige a linha
fechada `NEXUS_MARKETING_OPS_DECISION: {"decision":"..."}` e registra somente
o enum/aderência ao contrato. Pergunta, negação, ressalva, adiamento e alteração
continuam fechados; alteração exige novo preview. Os gates locais do runtime
(12/12) e os 86 testes da Bridge passaram. A varredura seguinte encontrou dois
formatos adicionais do provedor para uma única action (objeto tipado direto e
JSON codificado); eles foram normalizados antes da mesma validação estrita. O
smoke publicado também mostrou que a tool de agenda precisa de instantes ISO
8601 completos com offset. A skill agora possui referências e template
carregáveis, embutidos no `hermes-api`.

O nono release foi publicado. A leitura e o preview passaram no app real, mas
`vamos nessa` revelou que o classificador levou cerca de 6,4 segundos enquanto
a Bridge aguardava somente 4 segundos. O endpoint registrou `approve` tarde
demais; a Bridge seguiu em fail-closed como `clarify` e o runtime bloqueou a
escrita. A mesma inspeção mostrou a skill persistida `1.0.0`, que prevalecia
sobre o pacote `1.2.0` da imagem.

O décimo release foi publicado e os health checks passaram. O volume recebeu o
pacote `1.2.0`, porém o loader encontrou duas candidatas com o mesmo nome:
`skills/marketing-ops-operator` e
`skills/marketing/marketing-ops-operator`. No novo preview, o Supabase
confirmou ausência de escrita; `vamos nessa` chegou ao classificador dentro dos
15 segundos, mas foi classificado como `clarify`, e a execução permaneceu
corretamente bloqueada.

O décimo primeiro release foi publicado: health, catálogo, caminho canônico da
skill e leitura real passaram. No preview seguinte, a sessão registrou a tool
call como `{}`; a delegação foi vinculada pelo runtime, mas `actions` ficou
ausente e o MCP recusou sem persistir. O Supabase confirmou zero campanha, zero
auditoria e zero idempotência para `HML F4 Final 20260729-A`.

O histórico abaixo explica os releases anteriores; não o use como próximo
passo de desenvolvimento.

## Artefatos críticos já entregues

- contrato do operador Hermes endurecido em `services/chat-bridge`;
- deep links e navegação SPA do Marketing Ops validados no `chat-web`;
- E2E fake do operador Hermes cobrindo confirmação e indisponibilidade;
- migration remota da auditoria Hermes aplicada no Supabase conectado.
- pacote da skill do Marketing Ops em
  `services/hermes-runtime/vendor/hermes-agent/skills/marketing/marketing-ops-operator/`.

## Regras de retomada

- não alterar o schema nem afrouxar `campaign.create_draft` para contornar o
  erro de composição; a correção está no contrato do operador;
- não expor mutações novas como tools diretas do MCP;
- nunca aceitar preview de objeto existente que não mostre os rótulos exatos
  de campanha, item e conteúdo resolvidos;
- se o título não puder ser resolvido exatamente, exigir esclarecimento e
  confirmar ausência de `prepare_plan`, `execute_plan` e persistência;
- não reabrir decisões da Fase 3 sem regressão comprovada;
- não promover a fase por documentação ou E2E fake sozinhos;
- usar `runbook.md` e `vps-validation.md` como fonte autoritativa do deploy.
- não reabrir a Fase 4 por causa do `invalid_union` recuperado no primeiro
  prepare do gate final: ele foi recusado sem escrita e corrigido na mesma
  conversa; trate-o somente como telemetria de otimização, salvo regressão
  observável.
