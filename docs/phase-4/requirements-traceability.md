# Rastreabilidade de requisitos — Fase 4

- **Estado:** `closed`
- **Implementação:** `production_validated`
- **Revisão:** 2026-07-29

## Matriz requisito → design → task

| Requisito | Design | Task | Estado |
|---|---|---|---|
| F4-RF-01 Consulta fundamentada | 3, 6.1, 12 | 2 | `production_validated` |
| F4-RF-02 Uso do RAG | 5, 10 | 5, 7 | `production_validated` |
| F4-RF-03 Uso do Graph | 5 | 5, 7 | `production_validated` |
| F4-RF-04 Preview | 4.2, 7.2 | 3, 4, 5 | `production_validated` |
| F4-RF-05 Confirmação | 4.2, 4.7, 7 | 3, 5, 7 | `production_validated` |
| F4-RF-06 Delegação | 5, 10, 11 | 1, 3, 5, 6 | `production_validated` |
| F4-RF-07 Deep link | 9 | 4, 7 | `production_validated` |
| F4-RF-08 Idempotência | 4.2, 7.3, 10 | 3, 6 | `production_validated` |
| F4-RF-09 Conflito | 7.3, 8, 12 | 3, 4, 5 | `verified_automated` |
| F4-RF-10 Operação parcial | 7.3, 8, 12 | 3, 4 | `verified_automated` |
| F4-RF-11 Auditoria | 4.4, 11 | 1, 6, 7, 8 | `production_validated` |
| F4-RF-12 Limites | 2, 4.2, 10 | 1, 5, 7 | `verified_automated_and_production_guarded` |

## Matriz Roadmap → design → task

| Entrega do Roadmap | Design | Task | Estado |
|---|---|---|---|
| MCP de consulta e mutação controlada | 4.2, 6, 7 | 1–3 | `production_validated` |
| Criação de campanha em rascunho | 6.2, 7 | 1, 3, 5, 7 | `production_validated` |
| Atualização com confirmação | 4.2, 4.7, 7, 8.1 | 3, 5, 7 | `production_validated` |
| Geração de calendário e itens | 8.8 | 3, 5, 7 | `production_validated` |
| Criação e vínculo de conteúdo | 8.4–8.6, 8.9 | 3, 5, 7 | `production_validated` |
| Revisão pelo tom de voz ENS | 4.5, 8.9 | 5, 7 | `production_validated` |
| Conversão de resposta do chat em objeto | 8.9 | 3, 5, 7 | `production_validated` |
| Auditoria correlacionada com chat e run | 4.4, 11 | 1, 6, 7 | `production_validated` |

## Matriz de critérios de aceite

| Critério | Design | Task/teste | Estado |
|---|---|---|---|
| Lista somente campanhas autorizadas | 6.1, 10 | 2, 7 | `production_validated` |
| Estado operacional vem do Marketing Ops | 4.1, 4.5 | 2, 5, 7 | `production_validated` |
| Cria rascunho após confirmação contextual | 4.2, 4.7, 7 | 3, 5, 7 | `production_validated` |
| Objeto aparece no frontend sem reconciliação | 9 | 4, 7 | `production_validated` |
| Retry não duplica objeto | 7.3 | 3, 7 | `production_validated` |
| Tenant/papel forjados são rejeitados | 10 | 1, 2, 3, 7 | `production_validated` |
| Delegação expirada/reutilizada falha | 10 | 1, 5, 7 | `verified_automated` |
| Conflito exige nova consulta/decisão | 7.3, 8.1 | 3, 5, 7 | `verified_automated` |
| Conteúdo do chat vira versão vinculada | 8.9 | 3, 5, 7 | `production_validated` |
| Deep link abre objeto correto | 9 | 4, 7 | `production_validated` |
| Auditoria liga ator/chat/run/tool | 4.4, 11 | 1, 6, 7 | `production_validated` |
| Hermes não aprova/executa ação sensível | 2, 10 | 1, 5, 7 | `verified_automated_and_production_guarded` |
| Indisponibilidade não gera falso sucesso | 7.3, 12 | 4, 5, 7 | `verified_automated` |

## Matriz de segurança e observabilidade

| Requisito | Design | Task/teste | Estado |
|---|---|---|---|
| Allowlist e autoridade server-side | 7.1, 10 | 1, 3 | `implemented_unit_validated` |
| Sem tools MCP diretas de mutação | 4.6, 6.2 | 1, 5 | `catalog_verified` |
| Rate limit por ator e ferramenta | 10 | 1, 2, 3 | `implemented_unit_validated` |
| Prompt injection não amplia autoridade | 10, 12 | 5, 7 | `production_validated` |
| Logs sem texto integral/tokens | 10, 11 | 6, 7 | `implemented_unit_validated` |
| Métricas por tool/resultado | 11 | 6 | `implemented_unit_validated` |
| Idempotency hit e conflito observáveis | 11 | 3, 6 | `implemented_unit_validated` |
| Chat → run → tool → audit → objeto | 4.4, 11 | 1, 6, 7 | `production_validated` |

## Gates transversais

| Gate | Design | Task | Estado |
|---|---|---|---|
| Catálogo MCP versionado | 6, 7 | 1 | `implemented_unit_validated` |
| Leituras MCP da Fase 4 | 6.1 | 2 | `implemented_unit_validated` |
| Executor das oito actions | 7, 8 | 3 | `implemented_unit_validated` |
| Deep links servidor → frontend | 9 | 4, 7 | `production_validated` |
| Sem mutação direta fora do plano | 4.2, 7 | 1, 3, 5 | `catalog_verified` |
| Auditoria/correlação | 11 | 1, 6, 8 | `production_validated` |
| Runtime Hermes alinhado | 3.1, 4.2, 4.7, 4.8, 12 | 5 | `production_validated` |
| E2E ponta a ponta | 12, 13, 14 | 7, 8 | `production_validated` |
| Gate local | 13 | 8 | `completed_with_documented_environment_limits` |
| Gate VPS | 14 | 8 | `production_validated` |

Os checklists de `local-validation.md` e `vps-validation.md` são parte desta
matriz. Itens não aplicáveis devem ser marcados com justificativa, nunca
silenciosamente removidos.

## Registro da homologação parcial — 2026-07-28

O smoke real de leitura confirmou a cadeia Hermes/MCP/Marketing Ops sem
mutação. Os previews posteriores não foram contados como sucesso de criação:
primeiro o schema recusou campos inválidos em `campaign.create_draft`; depois o
MiniMax serializou `actions` como objeto `item` ou string JSON. Todos os casos
foram recusados antes de assinatura ou persistência. O sexto hotfix foi validado
no preview real. A confirmação contextual seguinte foi recusada pela allowlist
literal da Bridge. A correção contextual substituiu, antes de publicação, o
detector de frases: o runtime retorna decisão fechada e a Bridge só concede
`confirmation_intent` para `approve`. O primeiro teste real revelou que o
classificador respondia fora do JSON estrito; ele foi isolado da persona
conversacional, ganhou contrato de uma linha e log sanitizado da decisão. A
validação local do runtime, do contrato e 86/86 testes da Bridge passou.
O nono release candidato adicionou a normalização dos dois formatos restantes
do provedor, a regra de agenda e a skill estruturada. Após seu deploy, leitura
e preview passaram e o Supabase confirmou ausência de escrita prematura. A
confirmação revelou um timeout de 4 segundos na Bridge diante de latência real
de cerca de 6,4 segundos, além da cópia persistida `1.0.0` da skill. O décimo
release corrigiu o timeout, mas seu pós-deploy encontrou duas cópias da skill
com o mesmo nome e uma decisão `clarify` do modelo para `vamos nessa`. O décimo
primeiro release usa a categoria canônica, remove somente a cópia gerenciada
obsoleta e resolve respostas completas inequívocas antes do modelo. O
pós-deploy confirmou esses dois contratos e repetiu a leitura real. O preview
seguinte mostrou que o schema visível ainda exigia credenciais que o runtime
já vincula; o modelo enviou `{}` e o servidor recusou `actions` ausente. O
décimo segundo release esconde somente `delegation_token` e, no executor,
`plan_token` do schema do modelo. Criação e atualização permaneciam pendentes
desse redeploy de `hermes-api` e da repetição na VPS naquele snapshot
histórico.

## Leitura inicial

- F4-RF-01, F4-RF-04, F4-RF-05 e F4-RF-06 aproveitam muito do que foi
  antecipado na Fase 1, mas precisam ser estendidos para o escopo real da
  Fase 4.
- F4-RF-07 e F4-RF-11 são os pontos com maior probabilidade de exigir contrato
  novo; os contratos foram congelados no design e serão implementados nas
  Tasks 1, 4 e 6.
- F4-RF-02 e F4-RF-03 são requisitos de fronteira arquitetural; a
  implementação deve provar que RAG e Graph continuam complementares, nunca
  transacionais.

## Reconciliação do alvo incorreto — 2026-07-29

O reteste de revisão provou RAG, Graph, leitura de versão, confirmação,
execução, auditoria e deep link isoladamente, mas falhou no vínculo entre a
intenção humana e a identidade transacional: o plano foi preparado para um
asset semelhante, não para o nome solicitado. Por isso F4-RF-04, F4-RF-07 e a
linha de revisão ENS permanecem pendentes.

O pacote `1.2.3` adiciona o gate de identidade exata e rastreável. O fechamento
exige duas provas reais:

1. cenário positivo com campanha/item/conteúdo exatos visíveis no preview e
   versão criada somente no asset correto;
2. cenário negativo sem identidade resolvível, encerrado com pedido de contexto
   e zero plano/persistência.

As duas provas passaram em produção. A rota retornada também correspondeu ao
objeto certo, mas o chat não a renderizou como link. Portanto somente F4-RF-07
permanecia aberto naquele snapshot para o pacote `1.2.4`: Markdown clicável,
rota server-returned inalterada e clique real até o objeto correto.

## Fechamento do último requisito — 2026-07-29

O pacote `1.2.4` foi carregado e F4-RF-07 passou no app real. Após a execução
confirmada de `campaign.note_add`, a resposta gerou um elemento `link`
`Abrir campanha` com o `href` devolvido pelo servidor. O clique navegou para a
campanha `6c09b64a-fe76-46ee-8edb-c2039d73fa2d`; frontend e Supabase mostraram
versão 3 e a nota anexada sem sobrescrever a anterior. O evento
`c0c8a13e-f323-44a7-b576-1e854cf0ad8f` fechou a correlação.

Os cenários que exigiriam degradação deliberada do ambiente público — conflito,
rate limit e indisponibilidade — permanecem verificados por testes automatizados
específicos. Essa substituição está justificada em `vps-validation.md` e não
reduz o critério funcional do PRD.

## Critério de encerramento desta matriz

Esta matriz muda para `closed` quando cada
requisito tiver:

- task concluída;
- evidência local ou VPS quando aplicável;
- referência explícita em `implementation-progress.md`;
- ausência de conflito aberto entre design, contrato MCP e comportamento real.
- critério de aceite, segurança, observabilidade e entrega do Roadmap em estado
  `verified` ou `not_applicable` justificado.

Todos os itens acima foram satisfeitos em 2026-07-29; a matriz está `closed`.
