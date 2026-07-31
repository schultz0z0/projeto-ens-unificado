# Picture-Hermes: validação real e desenho de endurecimento

**Data:** 2026-07-29  
**Escopo:** implementação integrada do Picture no Nexus, contrato MCP usado pelo Hermes, render determinístico e experiência de revisão no frontend.  
**Estado inicial:** fluxo funcional, porém ainda inadequado para produção confiável sem correções de contrato, geometria, telemetria e UX.

## 1. Objetivo

Transformar a integração atual em uma base previsível para um “Photoshop operado por IA”:

- o Hermes descreve a peça em um contrato sem ambiguidades;
- o Picture compõe texto, formas, imagens, gradientes e efeitos de modo determinístico;
- operações FAL são opcionais e carregadas somente quando o plano realmente as utiliza;
- falhas de composição são detectadas antes de publicar uma peça cortada;
- revisões preservam versões anteriores e exibem imediatamente a nova candidata;
- respostas MCP transportam somente o estado necessário ao agente.

Esta etapa não tenta substituir um editor visual humano nem executa chamadas pagas da FAL. Ela endurece o núcleo determinístico e deixa o caminho híbrido pronto para teste após a inclusão de crédito.

## 2. Fontes analisadas

- Aplicação de produção: `https://app.solucoes-nexus.tech/`
- Logs do Hermes: `https://hermes.solucoes-nexus.tech/logs`
- Repositório original privado `schultz0z0/picture-it-main`, acessado no Chrome autenticado
- Implementação integrada em `services/picture-it`
- Skill do agente em `services/hermes-runtime/skills/picture-hermes`
- Runtime do Hermes em `services/hermes-runtime/vendor/hermes-agent`
- Workspace do frontend em `apps/chat-web/src/components/picture`
- Documentação existente em `PRD-picture-hermes-semi-nativo.md`, `docs/plans/2026-07-21-picture-hermes-*` e `docs/picture-hermes-operations.md`

O repositório original confirma a intenção de produto: operações gráficas componíveis, composição gratuita/determinística e zonas posicionais utilizáveis por agentes. A integração Nexus adiciona persistência, delegação, jobs, artefatos e revisão.

## 3. Cenário real executado

Foi solicitada uma peça de Instagram 1080 × 1080 para “Pós-graduação em Gestão de Riscos”, com identidade ENS, textos exatos e instrução explícita para usar somente composição determinística: sem `generate`, `edit`, `remove-bg`, `replace-bg` ou `upscale`.

Fluxo observado:

1. Hermes consultou o workspace.
2. Hermes montou briefing e plano de composição.
3. Picture enfileirou e processou o job.
4. O artefato final e os arquivos de planejamento foram publicados.
5. A primeira peça foi publicada com textos deslocados/cortados à direita.
6. Uma revisão corrigiu os textos, mas deixou a forma do CTA cortada à esquerda.

### Evidências operacionais

| Evidência | Resultado |
|---|---|
| Primeiro turno | aproximadamente 115 s, 6 chamadas de API e 5 turnos de ferramenta |
| Revisão | aproximadamente 75 s, 5 chamadas de API |
| Contexto do primeiro turno | cresceu de cerca de 27,6 mil para 38,5 mil tokens |
| Contexto da revisão | cresceu de cerca de 40 mil para 48,5 mil tokens |
| Primeira chamada `picture_get_workspace` | rejeitada por argumento obrigatório ausente/indefinido; repetição funcionou |
| Primeira chamada `picture_start_job` | rejeitada porque `rotation` não era aceito em forma; repetição funcionou |
| Primeira chamada `picture_revise` | rejeitada por argumento obrigatório ausente/indefinido; repetição funcionou |
| Resultado determinístico | job e publicação concluíram sem depender de geração FAL no plano |
| Qualidade visual inicial | inválida: textos cortados à direita |
| Qualidade visual revisada | textos corrigidos; CTA geométrico ainda cortado à esquerda |

## 4. Causas-raiz

### P0 — posição numérica ambígua

`resolvePosition()` interpreta qualquer coordenada entre 0 e 100 como porcentagem e valores maiores como pixels. O plano enviado pelo Hermes utilizou `x: 72` com intenção de 72 pixels; o engine interpretou 72% de 1080, deslocando o conteúdo para `x ≈ 778`.

O contrato MCP aceitava apenas `{x, y}`, sem unidade. A documentação original dizia “porcentagens”, enquanto o próprio engine aceitava silenciosamente uma heurística mista. Esse desenho permite que um plano válido produza uma peça visualmente inválida.

### P0 — formas ignoram âncora e escondem overflow

Textos e imagens aceitam `anchor`; formas não. O compositor sempre posiciona formas pelo centro. Uma forma com `x: 7%`, visualmente pensada como `top-left`, tem metade de sua largura fora da tela. O `Math.max(0, posição)` mascara o erro e recorta a forma.

### P0 — ausência de validação geométrica

Texto, imagem ou forma podem ultrapassar a tela. Em vez de falhar com diagnóstico acionável, a composição limita coordenadas negativas e publica um resultado truncado. O job “succeeded” não significa que o layout é utilizável.

### P1 — FAL inicializada mesmo em pipeline determinístico

`executePipeline()` chama `ensureFalKey()` antes de examinar as operações. Um plano composto apenas por `compose`, `crop`, `grade`, `grain`, `vignette` e `text` deve funcionar sem chave FAL.

### P1 — canvas compose-first fixo em 1080 × 1080

Quando `compose` é a primeira etapa, o engine cria sempre uma tela 1080 × 1080. Isso impede formatos determinísticos como Stories 1080 × 1920 e feed paisagem 1080 × 566.

### P1 — respostas MCP excessivas

`picture_start_job`, `picture_revise` e `picture_get_job` devolvem o registro completo, incluindo `specification`. Briefing, pipeline e overlays são reenviados ao contexto do modelo, gerando respostas de aproximadamente 5–6 KB por chamada e aumentando custo e latência.

### P1 — skill insuficiente para o contrato

A skill do Hermes não explica:

- unidade explícita de posição;
- âncoras de forma;
- tamanho de canvas em compose-first;
- regra de bleed;
- quais propriedades são aceitas por cada tipo de overlay;
- preferência por uma única chamada válida em vez de tentativa e correção.

### P2 — revisão não muda automaticamente a prévia

O frontend seleciona a candidata somente quando nenhuma seleção existe. Depois de uma revisão, a prévia continua mostrando o artefato anterior até o usuário clicar no novo arquivo.

Arquivos sucessivos com o mesmo nome também aparecem indistinguíveis.

### Fora do núcleo Picture

Foram observados um `Invalid Refresh Token` do Supabase após recarregar a aplicação, `404` em `/api/approvals/ws` nos logs e o indicador “Gateway stopped” no painel Hermes. O fluxo Picture continuou operacional. Esses itens ficam registrados como adjacentes e não serão misturados às correções do renderizador.

## 5. Alternativas consideradas

### A. Apenas melhorar o prompt da skill

Vantagem: alteração pequena.  
Desvantagem: continua aceitando planos ambíguos e pode publicar artefatos cortados. Um modelo diferente ou uma regressão de prompt reintroduz o problema.

### B. Tornar o contrato estrito e quebrar todo uso legado

Vantagem: elimina a ambiguidade integralmente.  
Desvantagem: pode quebrar fixtures, CLI e planos antigos do Picture original, que usam coordenadas sem unidade.

### C. Contrato MCP estrito com compatibilidade interna controlada

Esta é a abordagem escolhida.

- O contrato público do Hermes exige `{x, y, unit: "px" | "percent"}`.
- O engine aceita a forma nova e preserva a heurística antiga apenas para chamadas internas/CLI existentes.
- Formas ganham `anchor`, `rotation` e `allowBleed`.
- Imagens ganham `allowBleed`; texto nunca pode sangrar.
- Overlays sem bleed que ultrapassem o canvas falham com `picture_overlay_out_of_bounds`.
- `compose.size` define o canvas quando não existe imagem-base.

Esse desenho bloqueia novos erros do agente sem invalidar de imediato os consumidores originais.

## 6. Contrato alvo

### Posição

```json
{
  "zone": { "x": 72, "y": 80, "unit": "px" },
  "anchor": "top-left"
}
```

ou:

```json
{
  "zone": { "x": 7, "y": 82, "unit": "percent" },
  "anchor": "top-left"
}
```

Zonas nomeadas continuam aceitas.

### Forma

```json
{
  "type": "shape",
  "shape": "rect",
  "zone": { "x": 7, "y": 82, "unit": "percent" },
  "anchor": "top-left",
  "width": 360,
  "height": 88,
  "rotation": -2,
  "allowBleed": false,
  "fill": "#18BFD3",
  "borderRadius": 44
}
```

### Compose-first

```json
{
  "op": "compose",
  "size": "1080x1920",
  "overlays": []
}
```

### Resumo de job MCP

As ferramentas devolvem somente:

- `id`
- `workspace_id`
- `kind`
- `status`
- `progress`
- `attempt_count`
- `max_attempts`
- `result_artifact_id`
- `error_code`
- `error_message`
- timestamps de criação, início e conclusão quando disponíveis

`specification`, lease interno e token de idempotência não voltam para o contexto do Hermes.

## 7. Fluxo de render alvo

1. O Hermes consulta o workspace com a delegação inserida pelo runtime.
2. A skill produz briefing e plano válidos na primeira tentativa.
3. O MCP valida estrutura e unidades.
4. O worker materializa o pacote.
5. O engine detecta se existe alguma operação FAL; somente então exige/configura a chave.
6. Em compose-first, o canvas usa `compose.size`.
7. Cada overlay calcula tamanho efetivo, incluindo rotação.
8. Overlays sem bleed são validados contra o canvas.
9. O artefato só é publicado se toda a geometria for válida.
10. O MCP devolve resumo compacto.
11. Ao mudar `candidate_artifact_id`, o frontend seleciona a nova peça e rotula versões duplicadas.

## 8. Tratamento de erros

- `picture_overlay_out_of_bounds`: inclui tipo, índice, caixa calculada e dimensões do canvas.
- `picture_contract_invalid`: continua representando estrutura ou tipo inválido.
- `picture_fal_key_missing`: ocorre apenas quando existe uma operação que chama FAL.
- Jobs com erro determinístico de contrato/layout não devem consumir as três tentativas; são falhas não retentáveis.
- Revisão com falha preserva a candidata anterior, como já ocorre.

## 9. Matriz de testes

| Camada | Caso |
|---|---|
| Zones | diferencia `72px` de `72%` e preserva compatibilidade sem unidade |
| Contrato | exige unidade em posição numérica enviada pelo MCP |
| Contrato | aceita âncora, rotação, bleed e tamanho no tipo correto |
| Compositor | forma `top-left` não é centralizada |
| Compositor | rotação mantém âncora baseada na dimensão efetiva |
| Compositor | texto/forma fora do canvas falham sem bleed |
| Compositor | forma decorativa fora do canvas funciona com bleed |
| Pipeline | compose-only funciona sem `FAL_KEY` |
| Pipeline | compose-first produz o tamanho solicitado |
| MCP | resumo exclui `specification` em start/revise/get |
| Hermes runtime | token Picture atual é inserido mesmo se ausente no argumento do modelo |
| Frontend | nova candidata substitui automaticamente a seleção |
| Frontend | nomes duplicados recebem versão inequívoca |
| Regressão | suíte completa Picture, typecheck, build Hermes e testes focados do frontend |

## 10. Compatibilidade e rollout

- Não há migração de banco.
- Artefatos e jobs antigos permanecem legíveis.
- Planos antigos armazenados não são reprocessados automaticamente.
- A heurística antiga existe somente no engine, não no novo schema MCP.
- Picture e Hermes devem ser publicados juntos porque a skill passa a emitir o novo contrato.
- O frontend pode ser publicado no mesmo rollout; caso precise de rollback, as versões anteriores continuam no storage.

## 11. Critérios de conclusão

- cenário determinístico executa localmente sem chave FAL;
- posições em pixels e porcentagem geram coordenadas diferentes e corretas;
- forma com `top-left` não é recortada;
- overflow não intencional falha antes da publicação;
- compose-first respeita formatos não quadrados;
- ferramentas MCP não devolvem `specification`;
- delegação é inserida antes do despacho da ferramenta;
- frontend troca para a candidata revisada e identifica versões;
- testes focados, suítes completas, typechecks e builds relevantes passam;
- documentação operacional contém deploy, rollback e teste manual de produção;
- o caminho FAL fica explicitamente marcado como não executado até haver crédito, sem representar essa ausência como validação concluída.

## 12. Registro de execução

Este documento será atualizado durante a implementação.

| Fase | Estado |
|---|---|
| Validação real e diagnóstico | concluída |
| Especificação e plano | concluída |
| Testes de regressão | concluída |
| Engine e contrato | concluída |
| MCP e Hermes | concluída |
| Frontend | concluída |
| Verificação local final | concluída |
| Deploy em produção | responsabilidade do operador após esta entrega |

## 13. Resultado final da implementação

- Picture: 70 testes passando, 0 falhas, 198 assertions.
- Picture: `tsc --noEmit` e build Bun concluídos.
- Hermes: 4 testes passando; 1 skip esperado no Windows por exigir POSIX/bash.
- Frontend: 205 testes passando em 56 arquivos, 0 falhas.
- Frontend: typecheck e build Vite concluídos.
- Contratos JSON: template Hermes e fixtures Picture parseados.
- Git: `git diff --check` sem erro.
- Compose: merge de `docker-compose.yml` com `docker-compose.prod.yml`
  validado por `docker compose ... config --quiet`.
- FAL: nenhuma chamada paga executada; o caminho híbrido continua como teste
  manual pós-crédito.
- Produção: não recebeu deploy nesta sessão, conforme o escopo.

Os warnings de build do frontend sobre `caniuse-lite`, import estático/dinâmico
do Supabase e chunk principal acima de 500 kB já existiam e não impedem o build.
Eles não foram misturados a este hardening do Picture.
