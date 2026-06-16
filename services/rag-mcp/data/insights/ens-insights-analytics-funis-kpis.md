---
title: "ENS Insights - Analytics, funis e KPIs para marketing"
source_type: "markdown_report_synthesis"
source_url: "deep-research-report.md"
---

# ENS Insights - Analytics, funis e KPIs para marketing

## Uso no Hermes

Use este documento para responder perguntas sobre métricas, funis, dashboards, dados de marketing, análise de campanhas e decisões de performance da ENS.

Não use este documento como fonte de fatos de curso. Para cursos, consulte `courses`.

## North star metric

A métrica norte da ENS não deve ser apenas volume de leads.

Recomendação:

Receita líquida incremental por curso, programa ou coorte.

Guardrails:

- CAC
- LTV/CAC
- taxa de lead qualificado
- taxa de matrícula
- inadimplência inicial
- churn ou abandono
- ROAS
- payback

Leitura obrigatória:

- produto
- canal
- campanha
- praça
- persona
- corretora ou parceiro
- faixa de preço
- coorte temporal

## Funil base da ENS

1. Awareness: mídia paga, orgânico, social, referência.
2. Visita qualificada: página de curso, permanência, scroll, CTA.
3. Lead: Tenho interesse, WhatsApp, newsletter, formulário.
4. MQL: perfil aderente ao curso ou programa.
5. Lead trabalhado: contato comercial ou automação.
6. Aplicação ou proposta: documentação, edital, condição comercial.
7. Matrícula ou contratação: pagamento confirmado.
8. Ativação: acesso, primeira aula, onboarding.
9. Retenção e expansão: renovação, nova compra, indicação, upsell.

## Variações de funil

O agente deve reconhecer três variações:

- captação educacional B2C;
- parcerias com corretoras e empresas;
- funil de seguros e finanças com jornada consultiva.

Em educação especializada e seguros, a compra raramente é um clique único. Muitas conversões passam por conversa consultiva, comparação de programas, preço, timing de carreira e validação de confiança.

## KPIs principais

Aquisição qualificada:

- visitas qualificadas divididas por visitas totais;
- usuários engajados por canal.

Lead rate:

- leads divididos por sessões qualificadas.

MQL rate:

- MQLs divididos por leads.

SQL ou lead trabalhado:

- leads trabalhados divididos por MQLs.

Taxa de matrícula:

- matrículas pagas divididas por leads, MQLs ou propostas.

CAC:

- mídia, martech e esforço comercial atribuível divididos por alunos adquiridos.

ROAS:

- receita atribuída dividida por gasto de mídia.

LTV:

- margem líquida esperada ao longo da relação.

Churn ou abandono:

- clientes ou alunos perdidos divididos pela base ativa no período.

Payback:

- tempo até margem acumulada recuperar CAC.

Receita por lead:

- receita dividida por leads.

## Eventos recomendados

Mapear eventos de funil com nomes consistentes:

- `generate_lead`
- `qualify_lead`
- `working_lead`
- `close_convert_lead`
- `sign_up`
- `purchase`

Quando houver valor econômico, capturar:

- `value`
- `currency`
- `transaction_id`

## Benchmark

Evite médias genéricas de mercado para CPL, CPA ou ROAS.

Melhor benchmark operacional:

ENS contra ENS ontem, por coorte, canal, criativo, campanha, curso e praça.

## Regras para o Hermes

- Sempre perguntar ou inferir a janela temporal.
- Separar lead bruto de lead útil.
- Não comparar cursos com públicos diferentes sem aviso.
- Não apresentar causalidade quando houver apenas correlação.
- Quando faltar dado, formular hipótese e indicar dado necessário.
