# SOP: Geração de Banners ENS (Banner Generation)

## Objetivo
Gerar um banner PNG personalizado a partir de um template da biblioteca, substituindo iterativamente fundo e textos via Imagen 3, orquestrado por Gemini Flash.

## Entradas (Input JSON)
```json
{
  "request_meta": {
    "canal": "01_feed_instagram",
    "kv": "graduacao"
  },
  "content_keys": {
    "etiqueta": "string",
    "titulo": "string",
    "frase": "string",
    "box1": "string",
    "box2": "string | null",
    "persona": "string (descrição visual para geração do fundo)"
  }
}
```

## Ferramentas a Executar (em ordem)
1. `execution/select_template.py` → encontra o PNG base em `templates_library/{canal}/{kv}/`
2. `execution/orchestrate_prompt.py` → envia template + content_keys ao Gemini Flash → recebe plano JSON com 3 steps
3. `execution/banner_pipeline.py` → executa os 3 steps sequencialmente via Imagen 3

## Saída
- PNG final salvo em `outputs/{canal}_{kv}_{timestamp}.png`
- Arquivos intermediários em `.tmp/` (podem ser apagados)

## Edge Cases
| Situação | Comportamento |
|---|---|
| `box2` vazio ou nulo | Step 3 usa prompt de remoção do elemento visual |
| Template não encontrado | `TemplateNotFoundError` com mensagem clara do path esperado |
| Safety Filter (Imagen 3) | Retry automático até 3×. Se persistir, lançar `SafetyFilterError` |
| Gemini retorna JSON inválido | Parse com fallback → logar erro → re-tentar 1× |
| Arquivo output já existe | Sobrescrever (timestamp no nome garante unicidade) |

## Diretrizes de Prompt (Imagen 3)
- **Rodada 1 (Background)**: Sempre usar `mask_mode="background"`. Reforçar proteção de logos/cores da marca com negative_prompt.
- **Rodada 2 (Texto Macro)**: `mask_mode="automatic"`. Especificar cor e estilo da fonte original.
- **Rodada 3 (Texto Micro)**: `mask_mode="automatic"`. Preservar ícones e shapes dos box badges.

## Negative Prompt Padrão (aplicar em todas as rodadas)
```
distorted logo, wrong colors, blurry text, watermark, low quality, deformed hands, blue color overlay, changed brand colors
```

## Notas de API (Vertex AI Imagen 3)
- Modelo preferido: `imagen-3.0-capability-001` (suporta edit_image)
- Região: `us-central1`
- Se `edit_image` não disponível na região → fallback para `imagen-3.0-generate-001` com prompt de inpainting completo
- Autenticação via `GOOGLE_APPLICATION_CREDENTIALS` (Service Account JSON)

## Aprendizados (atualizar conforme descobertas)
- Safety Filter é acionado por prompts com texto de marcas + fotos de pessoas. Reformular prompt para "professional person" em vez de dados demográficos específicos se necessário.
- O pipeline automático ativo é: Step 1 (textos/boxes), Step 2 (persona/fundo), resize final. O antigo Step 3/Validador AI fica fora do fluxo principal para evitar regressões de texto, KV e qualidade da persona.
- `content_keys` continuam sendo a fonte de verdade textual. `template_context.json` pode conter textos base antigos e deve servir apenas como referência visual de estilo/geometria.
- Step 1 pode aplicar direção de arte textual mínima quando o conteúdo tiver comprimento diferente do template: título pode quebrar em até 2 linhas equilibradas, frase pode ocupar 1 ou 2 linhas, e etiqueta/título/frase podem ter ajuste leve de escala/entrelinha/espaçamento para preservar hierarquia e harmonia. Essa liberdade não autoriza reescrever textos, alterar tamanho de fonte das boxes, KV/persona/logo/grafismos nem interferir no ajuste manual, que continua sendo prompt cru do usuário.
- Preservação de branco deve ser dinâmica por template/KV: fundos brancos de etiquetas/boxes permanecem #FFFFFF, mas textos e ícones dentro dessas boxes seguem a cor primária definida pelo KV. Não aplicar repaint determinístico global de branco, pois diferentes canais e KVs podem ter papéis de cor distintos.
- Ícones de box são parte interna da própria box: é proibido criar ícone solto/standalone ou ícone externo à box. Se ícone + texto não couberem, redimensionar a box o mínimo necessário, preservando padding, altura, estilo, texto e cor do template.
- O resize final deve preservar exatamente as dimensões do template/canal. Nitidez deve ser tratada no algoritmo de downsample (LANCZOS + sharpen suave), sem alterar o canvas final.
