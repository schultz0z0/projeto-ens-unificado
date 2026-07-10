# PRD — Fase 6: Execução Assistida Piloto

- **Status:** draft
- **Dependência:** Fase 5 concluída
- **Resultado:** um canal real executado por worker com aprovação, idempotência e evidência

## Resumo

Esta fase conecta um único canal a um worker interno. A execução parte de `action_package` aprovado e imutável, usa outbox transacional e registra cada tentativa. O Hermes não reconstrói o conteúdo durante o envio.

## Problema

Planejar e aprovar sem executar mantém o Nexus AI como ferramenta de organização. A passagem para operação real aumenta muito o risco: duplicidade, público errado, ausência de consentimento, falha parcial e falta de evidência.

## Objetivos

- executar um canal piloto de forma segura;
- impedir envios duplicados;
- preservar exatamente o payload aprovado;
- validar consentimento, opt-out e elegibilidade;
- suportar retry e recuperação;
- oferecer preview, teste e cancelamento seguro;
- registrar resultado do provedor e auditoria.

## Não objetivos

- integrar vários canais;
- permitir disparo sem aprovação;
- criar automação autônoma pelo Hermes;
- construir CRM completo;
- otimizar campanhas automaticamente;
- garantir atribuição avançada.

## Decisão bloqueante

Antes do design técnico, escolher:

- canal piloto: e-mail ou WhatsApp;
- provedor;
- credenciais e ambiente sandbox;
- origem autorizada da audiência;
- requisitos jurídicos e operacionais;
- limites de volume.

O PRD não presume provedor específico.

## Fluxo

```text
approval_request aprovada
→ action_package verificado
→ validação pré-execução
→ outbox
→ worker adquire lease
→ provedor
→ resultado/tentativa
→ estado final + auditoria + evento
```

## Requisitos funcionais

### F6-RF-01 — Pacote elegível

Somente pacote aprovado, não expirado, não invalidado e ainda não executado pode entrar na outbox.

### F6-RF-02 — Validação pré-execução

Revalidar campanha, versão/hash, audiência, consentimento, opt-out, horário, timezone, configuração do provedor e limites.

### F6-RF-03 — Dry run

Permitir validação sem envio real, mostrando destinatários agregados, conteúdo, variáveis ausentes e bloqueios. PII deve ser minimizada na interface.

### F6-RF-04 — Envio de teste

Permitir envio apenas a destinatários allowlisted, claramente marcado como teste e separado de métricas reais.

### F6-RF-05 — Outbox

Criação do job e marcação do pacote ocorrem transacionalmente. O worker não depende de evento que possa ser perdido.

### F6-RF-06 — Lease

Worker adquire job com lease e heartbeat. Reinício libera/recupera trabalho sem execução duplicada.

### F6-RF-07 — Idempotência externa

Usar chave do provedor quando disponível e chave interna por pacote/destinatário/lote.

### F6-RF-08 — Lotes

Audiências maiores são divididas em lotes com limite configurável, progresso e resultado parcial.

### F6-RF-09 — Retry

Somente falhas transitórias recebem retry com backoff e jitter. Falhas permanentes não são repetidas automaticamente.

### F6-RF-10 — Dead-letter

Após limite, job vai para `dead_letter` com diagnóstico. Reprocessamento exige permissão, nova validação e auditoria.

### F6-RF-11 — Cancelamento

Cancelar jobs ainda não adquiridos; para jobs em execução, aplicar capacidade real do provedor e informar limite. Nunca declarar cancelamento retroativo de envio concluído.

### F6-RF-12 — Resultado

Registrar ID do provedor, status normalizado, timestamps, erro categorizado e resposta redigida.

### F6-RF-13 — Webhooks

Validar assinatura, idempotência, timestamp e replay. Eventos desconhecidos são armazenados/observados conforme política, sem alterar estado indevidamente.

### F6-RF-14 — Hermes

Hermes pode preparar, explicar status e ajudar a diagnosticar. Não chama o provedor e não reescreve payload aprovado.

## Estados

`queued`, `running`, `succeeded`, `failed`, `cancelled`, `dead_letter`.

Resultado por destinatário/lote pode usar estados mais granulares definidos no design técnico.

## Dados

- `action_packages`;
- `execution_jobs`;
- `execution_attempts`;
- `execution_recipients` ou lotes, conforme privacidade;
- `provider_events`;
- `suppression_entries`/opt-out quando necessário;
- auditoria e eventos.

## LGPD e segurança

- base legal e finalidade documentadas;
- minimização de PII;
- consentimento/opt-out verificados no momento do envio;
- lista de supressão aplicada por último;
- secrets apenas no worker;
- webhook assinado;
- retenção definida;
- acesso restrito a audiência e resultados;
- exportações e logs redigidos;
- teste de envio allowlisted;
- limites e kill switch.

## UX

Preview deve destacar campanha, canal, audiência, contagem, exclusões, data/hora, timezone, versão/hash e aprovador. Progresso distingue queued, enviado ao provedor, entregue quando disponível e falha.

## Observabilidade

- profundidade da fila;
- tempo em fila;
- jobs por estado;
- retries/dead-letter;
- taxa do provedor;
- duplicidades bloqueadas;
- opt-outs aplicados;
- webhook inválido;
- correlation ID até aprovação;
- kill switch e alertas.

## Critérios de aceite

- [ ] Somente pacote aprovado e válido entra na fila.
- [ ] Hash diferente bloqueia execução.
- [ ] Dry run não envia mensagem.
- [ ] Envio de teste usa allowlist.
- [ ] Opt-out é aplicado imediatamente antes do envio.
- [ ] Retry não duplica mensagem.
- [ ] Reinício do worker não duplica job.
- [ ] Falha permanente não entra em loop.
- [ ] Dead-letter possui diagnóstico e reprocessamento auditado.
- [ ] Webhook inválido não altera estado.
- [ ] Cancelamento informa limites reais.
- [ ] Payload enviado é o aprovado.
- [ ] Hermes não possui credencial do provedor.
- [ ] Logs não expõem PII/secrets indevidos.

## Testes

Worker unitário com relógio controlado; integração com fake provider; idempotência e lease; retry/dead-letter; assinatura/replay de webhook; consentimento/opt-out; E2E sandbox; caos com reinício e timeout.

## Gate local

Fake/sandbox provider, nenhum destinatário real, dry run, allowlist, worker restart, falhas, kill switch, métricas, migrations e rollback.

## Gate VPS

Primeiro smoke sem envio, depois envio allowlisted autorizado. Conferir secrets, rede, webhook/TLS, timezone, logs, fila, reinício, backup e rollback. Envio real amplo exige aceite separado.

## Riscos

| Risco | Mitigação |
|---|---|
| Envio duplicado | Outbox, lease e idempotência interna/externa |
| Público incorreto | Pacote congelado + dry run + revalidação |
| Violação de opt-out | Lista aplicada no último momento |
| Provedor instável | Retry seletivo, backoff e dead-letter |
| PII em logs | Redação e testes |
| Canal ampliar escopo | Um provedor e um caso piloto |

## Gate de saída

A Fase 7 inicia quando um caso piloto autorizado foi executado ponta a ponta, sem duplicidade, com evidência, observabilidade e recuperação verificadas na VPS.
