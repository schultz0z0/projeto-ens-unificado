# Rollback — Fase 5

- **Estado:** `draft`
- **Estratégia:** flags + imagem anterior + forward-fix

## Princípios

- não apagar solicitações, decisões, pacotes, auditoria ou migrations;
- desabilitar escrita antes de trocar imagens;
- preservar leitura quando segura;
- migration aplicada recebe forward-fix;
- restore só com backup validado e autorização explícita.

## Cenários

### Falha de frontend

Desabilitar rota/flag da Fase 5 e reimplantar imagem anterior. O backend pode
continuar sem exposição visual.

### Falha de API/domínio

Desabilitar submissão e decisão, manter leitura diagnóstica autorizada e
reimplantar `marketing-ops` anterior. Pacotes não são executáveis na Fase 5.

### Falha de MCP/Hermes

Retirar actions de submissão do catálogo/flag e reimplantar runtime anterior.
REST manual permanece separado.

### Falha de schema

Bloquear tráfego de escrita. Preferir forward-fix aditivo. Restore completo
somente se o impacto justificar perda do delta e houver autorização.

## Verificação pós-rollback

- serviços healthy;
- campanhas, itens, conteúdo e chat das Fases 1–4 preservados;
- nenhuma execução externa;
- flags efetivas confirmadas;
- logs e correlation IDs registrados;
- incidente e decisão documentados.
