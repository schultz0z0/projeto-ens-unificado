# LGPD, minimização e retenção da Fase 2

- **Estado:** `documented_pending_task_8_and_vps_validation`
- **Escopo:** campanhas, participantes, materiais, timeline, auditoria, logs e métricas do Marketing Ops
- **Fora do escopo:** definir base legal ou prazo contratual definitivo sem validação jurídica

## Princípios

- coletar somente o necessário para operar, autorizar e auditar campanhas;
- manter bytes no Artifact Server e somente metadata/ID no Marketing Ops;
- consultar o RAG por MCP read-only e persistir apenas a referência oficial mínima;
- não incluir conteúdo livre, filename bruto, IDs pessoais ou secrets em labels de métricas;
- usar arquivamento lógico, preservando trilha e vínculos;
- limitar exportação, correção e exclusão ao tenant e registrar a operação.

## Inventário e minimização

| Categoria | Finalidade | Persistência permitida | Exposição permitida | Estado atual |
|---|---|---|---|---|
| Objetivo, público, briefing e notas | planejamento da campanha | registro da campanha no Supabase do app | participantes autorizados | domínio implementado; RLS real pendente |
| Participante e papel | autorização/colaboração | UUID, papel, principal e timestamps | nome seguro e avatar | projeção segura implementada; VPS pendente |
| Perfil de candidato | seleção de participante | não duplicar perfil na campanha | `id`, nome não semelhante a e-mail e avatar | implementado na Task 5 |
| Material | vínculo operacional | artifact ID, owner, MIME, tamanho, hash, fonte e timestamps | metadata mínima e access link efêmero | implementado; persistência/restart pendentes |
| Bytes do material | acesso ao arquivo | Artifact Server/volume próprio | URL assinada sob demanda | integração real pendente |
| Referência de curso | vínculo oficial | document ID, `course_id`, título snapshot e data de validação | campos reduzidos do seletor | implementado via MCP read-only; VPS pendente |
| Auditoria | segurança e prova | ação, ator, entidade, correlação e snapshots minimizados | manager/admin conforme escopo | minimização ainda pendente na Task 8 |
| Timeline | histórico operacional | projeção derivada, sem tabela duplicada obrigatória | participante/tenant conforme papel | `not_started` |
| Idempotência | retry seguro | hash e resposta conforme schema | não exposta como dado de produto | herdada da Fase 1 |
| Logs/métricas | diagnóstico e SLO | operação, status, duração e correlação | equipe operacional autorizada | hardening final é Task 14 |

## Regra da timeline e auditoria

A Task 8 é bloqueadora para rollout. O writer atual aceita `before_state`/`after_state` fornecidos pelo domínio; antes de ativar a Fase 2, esses snapshots devem ser minimizados. Para texto livre, a forma permitida é:

```text
{ present, length, sha256 }
```

A timeline pode retornar ação, timestamp, ator exibível, origem, correlation ID e nomes de campos alterados. Ela não pode retornar briefing, notas, objetivo, público, conteúdo de arquivo, filename bruto, bearer, delegação, chave interna, URL assinada, payload RAG ou estado completo da auditoria.

## Retenção

| Dado | Política da Fase 2 | Exclusão/exportação |
|---|---|---|
| Campanha ativa | enquanto necessária à operação e contrato | exportável por tenant; correção auditada |
| Campanha arquivada | preservada; prazo de expurgo depende de política jurídica futura | não fazer hard delete comum |
| Participante | enquanto vinculado e durante retenção da campanha | remover vínculo sem apagar prova histórica mínima |
| Material vinculado | enquanto o vínculo existir | unlink lógico; bytes compartilhados não são apagados automaticamente |
| Upload compensado/órfão | remover quando a transação de vínculo falhar antes do commit | cleanup explícito e auditável |
| Audit event | sem expurgo automático nesta fase | imutável; acesso detalhado restrito |
| Domain event/outbox | até publicação e janela operacional a definir | nunca excluir antes de publicar |
| Idempotency record | 24 horas conforme schema atual | expurgo por rotina posterior |
| Logs | janela operacional definida na infraestrutura, com redaction | acesso restrito; não usar como repositório de conteúdo |

Não será inventado prazo definitivo para dados pessoais ou auditoria sem decisão jurídica/compliance. A ausência dessa decisão impede expurgo automático, mas não autoriza retenção indiscriminada em logs ou métricas.

## Atendimento ao titular e incidente

1. confirmar tenant, identidade e autorização do solicitante;
2. exportar somente dados daquele tenant e escopo;
3. separar dados operacionais corrigíveis de auditoria imutável;
4. registrar correção, anonimização ou desvínculo como nova ação auditada;
5. em incidente, desativar write/frontend, preservar evidência redigida e seguir [rollback.md](rollback.md);
6. nunca acessar o Supabase do RAG para atender dados do Workspace.

## Evidência de saída

- testes da Task 8 comprovam ausência de conteúdo proibido;
- testes RLS e por papel comprovam acesso mínimo;
- logs VPS não contêm conteúdo, tokens, filenames brutos ou URLs assinadas;
- unlink, compensação e persistência são exercitados;
- risco residual e qualquer prazo ainda não definido ficam formalmente registrados.
