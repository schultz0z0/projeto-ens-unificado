---
title: "ENS Insights - Arquitetura de dados e RAG para marketing"
source_type: "markdown_report_synthesis"
source_url: "deep-research-report.md"
---

# ENS Insights - Arquitetura de dados e RAG para marketing

## Uso no Hermes

Use este documento para orientar decisões sobre dados, arquitetura analítica, RAG, metadados, dashboards e governança LGPD para o agente de marketing da ENS.

## Quatro pilares recomendados

1. Métrica padronizada.
2. Lakehouse de eventos e entidades.
3. Camada RAG com recuperação híbrida e metadados ricos.
4. Governança LGPD-by-design.

## Famílias de dados

Comportamento:

- site ENS;
- landing pages;
- GA4;
- Search Console;
- eventos de CTA;
- navegação e engajamento.

Entidade comercial:

- CRM;
- leads;
- MQL;
- SQL;
- consultores;
- parceiros;
- corretoras;
- status de negociação.

Resultado financeiro:

- matrículas;
- pagamentos;
- receita;
- margem;
- inadimplência;
- cancelamento;
- renovação;
- upsell.

Inteligência externa:

- SUSEP;
- Open Finance;
- Open Insurance;
- tendências de mercado;
- dados setoriais públicos.

## Fontes prioritárias

- Site ENS e landing pages.
- GA4.
- CRM.
- Automação de marketing.
- ERP financeiro e pagamentos.
- LMS ou portal acadêmico.
- WhatsApp, telefonia e contact center.
- Google Ads.
- Meta Ads e Conversions API.
- Search Console.
- SUSEP e painéis setoriais.
- Dados de corretoras e parceiros.

## Documentos RAG recomendados

Documentos semiestruturados:

- glossário de métricas;
- playbooks;
- políticas;
- FAQs;
- descrições de cursos;
- regras comerciais;
- benchmarking setorial;
- relatórios executivos.

Documentos derivados de dados:

- resumos diários por campanha;
- snapshots semanais por curso;
- resumos por corretora ou parceiro;
- alertas de anomalia;
- narrativas automáticas de dashboard;
- cards de aprendizado de testes A/B.

## Metadados mínimos para RAG

Todo documento analítico salvo no RAG deve carregar, quando aplicável:

- sistema de origem;
- tipo de entidade;
- ID de entidade;
- título legível;
- timestamp do evento;
- validade inicial e final;
- canal;
- linha de produto;
- campanha;
- criativo;
- praça;
- audiência;
- status de consentimento;
- classificação de PII;
- política de retenção;
- hash ou checksum;
- versão do modelo de embedding.

## Recuperação avançada

Estratégia preferida:

- busca lexical para siglas, nomes de cursos, códigos de campanha e termos regulatórios;
- busca vetorial para perguntas conceituais;
- filtros por coleção, fonte, data, curso e campanha;
- reranqueamento quando disponível;
- resposta com evidência e aviso de limitação.

## Ordem operacional de seis meses

1. Unificar taxonomia de eventos e dicionário de KPIs.
2. Consolidar GA4, CRM, mídia paga e financeiro em repositório analítico.
3. Montar dashboards executivos e de performance.
4. Ativar modelos preditivos de propensão, churn e upsell.
5. Expor artefatos analíticos ao agente de IA com RAG, filtros e perguntas padronizadas.

## Regras para o Hermes

- Não salvar dados pessoais sensíveis no RAG.
- Preferir agregados e resumos executivos.
- Sempre registrar período, fonte e limitação.
- Para insight novo, usar `ens_rag_save_insight`.
- Para resposta sem evidência, declarar ausência de base.
