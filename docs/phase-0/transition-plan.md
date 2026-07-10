# Plano de transição para o Marketing Ops

## Objetivo

Introduzir o domínio operacional sem quebrar chat, geração de imagem, memória validada ou serviços atuais e sem reutilizar estruturas legadas incompatíveis.

## Princípios

- evolução aditiva antes de qualquer cutover;
- uma única fonte de verdade por domínio;
- nenhum dual-write sem reconciliação explícita;
- feature flags com default desligado;
- migrations forward-only e backup antes de operação destrutiva;
- Bridge permanece transporte; Marketing Ops permanece domínio;
- execução externa continua desabilitada até worker e autorização operacional.

## Estado atual preservado

| Capacidade | Caminho atual | Durante a transição |
|---|---|---|
| Login/perfil | Frontend -> Supabase | preservar; reforçar authority server-side |
| Chat | Frontend -> Bridge -> Hermes | preservar sem incorporar CRUD operacional |
| Mensagens | Frontend -> Supabase | preservar |
| Anexos/artefatos | Storage/Bridge/Artifact Server | preservar e referenciar por ID no domínio novo |
| RAG | Hermes -> `rag-mcp` -> Supabase dedicado | preservar; não tocar registros na limpeza do app |
| Graph/memória validada | Hermes -> `graph-mcp` -> Neo4j/Supabase | preservar; referências futuras são aditivas |
| Market Intelligence antigo | sem rota/cliente ativo | remover tabelas vazias após backup |
| RAG antigo do app | sem runtime ativo | `rag_ens` removível; `rag_marketing` em quarentena |

## Feature flags propostas

| Flag | Default | Finalidade | Remoção prevista |
|---|---|---|---|
| `NEXUS_MARKETING_OPS_ENABLED` | `false` | liga API/MCP do serviço | após estabilização da Fase 2 |
| `VITE_MARKETING_OPS_ENABLED` | `false` | exibe rotas/workspace | após adoção completa |
| `NEXUS_MARKETING_OPS_MCP_WRITE_ENABLED` | `false` | libera mutações Hermes | depois da delegação e contratos |
| `NEXUS_MARKETING_OPS_EXECUTION_ENABLED` | `false` | kill switch global de execução | permanece como controle operacional |

Flags são proteção operacional, não autorização. RLS/scopes continuam obrigatórios quando uma flag está ligada.

## Sequência

### Passo 0 — preparar ambiente e baseline

1. criar Supabase de desenvolvimento/preview separado da produção;
2. reconciliar schema remoto com migrations oficiais;
3. criar baseline limpo e testar bootstrap do zero;
4. renovar acesso administrativo, advisors e backup/restore;
5. aplicar a limpeza do Supabase do app conforme plano separado.

### Passo 1 — fundação aditiva

1. criar `services/marketing-ops` sem exposição pública inicial;
2. criar tabelas novas com nomes de domínio próprios;
3. habilitar RLS e grants mínimos na mesma migration;
4. adicionar audit/outbox/idempotência desde o primeiro write;
5. publicar health/readiness e contratos OpenAPI/MCP versionados.

Nenhuma tabela `campaigns`/`market_*` antiga será renomeada para servir de schema novo.

### Passo 2 — leitura controlada

1. ativar API somente para admin/test tenant;
2. criar frontend atrás de flag;
3. habilitar ferramentas MCP de leitura com delegação;
4. comparar respostas API/telas e queries diretas de diagnóstico;
5. observar erros, latência e isolamento.

### Passo 3 — escrita em rascunho

1. liberar create/update de rascunhos para allowlist;
2. propagar correlation/idempotency keys;
3. validar concorrência otimista e audit events;
4. permitir ao Hermes propor mutação, com confirmação quando exigida;
5. manter approvals/editorial/execution ainda desabilitados.

### Passo 4 — workspace como caminho principal

1. habilitar rotas para todos os papéis autorizados;
2. monitorar adoção e erros;
3. preservar deep links entre chat e objetos;
4. remover caminhos temporários somente após janela estável;
5. avançar para calendário, governança e workers nas fases seguintes.

## Estratégia de migrations

- migrations criadas pelo CLI oficial e revisadas;
- `CREATE`/`ALTER` aditivos antes de `DROP`;
- constraints `NOT VALID` + validação posterior quando volume exigir;
- índices concorrentes/estratégia compatível com a plataforma quando aplicável;
- RLS, `GRANT`/`REVOKE` e testes de papel na mesma entrega;
- funções privilegiadas fora do schema exposto sempre que possível;
- schema diff e lista de migrations registrados por ambiente;
- rollback de dados por restore/forward fix, nunca por apagar histórico.

## Compatibilidade e coexistência

- frontend mantém chat e imagem enquanto adiciona workspace;
- mensagens podem guardar deep link/ID do Marketing Ops, não cópia autoritativa;
- Artifact Server continua entregando binários; Marketing Ops guarda referência/hash;
- `validated_works` pode referenciar campanha futura por metadata inicialmente, depois por contrato formal;
- RAG/Graph recebem eventos somente após validação; atraso não bloqueia transação principal;
- nenhuma sincronização será feita do novo domínio para tabelas legadas.

## Critérios para remover legado

Um objeto só pode ser removido quando:

1. não há import/rota/consulta ativa no repositório;
2. consumidores externos foram confirmados/desativados;
3. contagem, tamanho e owner foram registrados;
4. backup e restore foram testados;
5. período de observação terminou sem acesso;
6. migration de remoção e rollback foram revisados;
7. gate VPS pós-remoção passou.

## Rollback por etapa

| Etapa | Sinal de rollback | Ação |
|---|---|---|
| Serviço adicionado | health/readiness falha | manter flag off, parar somente `marketing-ops` |
| Schema aditivo | migration falha | interromper deploy; forward fix ou restaurar snapshot antes de tráfego |
| Leitura | erros/latência/tenant | desligar flag de UI/MCP; preservar dados |
| Escrita draft | audit/idempotência/RLS falha | bloquear writes, manter leitura, reconciliar eventos |
| Limpeza legado | consumidor falha | restaurar de quarentena/dump e desativar consumidor antigo |
| Deploy de imagem | regressão | voltar ao commit/imagem anterior e recriar serviço afetado |

## Critério de saída da transição inicial

- ambiente dev isolado e baseline reproduzível;
- serviço novo saudável com flags off por default;
- schema/RLS/grants auditados;
- API e MCP de leitura/escrita draft contratados;
- delegação confiável e audit events funcionando;
- rollback executado em teste;
- gate local e gate VPS registrados.
