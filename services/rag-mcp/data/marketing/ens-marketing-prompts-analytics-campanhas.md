---
title: "ENS Marketing - Prompts para campanhas e analytics"
source_type: "markdown_report_synthesis"
source_url: "deep-research-report.md"
---

# ENS Marketing - Prompts para campanhas e analytics

## Uso no Hermes

Use este documento quando o usuário pedir prompts, roteiros de análise, briefings de campanha, variações de copy orientadas por dados ou estrutura de resposta para marketing da ENS.

Para resultados numéricos e diagnósticos, consulte também a coleção `insights`.

## Padrão de prompt

Todo prompt analítico ou criativo deve trazer:

- contexto explícito;
- janela temporal;
- métrica alvo;
- restrições;
- formato de saída;
- prioridade por evidência.

## Bloco YAML recomendado

```yaml
contexto_negocio:
  programa: "MBA Finanças e Seguros"
  canal: "google_search"
  janela_analise: "ultimos 28 dias"
  objetivo: "maximizar matriculas"
  kpi_principal: "cac"
  guardrails: ["mql_rate", "roas", "inadimplencia_30d"]
  persona: "profissional de seguros em transicao para gestao"
  restricoes:
    - "nao usar dados pessoais sensiveis"
    - "considerar LGPD e consentimento"
    - "explicar com evidencias e citar fontes"
```

## Diagnóstico de funil

Prompt:

Analise o funil do programa `{programa}` no período `{periodo}`. Compare `{canal_atual}` com `{canal_base}`. Identifique a maior ruptura entre visita qualificada, lead, MQL, SQL e matrícula. Traga hipóteses ordenadas por evidência, impacto estimado e próximos testes.

## Queda de performance

Prompt:

Explique a queda de `{kpi}` na campanha `{campanha}` entre `{data_inicio}` e `{data_fim}`. Considere criativo, frequência, audiência, landing page, speed-to-lead e mudança de atribuição. Responda em cinco blocos: sintomas, causa provável, evidência, risco e ação.

## Realocação de orçamento

Prompt:

Com base nos dados dos últimos `{janela_dias}` dias, recomende redistribuição de orçamento entre `{canais}` para maximizar `{meta}` sem ultrapassar `{limite_cac}`. Justifique com dados por coorte, saturação e qualidade do lead.

## Plano de recuperação

Prompt:

Monte um plano de recuperação de 14 dias para o curso `{programa}`, cuja taxa de matrícula caiu para `{valor_kpi}`. Priorize ações de alto impacto e baixa dependência técnica.

## Copy

Prompt:

Gere 10 variações de copy para `{programa}` voltadas à persona `{persona}`. Use tom `{tom}`, destaque `{beneficio_principal}`, inclua objeção `{objecao}` e CTA para `{cta}`. Respeite restrições regulatórias e evite promessas absolutas.

## Roteiros por funil

Prompt:

Crie criativos separados para topo, meio e fundo de funil do produto `{produto}`. Para cada estágio, proponha headline, descrição, ângulo de prova, CTA e hipótese de performance.

## Teste A/B

Prompt:

Desenhe um teste A/B para melhorar `{kpi}` na landing page `{landing}`. Informe hipótese, variável isolada, métrica primária, métricas de guarda, amostra mínima proxy e critério de encerramento.

## Regras de segurança

- Nunca gere recomendação numérica sem explicitar fonte, janela e limitações.
- Não misture dados de campanhas diferentes sem segmentação.
- Não usar dados pessoais sensíveis.
- Para copy de curso, validar fatos na coleção `courses`.
- Para memória permanente de marketing, salvar apenas após validação explícita do usuário.
