# PRD — Fase 8: Hermes Proativo e Escala Operacional

- **Status:** draft
- **Dependência:** Fase 7 concluída
- **Resultado:** alertas e recomendações antecipam problemas sem gerar ruído ou ações não autorizadas

## Resumo

O Hermes passa a iniciar alertas e resumos com base em regras e dados confiáveis. Proatividade será controlada por preferências, frequência, confiança e política de ação. Sugestão não equivale a execução.

## Problema

Mesmo com dashboards, usuários precisam lembrar de procurar riscos. Alertas mal desenhados, porém, geram fadiga, duplicidade e perda de confiança. O sistema precisa priorizar situações acionáveis e explicar por que notificou.

## Objetivos

- detectar ausência de próximo passo, atraso e risco;
- resumir operação em cadência configurada;
- sugerir ações com evidência;
- controlar frequência e canais;
- aprender com feedback sobre utilidade;
- escalar jobs proativos de forma observável;
- manter aprovação humana para efeitos sensíveis.

## Não objetivos

- piloto automático de marketing;
- disparo autônomo;
- alteração silenciosa de campanha;
- notificação em todos os canais;
- recomendação sem fonte/confiança;
- criar um sistema genérico de automação empresarial.

## Casos iniciais

- campanha ativa sem próximo item;
- item atrasado ou bloqueado;
- fechamento de turma próximo;
- aprovação próxima da expiração;
- material parado em revisão;
- execução com falhas acima do limite;
- métrica fora de faixa com qualidade suficiente;
- resumo diário/semanal do escopo do usuário.

## Requisitos funcionais

### F8-RF-01 — Regras versionadas

Cada regra possui versão, descrição, fonte, condição, severidade, cooldown, owner, escopo e ação sugerida.

### F8-RF-02 — Elegibilidade

Antes de alertar, verificar permissão, tenant, qualidade/freshness, cooldown, duplicidade, preferência e estado atual.

### F8-RF-03 — Deduplicação

O mesmo fato não cria alertas repetidos enquanto a condição não mudar ou o cooldown não expirar.

### F8-RF-04 — Priorização

Ordenar por severidade, urgência, impacto e confiança. Limitar volume por usuário/período.

### F8-RF-05 — Explicação

Alerta contém o que ocorreu, evidência, impacto, confiança, ação sugerida e deep link.

### F8-RF-06 — Resumos

Resumo diário/semanal agrupa mudanças e pendências, sem repetir todos os alertas individualmente.

### F8-RF-07 — Preferências

Usuário controla cadência, horário silencioso, tipos e canais permitidos dentro da política organizacional.

### F8-RF-08 — Feedback

Permitir útil, não útil, já resolvido, silenciar regra e motivo opcional. Feedback alimenta avaliação, não altera regra automaticamente.

### F8-RF-09 — Ação sugerida

Hermes pode abrir conversa ou preparar proposta. Mutação segue confirmação e aprovação das fases anteriores.

### F8-RF-10 — Scheduler/worker

Rotinas recorrentes usam serviço interno com lease, idempotência, retry, backoff e observabilidade.

### F8-RF-11 — Kill switch

Admin pode pausar regra, canal ou proatividade global sem desligar o workspace.

### F8-RF-12 — Avaliação

Medir precisão operacional, taxa de ação, dismiss, silenciamento, repetição e tempo até resolução.

## Dados

- regras e versões;
- preferências;
- avaliações executadas;
- alertas/dedup keys;
- entregas e canais;
- feedback;
- scheduler jobs;
- auditoria.

## UX

- caixa de alertas in-app como canal inicial recomendado;
- severidade não depende apenas de cor;
- ação principal clara;
- explicar fonte e timestamp;
- permitir silenciar sem esconder alertas críticos definidos pela política;
- resumos compactos;
- deep links para contexto.

## Segurança e governança

- alertas respeitam acesso atual;
- revogação remove futuras entregas;
- conteúdo não vaza dados de outra campanha/tenant;
- canais externos minimizam PII;
- regras críticas exigem aprovação para mudança;
- nenhuma recomendação concede permissão;
- kill switch auditado;
- ações sensíveis seguem aprovação normal.

## Observabilidade

- avaliações por regra;
- alertas gerados/suprimidos;
- deduplicações;
- atraso do scheduler;
- falha de entrega;
- feedback útil/não útil;
- alertas sem ação;
- tempo até resolução;
- volume por usuário;
- regras pausadas.

## Critérios de aceite

- [ ] Regra só alerta com dados frescos e confiáveis.
- [ ] Usuário recebe apenas alertas autorizados.
- [ ] Mesmo fato respeita deduplicação/cooldown.
- [ ] Volume máximo é aplicado.
- [ ] Alerta explica evidência, confiança e ação.
- [ ] Deep link abre o contexto correto.
- [ ] Preferências e horário silencioso funcionam.
- [ ] Feedback é registrado sem autoalterar regra.
- [ ] Scheduler reinicia sem duplicar alertas.
- [ ] Kill switch interrompe novas entregas.
- [ ] Hermes prepara proposta, mas não executa ação sensível.
- [ ] Resumo não repete ruído excessivo.
- [ ] Tenant e revogação são respeitados.

## Testes

Regras com relógio controlado; freshness; cooldown/dedup; permissões; preferências; limites; scheduler restart; falha de canal; kill switch; E2E alerta → deep link → proposta → fluxo aprovado.

## Gate local

Dados sintéticos determinísticos, relógio controlado, volume, dedup, preferências, kill switch, acessibilidade, falhas e persistência.

## Gate VPS

In-app para grupo piloto, scheduler, timezone, reinício, logs, volume, regras pausadas, smoke não destrutivo e rollback. Canais externos exigem aceite adicional.

## Métricas de sucesso

- alta proporção de alertas considerados úteis;
- baixa taxa de silenciamento por ruído;
- redução de campanhas sem próximo passo;
- menor tempo até resolver pendências;
- zero ação sensível executada sem autorização;
- zero vazamento entre tenants/escopos.

Metas numéricas serão definidas com baseline da Fase 7.

## Riscos

| Risco | Mitigação |
|---|---|
| Fadiga de alerta | Cooldown, limites, agrupamento e feedback |
| Recomendação com dado ruim | Gate de freshness/qualidade |
| Ação autônoma indevida | Proposta separada de mutação/execução |
| Scheduler duplicar | Lease e idempotência |
| Preferências fragmentadas | Modelo simples e defaults organizacionais |
| Métrica de vaidade | Avaliar resolução e utilidade |

## Gate de saída

A fase fica concluída quando o grupo piloto recebe alertas úteis, controláveis e auditáveis, o scheduler resiste a reinícios, não há vazamento ou ação não autorizada e a homologação VPS está aprovada.
