# PRD — Fase 7: Performance, Diagnóstico e Aprendizado

- **Status:** draft
- **Dependência:** Fase 6 concluída
- **Resultado:** dados de execução convertidos em leitura confiável e aprendizado validado

## Resumo

A fase normaliza métricas, explicita qualidade e atribuição, cria painéis acionáveis e permite ao Hermes formular recomendações com evidência. Aprendizados aprovados podem ser promovidos para memória, sem copiar o banco transacional para RAG/Graph.

## Problema

Números sem definição, qualidade ou contexto podem orientar decisões erradas. O sistema precisa separar fato observado, hipótese do Hermes e aprendizado validado.

## Objetivos

- ingerir métricas com proveniência;
- definir KPIs e regras de qualidade;
- comparar campanha, canal e curso;
- identificar gargalos;
- gerar recomendações explicáveis;
- registrar hipóteses e decisões;
- promover aprendizado validado para memória.

## Não objetivos

- atribuição perfeita multicanal;
- BI corporativo completo;
- previsão autônoma de receita;
- alteração automática de campanhas;
- armazenar eventos brutos indefinidamente sem política.

## Usuários

- marketing operacional;
- managers;
- liderança;
- Hermes como analista;
- engenharia/operadores de dados.

## Requisitos funcionais

### F7-RF-01 — Catálogo de métricas

Cada métrica possui nome, definição, fórmula, granularidade, fonte, timezone, janela, owner, limitações e data de validade.

### F7-RF-02 — Ingestão idempotente

Eventos/métricas do provedor são normalizados com chave de origem. Reprocessamento não duplica valores.

### F7-RF-03 — Proveniência

Guardar provedor, conta, campanha/item, timestamp de evento, timestamp de ingestão e versão do transformador.

### F7-RF-04 — Qualidade

Detectar atraso, lacuna, duplicidade, valor impossível, quebra de schema e cobertura insuficiente.

### F7-RF-05 — Painel de campanha

Exibir objetivo, execução, métricas principais, tendência, itens relevantes, qualidade e recomendações.

### F7-RF-06 — Comparativos

Comparar períodos/campanhas somente quando definições e populações forem compatíveis. Mostrar ressalva quando não forem.

### F7-RF-07 — Funil

Implementar funil básico apenas com eventos/fontes confirmados. Etapas e denominadores devem ser explícitos.

### F7-RF-08 — Diagnóstico do Hermes

Hermes consulta métricas e qualidade por ferramenta estruturada, cita período/fonte e separa observação de inferência.

### F7-RF-09 — Recomendações

Cada recomendação contém evidência, hipótese, ação proposta, impacto esperado, confiança e risco.

### F7-RF-10 — Aprendizados

Usuário registra ou valida aprendizado ligado a campanha, dados, período e decisão.

### F7-RF-11 — Promoção para memória

Somente aprendizado durável e validado é enviado ao Graph/RAG apropriado, com referência à fonte operacional e autor da validação.

### F7-RF-12 — Correção/reprocessamento

Permitir reprocessar período/fonte com versionamento. Painéis indicam quando dados foram recalculados.

## KPIs candidatos

- enviados, entregues e falhos;
- abertura/clique quando aplicável e confiável;
- respostas;
- leads e leads qualificados;
- conversões/matrículas quando houver fonte;
- custo por lead/matrícula quando houver custo;
- receita atribuída sob regra explícita;
- tempo operacional e gargalo de produção.

Nenhum KPI é obrigatório sem fonte validada.

## Dados

- catálogo de métricas;
- eventos/métricas normalizados;
- snapshots/agregados;
- resultados de qualidade;
- recomendações;
- `campaign_learnings`;
- referências de promoção para Graph/RAG.

## UX

- ação e diagnóstico antes de volume de gráficos;
- período e timezone visíveis;
- definição acessível no contexto;
- qualidade e cobertura ao lado do número;
- sem falsa precisão;
- gráficos com alternativa tabular;
- recomendações distinguem fato, hipótese e ação.

## Segurança e privacidade

- agregação por padrão;
- PII fora de dashboards quando não necessária;
- permissões por campanha/escopo;
- retenção e exclusão definidas;
- exportações auditadas;
- queries limitadas;
- nenhuma métrica sensível em labels de observabilidade.

## Observabilidade

- freshness;
- cobertura;
- duplicidade;
- falha de ingestão;
- duração de reprocessamento;
- queries lentas;
- recomendação aceita/rejeitada;
- promoção de aprendizado;
- divergência entre provedor e agregado.

## Critérios de aceite

- [ ] Métricas exibidas têm definição e fonte.
- [ ] Ingestão repetida não duplica.
- [ ] Atraso e lacuna aparecem no painel.
- [ ] Comparativo incompatível é bloqueado ou sinalizado.
- [ ] Funil mostra denominadores e cobertura.
- [ ] Hermes cita período, fonte e qualidade.
- [ ] Inferência é identificada como hipótese.
- [ ] Recomendação possui evidência e confiança.
- [ ] Aprendizado exige validação humana para promoção.
- [ ] Graph/RAG recebe referência, não cópia indiscriminada.
- [ ] Reprocessamento é auditado e versionado.
- [ ] Papéis e tenant limitam acesso.

## Testes

Transformações com fixtures; deduplicação; timezone/janelas; qualidade; reprocessamento; permissões; contrato das ferramentas; E2E execução → métrica → painel → aprendizado → memória.

## Gate local

Fontes fake/sandbox, dados conhecidos, reconcilição esperada, falhas de qualidade, dashboards, acessibilidade, ferramentas Hermes e rollback.

## Gate VPS

Ingestão controlada, freshness, volumes, queries, logs, segurança, reprocessamento pequeno, backup e comparação com fonte.

## Riscos

| Risco | Mitigação |
|---|---|
| Número sem confiança | Catálogo + qualidade + proveniência |
| Atribuição enganosa | Regra explícita e ressalvas |
| Dashboard grande cedo | KPIs ligados a decisões reais |
| Hermes superafirmar causalidade | Separar observação/inferência |
| Duplicar memória | Promoção seletiva com referência |

## Gate de saída

A Fase 8 inicia quando métricas e qualidade sustentam alertas confiáveis, recomendações possuem evidência e o ciclo de aprendizado validado foi comprovado na VPS.
