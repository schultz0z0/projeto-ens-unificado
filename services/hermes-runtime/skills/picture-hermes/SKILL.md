---
name: picture-hermes
description: Planejar, gerar e revisar peças visuais complexas no modo Picture-Hermes com workspace persistente e tools nexus_picture.
version: 1.1.0
---

# Picture-Hermes

## Escopo e autoridade

Use este skill somente quando a mensagem de sistema identificar uma sessão marcada como Picture-Hermes, fornecer o `workspace_id` atual e uma delegação `nexus_picture`. No chat normal, ignore este skill e mantenha o gerador de imagem padrão do Hermes.

Hermes é o planner. O Picture executa o pipeline e publica a peça. A entrega continua sendo uma **imagem**, mesmo quando competências de copy, direção de arte, diagramação ou identidade de marca auxiliam o planejamento.

- Nunca use `image_generate` neste modo.
- Nunca transforme o pedido em PPTX, slide, deck, página web ou documento.
- Copy serve para mensagem, hierarquia verbal e CTA; não define outro tipo de artefato.
- Layout serve para composição da imagem; regras próprias de apresentações não se aplicam.
- Carregue `nexusai-ens-design-system` para obter os tokens oficiais da ENS (paleta, tipografia, espaçamento, logos e identidade). Use-o como fonte de marca, não como roteador de entrega.
- Não coloque emoji na peça e não invente ícones decorativos, salvo pedido ou aprovação explícita do usuário.
- Não invente preço, data, texto legal, oferta, logo ou atributo da marca.

Você pode planejar, iniciar, revisar e consultar jobs. Você não é a autoridade de aprovação: não aprove e não resete workspaces. Aprovação e criação de nova peça são ações explícitas do usuário na interface.

## Fluxo obrigatório

1. Chame `picture_get_workspace` antes de planejar uma revisão ou afirmar o estado atual.
2. Reúna no chat somente o briefing que estiver faltando. Não peça ao usuário nomes de tools, IDs, JSON ou detalhes internos.
3. Escolha a técnica e o menor pipeline capaz de entregar a direção aprovada. Preserve referências reais de produto e logos com composição determinística.
4. Na primeira geração, envie `CreativeBrief` e `CompositionPlan` completos a `picture_start_job`, uma única vez, com chave de idempotência estável no turno.
5. Para alterações após existir uma candidata, consulte o workspace, produza novamente um plano completo e chame `picture_revise`.
6. Consulte `picture_get_job` para o estado real. Não invente progresso, artefatos ou conclusão.
7. Em `succeeded`, informe que a candidata está pronta para revisão humana. Somente o estado `validated` significa peça aprovada.

## Regra crítica de serialização

As chamadas MCP usam **objetos e arrays JSON nativos**. Nunca escreva XML, `<item>`, tags por tipo de overlay, atributos `type="array"` ou JSON convertido em string.

- `composition_plan.pipeline` é um array JSON.
- Cada passo é um objeto do array e possui exatamente um `op`.
- Em um passo `compose`, `overlays` é outro array JSON; cada overlay é um objeto irmão dentro desse array.
- Em geral, reúna os overlays determinísticos em um único `compose`. Use vários passos somente quando o resultado intermediário realmente alimentar o próximo passe.
- Use o payload canônico de `templates/picture-start-job.json` como referência literal de estrutura. Substitua valores, não a forma dos arrays.

## CreativeBrief completo

Forneça todos os campos:

- `title`, `campaign_type`, `channel`;
- `objective`, `audience`, `offer`;
- `copy_points`: array de textos obrigatórios em ordem de hierarquia;
- `cta`: chamada exata;
- `visual_style` e `brand_profile`;
- `output`: `width`, `height` e `format` (`png`, `jpg` ou `webp`).

## CompositionPlan completo

Use `version: 1`, `base_prompt`, `pipeline` e um `final_path` seguro sob `final/`.

Operações aceitas:

- `generate`: `prompt`; opcionais `model`, `size`, `platform`.
- `edit`: `prompt`; opcionais `model`, `assets` (array), `size`.
- `remove-bg`.
- `replace-bg`: `prompt`; `model` opcional.
- `crop`: `size`; `position` opcional.
- `grade`: `name` (`cinematic`, `moody`, `vibrant`, `clean`, `warm-editorial`, `cool-tech`).
- `grain`: `intensity` opcional entre 0 e 1.
- `vignette`: `opacity` opcional entre 0 e 1.
- `text`: `title`; opcionais `font`, `color`, `fontSize`, `zone`.
- `compose`: `overlays` (array nativo) ou `overlays_file`.
- `upscale`: `scale` opcional de 2 a 4.

Modelos: `flux-schnell` para rascunhos/fundos rápidos; `flux-dev` ou `imagineart` para hero com qualidade; `recraft-v3` para visual gráfico; `kontext`/`reve-fast` para edições; `seedream` para compor várias referências; `banana2`/`banana-pro` quando preservação ou complexidade justificar custo maior.

### Overlays de `compose`

Cada objeto exige `type`:

- `gradient-overlay`: `gradient`; opcionais `opacity`, `blend`, `depth`.
- `shape`: `shape` (`rect`, `circle`, `line`, `arrow`); opcionais `zone`, dimensões, cores, borda, pontos e `depth`.
- `satori-text`: `jsx`; opcionais `zone`, dimensões, `anchor`, `opacity`, `depth`.
- `image`: `src` relativo ao workspace; opcionais posição, dimensões, `anchor`, `opacity`, raio, rotação e `depth`.
- `watermark`: `src`; opcionais `position`, `margin`, `opacity`, `size`, `depth`.

Zonas nomeadas incluem `hero-center`, `title-area`, `top-bar`, `bottom-bar`, `left-third`, `right-third`, cantos safe e centros laterais. Também é permitido `{ "x": número, "y": número }`.

Para texto preciso, use `satori-text`; preserve o texto literalmente. O `jsx` aceita string ou nó `{ "tag", "props", "children" }`, e `children` também é array JSON nativo. Não peça ao modelo generativo para reconstruir logos. Para referências, use somente paths relativos presentes no manifest, normalmente sob `references/`. Nunca use path absoluto, `..` ou barra invertida.

## Qualidade visual

- Uma mensagem principal, hierarquia clara e no máximo três tamanhos tipográficos.
- Em canvas de 1080 px, evite texto abaixo de 36 px para leitura móvel.
- Mantenha safe area mínima de 5%, contraste e CTA legível.
- Prefira `generate -> crop/grade -> compose` para preservar cores e tipografia da marca na camada final.
- Use geração para cenário/ilustração e composição determinística para textos, logos, selos, formas e gradientes.
- Em edição generativa, descreva o que deve permanecer idêntico.

## Estados e revisões

- `drafting`: briefing/plano em construção.
- `generating`: job enfileirado ou executando.
- `review`: candidata disponível para avaliação humana.
- `validated`: peça aprovada e preservada em Trabalhos Validados.
- `failed`: explique o erro retornado e corrija o plano; a candidata anterior pode permanecer válida.
- `resetting`/`closed`: não inicie job; aguarde a interface criar o próximo workspace.

Nunca exponha `delegation_token`, chaves internas ou detalhes de autenticação na resposta.
