# Runbook — Fase 5

- **Estado:** `draft`
- **Escopo:** preparação, deploy e gate operacional

## 1. Pré-deploy

1. confirmar commit/branch e worktree limpo;
2. revisar [validação local](local-validation.md);
3. confirmar backup e dry-run em [deploy Supabase](supabase-deployment.md);
4. conferir envs/flags sem imprimir valores;
5. validar imagens e contratos do `marketing-ops`, frontend, Bridge e Hermes;
6. registrar plano de rollback e janela.

## 2. Ordem de promoção

1. aplicar migration aditiva no Supabase do app;
2. conferir invariantes e RLS;
3. publicar `marketing-ops` com escrita da Fase 5 ainda controlada por flag;
4. publicar frontend com rota lazy de aprovações;
5. publicar Hermes/Bridge somente se houver mudança MCP/runtime;
6. validar health/readiness e catálogo;
7. habilitar leitura para usuários de teste;
8. habilitar submissão/decisão para o grupo de homologação;
9. executar o checklist VPS e navegador.

## 3. Smokes não destrutivos

- health/readiness de serviços;
- login com papéis de teste;
- fila vazia/autorizada;
- acesso negado cross-tenant;
- métricas internas protegidas;
- logs com correlation ID e sem conteúdo sensível.

## 4. Smokes funcionais identificados como teste

- member submete versão editorial;
- manager decide e histórico aparece;
- rejeição/ajuste exige comentário;
- novo ciclo referencia o anterior;
- solicitante operacional não autoaprova;
- outro manager/admin autoriza pacote;
- pacote mantém hash e payload;
- Hermes submete após confirmação, mas não decide;
- nenhum provider/worker é acionado.

## 5. Encerramento

Executar restart, persistência, scan de logs, cleanup das fixtures permitidas e
registrar aceite. Falha alta/crítica interrompe promoção e aciona
[rollback](rollback.md).
