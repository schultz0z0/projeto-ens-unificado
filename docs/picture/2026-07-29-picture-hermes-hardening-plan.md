# Picture-Hermes Hardening Implementation Plan

> **Para execução agentic:** usar `superpowers:executing-plans` nesta mesma sessão. Não usar subagentes.

**Objetivo:** corrigir as falhas reproduzidas no Picture-Hermes, endurecer o contrato determinístico e reduzir custo/latência sem executar chamadas pagas FAL.

**Arquitetura:** o schema MCP passa a exigir coordenadas explícitas, enquanto o engine mantém compatibilidade com o formato legado. O compositor valida a caixa efetiva de overlays antes de renderizar; o pipeline inicializa FAL sob demanda. MCP, Hermes e frontend recebem alterações pequenas e testáveis nas suas fronteiras.

**Stack:** TypeScript, Bun, Zod, Sharp, Satori/Resvg, MCP SDK, Python/pytest, React/Vitest.

**Estado da execução:** concluída nesta sessão, sem subagentes e sem deploy.

## Restrições globais

- Documentação isolada deve existir antes da primeira alteração de código.
- Desenvolvimento deve seguir RED → GREEN → REFACTOR.
- Nenhuma chamada paga FAL será executada.
- Nenhuma migração de banco será criada.
- Compatibilidade legada é preservada dentro do engine, mas não no novo contrato MCP.
- Não usar subagentes.
- Não fazer deploy nesta sessão.

---

### Tarefa 1: contrato posicional e canvas determinístico

**Arquivos:**

- Modificar: `services/picture-it/src/types.ts`
- Modificar: `services/picture-it/src/zones.ts`
- Modificar: `services/picture-it/src/service/contracts.ts`
- Modificar: `services/picture-it/src/pipeline.ts`
- Modificar: `services/picture-it/src/service/engine-adapter.ts`
- Testar: `services/picture-it/test/contracts.test.ts`
- Testar: `services/picture-it/test/pipeline-contract.test.ts`
- Testar: `services/picture-it/test/pipeline-compose-first.test.ts`
- Criar: `services/picture-it/test/zones.test.ts`

**Interfaces:**

- Produz `PositionZone = ZoneName | { x: number; y: number; unit?: "px" | "percent" }`.
- O schema MCP aceita coordenada numérica somente com `unit`.
- `PipelineStep` compose aceita `size?: string`.

- [x] Escrever testes que esperam `72px !== 72%`, compatibilidade legada, unidade obrigatória no schema e `compose.size`.
- [x] Executar os testes focados e confirmar falhas pelos comportamentos ausentes.
- [x] Implementar os tipos, a resolução explícita e o schema estrito.
- [x] Tornar a configuração FAL condicional à presença de `generate`, `edit`, `remove-bg`, `replace-bg` ou `upscale`.
- [x] Criar canvas compose-first usando `parseSize(step.size)` e preservar 1080 × 1080 quando omitido.
- [x] Preservar `size` no `PictureEngineAdapter`.
- [x] Executar os testes focados até ficarem verdes.

Comandos:

```powershell
cd services/picture-it
bun test test/zones.test.ts test/contracts.test.ts test/pipeline-contract.test.ts test/pipeline-compose-first.test.ts
bunx tsc --noEmit
```

### Tarefa 2: geometria segura de overlays

**Arquivos:**

- Modificar: `services/picture-it/src/types.ts`
- Modificar: `services/picture-it/src/service/contracts.ts`
- Modificar: `services/picture-it/src/compositor.ts`
- Modificar: `services/picture-it/src/service/job-service.ts`
- Criar: `services/picture-it/test/compositor-layout.test.ts`

**Interfaces:**

- `ShapeOverlay` produz `anchor?`, `rotation?` e `allowBleed?`.
- `ImageOverlay` produz `allowBleed?`.
- `assertOverlayWithinCanvas()` lança `PictureError("picture_overlay_out_of_bounds", ...)`.

- [x] Escrever testes de forma `top-left`, rotação, overflow de texto/forma e bleed permitido.
- [x] Executar os testes e confirmar falhas visuais/erros ausentes.
- [x] Posicionar imagens e formas pelo tamanho real do buffer após rotação.
- [x] Aplicar âncora às formas.
- [x] Validar bounds antes de chamar `sharp.composite`.
- [x] Remover clamp silencioso da camada principal.
- [x] Classificar `picture_overlay_out_of_bounds` como não retentável.
- [x] Executar testes focados e a suíte Picture.

Comandos:

```powershell
cd services/picture-it
bun test test/compositor-layout.test.ts
bun test
```

### Tarefa 3: respostas MCP compactas

**Arquivos:**

- Modificar: `services/picture-it/src/service/mcp-server.ts`
- Modificar: `services/picture-it/test/mcp-server.test.ts`

**Interfaces:**

- Produz `toPictureJobSummary(value: unknown)`.
- Ferramentas start/revise/get devolvem `{ data: PictureJobSummary }`.

- [x] Escrever teste que usa um job completo e prova que `specification`, `lease_owner` e `idempotency_key` não são retornados.
- [x] Executar e confirmar que o teste falha porque o payload ainda vaza campos internos.
- [x] Implementar projeção allowlist e aplicá-la às três ferramentas.
- [x] Verificar schema/listagem e chamadas MCP reais em memória.

Comando:

```powershell
cd services/picture-it
bun test test/mcp-server.test.ts
```

### Tarefa 4: delegação e instruções do Hermes

**Arquivos:**

- Modificar: `services/hermes-runtime/vendor/hermes-agent/tests/agent/test_picture_delegation.py`
- Modificar conforme evidência do teste: `services/hermes-runtime/vendor/hermes-agent/agent/picture_delegation.py` ou ponto de despacho em `agent/tool_executor.py`
- Modificar: `services/hermes-runtime/skills/picture-hermes/SKILL.md`
- Modificar: `services/hermes-runtime/skills/picture-hermes/templates/picture-start-job.json`
- Modificar: `services/picture-it/skill/picture-it/references/composition-guide.md`
- Modificar: `services/picture-it/skill/picture-it/SKILL.md`
- Modificar: `services/picture-it/fixtures/graduacao-test/overlays.json`
- Modificar: `services/picture-it/fixtures/graduacao-test/steps.json`

**Interfaces:**

- Toda chamada `picture_*` recebe o token do bloco efêmero antes da validação MCP.
- Skill usa coordenadas com unidade e apenas propriedades aceitas.

- [x] Adicionar teste de token ausente, nome de ferramenta descoberto pelo bridge e preservação de ferramentas não Picture.
- [x] Executar pytest e confirmar a falha específica se o caminho real não estiver coberto.
- [x] Corrigir o menor ponto de despacho necessário.
- [x] Atualizar skill/template/fixture para `unit`, `anchor`, `rotation`, `allowBleed` e `compose.size`.
- [x] Executar os testes Hermes relevantes.

Comandos:

```powershell
cd services/hermes-runtime/vendor/hermes-agent
python -m pytest tests/agent/test_picture_delegation.py -q
cd ../../..
python -m pytest docker/tests/test_picture_skill_runtime.py -q
```

### Tarefa 5: seleção de revisão e nomes versionados

**Arquivos:**

- Modificar: `apps/chat-web/src/components/picture/PictureFilesPanel.tsx`
- Modificar: `apps/chat-web/src/components/picture/PictureFilesPanel.test.tsx`

**Interfaces:**

- Mudança de `candidateArtifactId` seleciona a nova candidata.
- `displayFileName(entry, entries)` acrescenta `v1`, `v2` em nomes duplicados, ordenados por `created_at` e com fallback estável pela ordem recebida.

- [x] Escrever teste que revisa a prop candidata e espera a nova imagem na prévia.
- [x] Escrever teste com dois `composition-plan.json` e esperar rótulos distintos.
- [x] Executar os testes e confirmar que falham pela seleção/rótulos atuais.
- [x] Implementar rastreamento da candidata anterior sem sobrescrever cliques do usuário quando ela não mudou.
- [x] Implementar rótulos de versão.
- [x] Executar teste focado, typecheck e build do frontend.

Comandos:

```powershell
cd apps/chat-web
npx vitest run src/components/picture/PictureFilesPanel.test.tsx
npm run typecheck
npm run build
```

### Tarefa 6: documentação operacional e verificação

**Arquivos:**

- Atualizar: `docs/picture/2026-07-29-picture-hermes-hardening-design.md`
- Atualizar: `docs/picture-hermes-operations.md`
- Atualizar: `docs/plans/2026-07-21-picture-hermes-execution-log.md`

- [x] Registrar cada teste RED e GREEN no documento isolado.
- [x] Atualizar contrato operacional e exemplos determinísticos.
- [x] Registrar limitações: upload do Chrome bloqueado pela extensão e FAL não executada sem crédito.
- [x] Executar `git diff --check` e revisar o diff inteiro.
- [x] Executar suíte completa Picture, typecheck/build Picture, testes Hermes focados, testes/typecheck/build frontend.
- [x] Verificar configuração Compose sem subir produção.
- [x] Documentar comandos exatos de deploy seletivo, limpeza de cache, health checks e rollback.
- [x] Documentar roteiro manual de produção determinístico e híbrido FAL.

Comandos finais:

```powershell
cd services/picture-it
bun test
bun run typecheck
bun run build

cd ../../services/hermes-runtime
python -m pytest docker/tests/test_picture_skill_runtime.py vendor/hermes-agent/tests/agent/test_picture_delegation.py -q

cd ../../apps/chat-web
npx vitest run src/components/picture/PictureFilesPanel.test.tsx
npm run typecheck
npm run build

cd ../..
git diff --check
docker compose --env-file .env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
```
