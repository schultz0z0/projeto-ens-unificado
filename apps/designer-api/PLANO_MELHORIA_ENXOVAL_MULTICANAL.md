# Plano de Melhoria de Fluxo — Enxoval Multicanal

## Objetivo
Permitir que o usuário envie **um único briefing** e escolha entre:
- **Peça única**: gera 1 peça para o canal/KV selecionados.
- **Enxoval**: gera automaticamente 5 peças no **mesmo KV**, uma por canal padrão:
  - `01_feed_instagram`
  - `03_banner_interno_desktop`
  - `04_banner_interno_mobile`
  - `05_whatsapp`
  - `08_topo_email`

O pipeline visual permanece o mesmo (Step 1 → Step 2 → Step 3 opcional → Step 4 resize). A mudança é só na orquestração de múltiplas peças com o mesmo briefing.

---

## Estado Atual (resumo técnico)
- Entrada atual aceita um único `canal` e `kv` por requisição (`api/app.py`).
- Execução do pipeline está centralizada em `generate_banner(request)` e `NexusImageOrchestrator.process_job(request)` (`main.py`).
- Jobs são enfileirados em memória (`api/job_service.py`) e executados via `ThreadPoolExecutor`.

---

## Perguntas Socráticas de Integridade e Escala
1. Em enxoval, se um canal falhar, o job inteiro falha ou retorna parcial? Retorna parcial, porém com um status `failed` para o canal que falhou.

2. Como rastrear progresso de 5 canais sem perder visibilidade para o frontend?
Vamos integrar o banco de dados (supabase) no projeto. Inclusive: 
- Armazenar o briefing original.
- Armazenar o progresso de cada canal.
- Armazenar os arquivos gerados.
Obs.: 
- Cada item do enxoval terá um ID único.
- O ID do job será o mesmo para todos os itens.
Fazer a mesma lógica para a geração de peça única, porém com um item no banco de dados.
Importante: esse banco de dados é o mesmo que uso no frontend (e outros backend do projeto principal, esse projeto de geração de imagem é apenas mais um backend que ficará no MESMO supabase que os demais, então vamos sempre manter a separação do ambiente, porém com um mesmo schema.)

3. Como garantir que o mesmo briefing seja aplicado de forma consistente em todos os canais? é só armazenar o briefing no banco de dados e usar o mesmo para todos os canais.

---

## Decisões de Arquitetura Propostas
1. **Novo modo de geração**
   - Adicionar `modo_geracao` com enum: `peca_unica | enxoval`.
   - Em `peca_unica`: `canal` obrigatório.
   - Em `enxoval`: `canal` ignorado; usar lista fixa de canais do enxoval.

2. **Plano de execução interno**
   - Criar um plano de execução com itens `{canal, kv, status, output_path, erro}`.
   - `peca_unica` gera 1 item.
   - `enxoval` gera 5 itens (ordem fixa definida acima).

3. **Processamento sequencial por job**
   - Para cada item do plano, chamar o mesmo pipeline já existente.
   - Regra obrigatória: **uma peça por vez por job**.
   - Não alterar lógica interna de geração da peça.

4. **Controle de limite global**
   - Adicionar limitador global para reduzir risco de exceder cota.
   - Estratégia sugerida: fila + intervalo mínimo entre inícios de peça.
   - Valor inicial conservador: `MIN_SECONDS_BETWEEN_PIECES = 3` (ajustável por env).

5. **Resultado parcial com robustez**
   - Se um canal falhar, marcar item como `failed` e continuar os próximos.
   - Job final pode ser:
     - `done` (todos ok),
     - `partial_done` (alguns falharam),
     - `failed` (todos falharam).

---

## Contrato de API Proposto
### Entrada (`POST /banners`)
- Campos existentes de briefing permanecem.
- Novo campo: `modo_geracao`.
- Campo `canal`:
  - obrigatório em `peca_unica`;
  - opcional/ignorado em `enxoval`.
- Campo `kv`:
  - obrigatório nos dois modos.

### Saída de status (`GET /banners/{id}`)
- Manter campos atuais.
- Adicionar:
  - `modo_geracao`,
  - `itens` (lista por canal com status e arquivo),
  - `progress` (ex.: `2/5`),
  - `metrics` com:
    - `started_at`,
    - `updated_at`,
    - `elapsed_seconds_total`,
    - `elapsed_seconds_by_channel`,
    - `estimated_seconds_remaining`,
    - `estimated_completion_at`.

### Saída de resumo (`GET /banners/metrics/enxoval`)
- Retornar agregados para estimativa de UX:
  - `avg_seconds_per_channel` (média móvel),
  - `avg_seconds_per_enxoval` (média móvel),
  - `p95_seconds_per_enxoval` (cauda de latência),
  - `sample_size`,
  - `last_updated_at`.

---

## Fluxo Proposto (alto nível)
1. Validar entrada e montar `BannerRequest` base.
2. Resolver modo:
   - `peca_unica` → plano com 1 canal.
   - `enxoval` → plano com 5 canais fixos.
3. Iterar plano em ordem:
   - clonar request para o canal atual,
   - executar `generate_banner`,
   - salvar resultado do item,
   - respeitar limitador global.
4. Consolidar status final do job.
5. Retornar progresso e links por canal.

---

## Estratégia de Métricas e Estimativa de Tempo
1. Registrar timestamp no início e fim de cada canal.
2. Calcular duração por canal e duração total do enxoval.
3. Persistir histórico recente para cálculo de média móvel.
4. Estimar tempo restante em tempo real:
   - `estimated_seconds_remaining = média_por_canal * canais_restantes`.
5. Expor para frontend mensagens como:
   - "Tempo médio do enxoval: ~X min"
   - "Previsão de conclusão: HH:MM".

### Regras de cálculo recomendadas
- Usar média móvel dos últimos 30 enxovais concluídos.
- Em baixa amostra (`sample_size < 10`), exibir aviso de estimativa inicial.
- Ignorar jobs totalmente falhos na média principal e manter métrica separada de erro.
- Arredondar ETA para blocos de 15 segundos para evitar jitter visual.

---

## Arquivos Impactados
- `api/app.py`
  - aceitar `modo_geracao`,
  - validar combinação de campos.
- `api/job_service.py`
  - suportar job com múltiplos itens e status parcial,
  - registrar métricas de tempo por canal e total,
  - calcular estimativa de tempo restante.
- `main.py`
  - manter pipeline da peça,
  - adicionar wrapper para execução em lote sequencial.
- `tests/test_integration_mock.py`
  - cobrir fluxo `peca_unica` e `enxoval`,
  - cobrir comportamento parcial e ordem de canais,
  - cobrir cálculo de métricas e ETA.

---

## Estratégia de Implementação (fases)
### Fase 1 — Contrato e validação
- Adicionar enum de modo.
- Ajustar parsing de entrada e validação condicional.

### Fase 2 — Orquestração de enxoval
- Implementar builder de plano de canais.
- Executar itens sequencialmente reaproveitando pipeline atual.

### Fase 3 — Status detalhado
- Persistir status por item no job em memória.
- Expor progresso no endpoint de consulta.

### Fase 4 — Métricas e ETA
- Registrar tempos por canal e total do enxoval.
- Implementar média móvel e ETA por job em andamento.
- Expor endpoint de métricas agregadas para frontend.

### Fase 5 — Controle de taxa
- Implementar throttling global configurável por env.
- Garantir execução estável sob carga.

### Fase 6 — Testes e hardening
- Testes unitários e integração mock para:
  - peça única,
  - enxoval completo,
  - falha parcial,
  - ordem de execução,
  - ETA e métricas agregadas.

---

## Critérios de Aceite
- Usuário envia briefing 1 vez e recebe 5 peças no modo enxoval.
- KV é o mesmo em todas as peças do enxoval.
- Canais do enxoval seguem a ordem padrão definida.
- Processamento ocorre uma peça por vez por job.
- Endpoint de status mostra progresso por canal.
- Falha em um canal não interrompe obrigatoriamente os demais.
- Endpoint de status mostra ETA durante execução do enxoval.
- Endpoint de métricas retorna tempo médio do enxoval para alertas no frontend.

---

## Riscos e Mitigações
- **Risco:** estouro de cota de API em pico de uso.
  - **Mitigação:** throttling global + execução sequencial por job.
- **Risco:** aumento de tempo de resposta para enxoval.
  - **Mitigação:** progresso detalhado por item e status parcial.
- **Risco:** ETA impreciso no início da operação.
  - **Mitigação:** média móvel com `sample_size` e fallback de estimativa inicial.
- **Risco:** divergência visual entre canais.
  - **Mitigação:** reaproveitar exatamente o pipeline existente por canal/template.
