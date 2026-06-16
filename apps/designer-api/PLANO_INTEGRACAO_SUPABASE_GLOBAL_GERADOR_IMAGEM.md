# Plano de Integração Supabase Global — Gerador de Imagem

## Contexto
Centralizar frontend, chatbot e gerador de imagem no mesmo projeto Supabase, mantendo isolamento rígido por domínio.  
O gerador de imagem continuará sendo consumido pelo frontend via API, e o banco será fonte única de verdade para jobs, itens do enxoval, métricas e auditoria.

---

## Referências Oficiais Consultadas
- Supabase (RLS, segurança e uso de service role no backend): `/supabase/supabase` via Context7.
- Supabase CLI (migrations, push/pull/list/repair): `/supabase/cli` via Context7.

Principais diretrizes aplicadas:
- `service_role` nunca no cliente.
- RLS habilitado por padrão nas tabelas de domínio.
- Políticas com `TO authenticated` quando houver acesso do cliente autenticado.
- Migrações SQL versionadas via Supabase CLI.

---

## Objetivo
Integrar o backend do gerador de imagem ao Supabase global com:
1. Isolamento por schema do domínio de imagem.
2. Persistência de briefing, jobs, itens, outputs e métricas.
3. Segurança com RLS, papéis e trilha de auditoria.
4. Compatibilidade com fluxo API-first do frontend.

---

## Perguntas Socráticas de Integridade e Segurança
1. Quem pode criar jobs e quem pode apenas consultar?
2. O frontend precisa ler todas as métricas ou apenas as do próprio tenant/usuário?
3. Quais campos do briefing podem conter PII e qual política de retenção será aplicada?
4. Como o sistema reage se Supabase estiver indisponível durante a geração?
5. Quais dados devem ser imutáveis para auditoria (ex.: payload original)?
6. Como garantir isolamento entre domínios no mesmo projeto Supabase sem colisão de permissões?

### Premissas Adotadas
- A autenticação do frontend já existe no projeto global.
- O gerador de imagem escreve com credencial de backend e o frontend lê via políticas de RLS.
- O domínio do gerador terá schema próprio e não usará tabelas de outros domínios diretamente.
- Logs sensíveis serão minimizados e segredos nunca serão serializados em resposta.

---

## Arquitetura de Isolamento (Supabase Único, Domínios Isolados)

### Estratégia
- Projeto Supabase: único (global).
- Schema do gerador: `image_gen`.
- API do gerador permanece como camada de escrita/orquestração.
- Frontend consome endpoints da API e, quando necessário, leituras diretas controladas por RLS.

### Fronteiras
- `public`: mantém objetos compartilhados existentes.
- `image_gen`: todas as tabelas, views e funções do gerador.
- Permissões explícitas por role, sem grants amplos em `public`.

---

## Modelo de Dados Proposto (image_gen)

### Tabelas
1. `image_gen.jobs`
   - `id uuid pk`
   - `modo_geracao text check ('peca_unica','enxoval')`
   - `status text check ('pending','running','done','partial_done','failed')`
   - `briefing jsonb not null`
   - `kv text not null`
   - `requested_by uuid null` (auth user id)
   - `source_system text not null default 'nexus-designer-api'`
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`

2. `image_gen.job_items`
   - `id uuid pk`
   - `job_id uuid not null fk image_gen.jobs(id) on delete cascade`
   - `canal text not null`
   - `status text check ('pending','running','done','failed')`
   - `output_file_url text null`
   - `error_message text null`
   - `started_at timestamptz null`
   - `completed_at timestamptz null`
   - `elapsed_seconds numeric(10,3) null`

3. `image_gen.job_metrics`
   - `job_id uuid pk fk image_gen.jobs(id) on delete cascade`
   - `elapsed_seconds_total numeric(10,3) not null default 0`
   - `elapsed_seconds_by_channel jsonb not null default '{}'::jsonb`
   - `estimated_seconds_remaining numeric(10,3) not null default 0`
   - `estimated_completion_at timestamptz null`
   - `sampled_at timestamptz not null default now()`

4. `image_gen.metrics_rollup`
   - `id bigint generated always as identity pk`
   - `avg_seconds_per_channel numeric(10,3) not null`
   - `avg_seconds_per_enxoval numeric(10,3) not null`
   - `p95_seconds_per_enxoval numeric(10,3) not null`
   - `sample_size int not null`
   - `computed_at timestamptz not null default now()`

### Índices
- `image_gen.jobs(status, created_at desc)`
- `image_gen.jobs(requested_by, created_at desc)`
- `image_gen.job_items(job_id, canal)`
- `image_gen.job_items(status, started_at)`

---

## Segurança (RLS, Roles e Chaves)

### Regras obrigatórias
- Habilitar RLS em todas as tabelas `image_gen`.
- `service_role` somente no backend da API.
- Não expor `service_role` no frontend.
- Políticas com `TO authenticated` para leituras permitidas ao usuário final.

### Políticas iniciais
- `jobs`: usuário autenticado lê apenas jobs com `requested_by = auth.uid()`.
- `job_items`: leitura permitida se `job_id` pertencer a job do mesmo `auth.uid()`.
- `job_metrics`: mesma regra de herança do `job_id`.
- Escrita direta do frontend bloqueada por padrão; gravação principal via API backend.

### Hardening extra
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY` nas tabelas críticas.
- Trigger para `updated_at`.
- Sanitização de `error_message` para não vazar detalhes internos.

---

## Fluxo de Integração (API-first)
1. Frontend chama `POST /banners`.
2. API cria registro em `image_gen.jobs` e `image_gen.job_items`.
3. Pipeline processa canal a canal e atualiza status/tempos em transação curta.
4. API responde `GET /banners/{id}` com dados persistidos no Supabase.
5. API atualiza/consulta `metrics_rollup` para endpoint `/banners/metrics/enxoval`.

Fallback:
- Se Supabase falhar na criação do job: request falha sem iniciar geração.
- Se Supabase falhar no update durante execução: marcar erro operacional e registrar retry técnico com backoff.

---

## Migrations com Supabase CLI (npx)

### Sequência recomendada
1. Linkar projeto Supabase global.
2. Criar migration SQL para schema, tabelas, índices e RLS.
3. Revisar com `--dry-run`.
4. Aplicar em ambiente alvo.
5. Validar com `migration list`.

### Comandos
```bash
npx supabase link --project-ref <PROJECT_REF_GLOBAL>
npx supabase migration new image_gen_schema_init
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

---

## Plano de Execução por Fases

### Fase A — Fundação de Banco
- Criar schema `image_gen`.
- Criar tabelas, constraints, índices.
- Habilitar e forçar RLS.
- Criar policies mínimas de leitura por usuário.

### Fase B — Camada de Persistência no Backend
- Adicionar cliente Supabase server-side no backend.
- Persistir criação de job e itens ao receber `POST /banners`.
- Persistir transições de status e erros por item.

### Fase C — Métricas Persistidas
- Persistir `job_metrics` durante execução.
- Gerar/atualizar `metrics_rollup`.
- Ajustar endpoint `/banners/metrics/enxoval` para leitura no banco.

### Fase D — Resiliência Operacional
- Retry com backoff para falhas transitórias de escrita.
- Idempotência para updates de status por `job_id` + `item_id`.
- Circuit-breaker simples para indisponibilidade temporária do banco.

### Fase E — Validação Final e Observabilidade
- Testes de integração com Supabase.
- Testes de RLS com usuário autenticado vs não autenticado.
- Auditoria de segurança de chaves e permissões.

---

## Critérios de Aceite
- Jobs e itens deixam de depender de store em memória para estado principal.
- Dados do enxoval ficam persistidos no schema `image_gen`.
- Frontend consegue acompanhar status via API com dados do Supabase.
- RLS ativo e validado para leitura por usuário.
- Nenhuma chave sensível exposta ao cliente.

---

## Riscos e Mitigações
- Risco: conflito com objetos existentes no projeto global.
  - Mitigação: isolamento no schema `image_gen` + prefixo consistente.
- Risco: regressão de performance em consultas de status.
  - Mitigação: índices por `status`, `created_at`, `job_id`.
- Risco: bloqueio silencioso por RLS.
  - Mitigação: testes de política por role + logs estruturados de erro de permissão.
- Risco: indisponibilidade transitória do banco.
  - Mitigação: retry técnico com backoff e marcação de erro operacional rastreável.

---

## Entregáveis da Implementação (próxima etapa)
1. Migration SQL inicial (`schema + tabelas + índices + RLS + policies`).
2. Serviço backend de persistência Supabase (`jobs`, `job_items`, `job_metrics`).
3. Refatoração do `api/job_service.py` para leitura/escrita no banco.
4. Testes de integração e testes de segurança RLS.

