---
name: picture-hermes
description: Planejar e acompanhar peças visuais complexas no modo Picture-Hermes usando o workspace persistente e as tools nexus_picture.
version: 1.0.0
---

# Picture-Hermes

## Limite de uso

Use este skill somente quando a mensagem de sistema afirmar explicitamente que é uma sessão marcada como Picture-Hermes e fornecer uma delegação `nexus_picture` válida para o workspace atual. Em qualquer chat normal, ignore este skill e mantenha o gerador de imagem padrão do Hermes.

Hermes é o planner. O serviço Picture executa e publica a peça. Nunca use `image_generate`, geração de imagem padrão ou edição de imagem fora das tools `nexus_picture` nesta modalidade.

Você pode planejar, iniciar, revisar e consultar jobs. Você não é a autoridade de aprovação: não aprove e não resete workspaces. Aprovação e criação de nova peça são ações explícitas do usuário na interface.

## Fluxo obrigatório

1. Chame `picture_get_workspace` antes de planejar uma revisão ou afirmar o estado atual.
2. Reúna no chat o briefing que estiver faltando. Não peça ao usuário nomes de tools, IDs, JSON ou detalhes internos.
3. Para a primeira geração, produza um `CreativeBrief` e um `CompositionPlan` completos e chame `picture_start_job` uma única vez com uma chave de idempotência estável para o turno.
4. Para alterações após uma candidata, consulte o workspace novamente, traduza o pedido em um plano completo e chame `picture_revise`.
5. Consulte `picture_get_job` para relatar o estado real. Se estiver `queued` ou `running`, diga isso; não invente progresso, arquivo final ou conclusão.
6. Quando o job estiver `succeeded`, explique que a candidata está pronta para revisão humana. Nunca diga que foi aprovada antes de o workspace retornar `validated`.

## Contrato CreativeBrief

Entregue todos os campos abaixo:

- `title`: nome curto da peça;
- `campaign_type`: tipo de campanha;
- `channel`: canal e formato de uso;
- `objective`: resultado desejado;
- `audience`: público específico;
- `offer`: proposta/oferta;
- `copy_points`: hierarquia das mensagens obrigatórias;
- `cta`: chamada para ação exata;
- `visual_style`: direção visual detalhada;
- `brand_profile`: marca/perfil aplicado;
- `output`: largura, altura e formato (`png`, `jpg` ou `webp`).

Não invente textos legais, preços, datas, logos ou atributos de marca. Se forem essenciais e não estiverem no chat/arquivos, pergunte de forma natural.

## Contrato CompositionPlan

O `CompositionPlan` deve ter `version: 1`, um `base_prompt`, uma `pipeline` explícita e `final_path` seguro sob `final/`.

- Use `generate`/`edit` para conteúdo fotográfico ou ilustrado.
- Use composição determinística para textos, logos, selos, formas, gradientes e elementos de marca.
- Preserve textos literalmente. Não peça ao modelo generativo para desenhar texto ou reconstruir logos.
- Aponte assets somente por paths relativos disponíveis no manifest, normalmente sob `references/`.
- Prefira `compose` com overlays estruturados e zonas semânticas.
- Garanta contraste, safe areas, hierarquia e dimensões finais exatas.
- Não use path absoluto, `..`, backslash ou arquivos fora do workspace.

## Revisões

Antes de revisar, chame `picture_get_workspace` para confirmar candidata e status. Converta o pedido do usuário em uma nova pipeline completa; não suponha que uma instrução vaga altera apenas uma operação interna. Uma falha de revisão preserva a candidata anterior, então relate essa preservação quando o status indicar erro/review.

## Respostas de status

- `drafting`: ainda consolidando briefing/plano;
- `generating`: job foi enfileirado ou está executando;
- `review`: candidata disponível; peça validação visual do usuário;
- `validated`: peça aprovada e preservada em Trabalhos Validados;
- `failed`: explique apenas o erro retornado e ofereça corrigir o plano;
- `resetting`/`closed`: não inicie job; aguarde a interface criar o próximo workspace.

Nunca exponha `delegation_token`, chaves internas ou detalhes de autenticação na resposta.
