# Manual Raw Adjustment Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar um subfluxo de ajuste manual cru, no mesmo `job/item`, usando sempre a ultima imagem `editable` da sessao + prompt cru do usuario em `4K`, seguido apenas de resize final para a medida original da peca entregue.

**Architecture:** A geracao padrao continua intacta. O ajuste manual passa a usar um caminho dedicado no backend, separado do ajuste assistido atual, para garantir que o `gemini-3-pro-image-preview` receba somente a imagem `editable` corrente e o prompt cru do usuario, sem refinamento, sem validacao, sem estabilizacao, sem referencia externa e sem correcoes locais. O Nexus Designer continua controlando a sessao internamente, atualizando a `editable` corrente do mesmo `job/item` e gerando a versao resized para entrega ao usuario.

**Tech Stack:** Python, FastAPI, Pydantic, Google GenAI SDK, Pillow, pytest.

---

### Task 1: Formalizar o contrato do ajuste manual cru

**Files:**
- Modify: `api/app.py`
- Modify: `api/job_service.py`
- Test: `tests/test_integration_mock.py`

**Step 1: Escrever o teste de contrato do endpoint de ajuste**

Adicionar um teste cobrindo que o endpoint `POST /banners/{job_id}/items/{item_id}/adjust` aceita `prompt` obrigatorio e nao depende de `reference_image`.

```python
def test_adjust_endpoint_accepts_prompt_only(client, seeded_done_job):
    response = client.post(
        f"/banners/{seeded_done_job.job_id}/items/{seeded_done_job.item_id}/adjust",
        json={"prompt": "troque a frase principal por uma versao mais agressiva"},
    )

    assert response.status_code == 202
    assert response.json()["status"] == "accepted"
```

**Step 2: Rodar o teste para verificar o estado atual**

Run: `pytest tests/test_integration_mock.py -k adjust -v`
Expected: o teste atual falha ou exige caminho opcional legado que ainda nao reflete o contrato definitivo.

**Step 3: Ajustar o endpoint para explicitar o contrato**

Em `api/app.py`, manter `prompt` como unico insumo funcional do ajuste manual.

```python
class AdjustmentRequest(BaseModel):
    prompt: str

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Prompt de ajuste e obrigatorio.")
        return cleaned
```

**Step 4: Remover dependencia funcional de upload externo**

Em `adjust_banner_item()`, parar de transformar `reference_image` em insumo de execucao do ajuste cru.

```python
parsed_payload = AdjustmentRequest(prompt=prompt_value or "")
submit_adjustment(loop, job_id, item_id, parsed_payload.prompt)
```

**Step 5: Rodar o teste para verificar que passa**

Run: `pytest tests/test_integration_mock.py -k adjust -v`
Expected: PASS

**Step 6: Commit**

```bash
git add api/app.py api/job_service.py tests/test_integration_mock.py
git commit -m "refactor: simplify manual adjustment request contract"
```

---

### Task 2: Criar um caminho de geracao cru para ajuste manual

**Files:**
- Modify: `main.py`
- Test: `tests/test_integration_mock.py`

**Step 1: Escrever o teste que prova a chamada crua**

Adicionar um teste para garantir que o ajuste manual nao reutiliza referencia externa, nao usa estabilizacao local e força `4K`.

```python
def test_manual_adjustment_uses_raw_editable_prompt_and_4k(monkeypatch, tmp_path):
    calls = {}

    def fake_generate(*, model, contents, config):
        calls["model"] = model
        calls["contents_len"] = len(contents)
        calls["image_size"] = config.image_config.image_size
        return fake_image_response(tmp_path / "generated.png")

    orchestrator = NexusImageOrchestrator()
    monkeypatch.setattr(orchestrator.image_client.models, "generate_content", fake_generate)

    orchestrator.process_adjustment(tmp_path / "base.editable.png", "adicione novos elementos visuais")

    assert calls["model"] == orchestrator.image_model
    assert calls["contents_len"] == 2
    assert calls["image_size"] == "4K"
```

**Step 2: Rodar o teste para confirmar que o fluxo atual ainda esta errado**

Run: `pytest tests/test_integration_mock.py -k raw_editable -v`
Expected: FAIL porque o fluxo atual ainda permite referencia opcional e estabilizacao.

**Step 3: Extrair uma chamada dedicada para ajuste cru**

Em `main.py`, criar um metodo que faca apenas `prompt + image` e permita desabilitar qualquer estabilizacao.

```python
def _call_image_model_raw_adjustment(self, image: Image.Image, prompt: str) -> Image.Image:
    response = self.image_client.models.generate_content(
        model=self.image_model,
        contents=[prompt, image],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=self._get_image_aspect_ratio(*self._safe_image_size(image)),
                image_size="4K",
            ),
        ),
    )
    return _extract_first_image(response)
```

**Step 4: Garantir que a resposta nao passe pela estabilizacao alfa**

Remover do caminho cru qualquer uso de `_stabilize_generated_alpha()`.

```python
generated = Image.open(io.BytesIO(image_bytes))
return generated.convert("RGB")
```

**Step 5: Rodar o teste para validar o comportamento**

Run: `pytest tests/test_integration_mock.py -k raw_editable -v`
Expected: PASS

**Step 6: Commit**

```bash
git add main.py tests/test_integration_mock.py
git commit -m "feat: add raw manual adjustment image path"
```

---

### Task 3: Reescrever `process_adjustment()` para seguir a sessao editable

**Files:**
- Modify: `main.py`
- Test: `tests/test_integration_mock.py`

**Step 1: Escrever o teste da cadeia editable**

Adicionar um teste cobrindo que o ajuste usa a `editable` recebida como base, produz nova `editable` e depois gera o delivery resized.

```python
def test_process_adjustment_uses_editable_as_internal_source(monkeypatch, tmp_path):
    editable_path = tmp_path / "piece.editable.png"
    delivery_path = tmp_path / "piece.png"
    write_test_image(editable_path, size=(4096, 4096))
    write_test_image(delivery_path, size=(1080, 1080))

    orchestrator = NexusImageOrchestrator()
    result = orchestrator.process_adjustment(editable_path, "mude o titulo")

    assert result.name.startswith("adj_")
    assert result.exists()
    assert editable_output_path_for_delivery(result).exists()
```

**Step 2: Rodar o teste para verificar a falha inicial**

Run: `pytest tests/test_integration_mock.py -k editable_as_internal_source -v`
Expected: FAIL com comportamento herdado do ajuste assistido.

**Step 3: Simplificar o fluxo de ajuste**

Em `process_adjustment()`, remover:
- `reference_image_path`
- `_edit_image_step_with_optional_reference()`
- `_preserve_non_target_regions()`

Manter:
- leitura da `editable` base
- chamada crua em `4K`
- persistencia da nova `editable`
- resize final para entrega

```python
manual_prompt = prompt.strip()
if not manual_prompt:
    raise ValueError("Prompt de ajuste manual nao pode estar vazio.")

raw_adjusted_path = temp_dir / "adjusted_raw.png"
current_image_path = self._edit_image_step_raw(image_path, manual_prompt, raw_adjusted_path)

editable_source_path = current_image_path
target_size = self._resolve_adjustment_target_size(image_path)
step_final_path = temp_dir / "adjusted_resized.png"
current_image_path = self._postprocess_final_resolution(current_image_path, target_size, step_final_path)
```

**Step 4: Garantir o resize contra a referencia correta**

Conservar `_resolve_adjustment_target_size()` para que o resize use a dimensao do delivery equivalente, nunca a dimensao da `editable`.

```python
delivery_path = delivery_output_path_from_editable(image_path)
if delivery_path and delivery_path.exists():
    return self._read_dimensions_from_file(delivery_path)
```

**Step 5: Rodar o teste para validar o encadeamento**

Run: `pytest tests/test_integration_mock.py -k editable_as_internal_source -v`
Expected: PASS

**Step 6: Commit**

```bash
git add main.py tests/test_integration_mock.py
git commit -m "refactor: chain manual adjustments from editable source"
```

---

### Task 4: Atualizar o `job/item` para sempre apontar para a ultima editable

**Files:**
- Modify: `api/job_service.py`
- Test: `tests/test_integration_mock.py`

**Step 1: Escrever o teste do estado do item apos ajuste**

Adicionar um teste garantindo que o mesmo item continue sendo atualizado e que `_local_output_path` aponte para a nova `editable`.

```python
def test_adjustment_updates_same_job_item_local_editable_path(seeded_job_item, monkeypatch):
    _run_adjustment_sync(seeded_job_item.job_id, seeded_job_item.item_id, "crie novas ideias visuais")

    item = get_job(seeded_job_item.job_id).itens[0]
    assert item.status == JobItemStatus.DONE
    assert item.file_url is not None
    assert "editable" in getattr(item, "_local_output_path")
```

**Step 2: Rodar o teste para confirmar a falha inicial**

Run: `pytest tests/test_integration_mock.py -k local_editable_path -v`
Expected: FAIL se o item ainda depender de base antiga ou referencia externa.

**Step 3: Remover o parametro legado de referencia do ajuste interno**

Em `submit_adjustment()` e `_run_adjustment_sync()`, simplificar a assinatura para refletir o fluxo cru.

```python
def submit_adjustment(loop, job_id: str, item_id: str, prompt: str) -> None:
    loop.run_in_executor(_executor, _run_adjustment_sync, job_id, item_id, prompt)
```

**Step 4: Regravar a base local do item com a nova editable**

Ao final de `_run_adjustment_sync()`, continuar atualizando o mesmo item com a nova `editable`.

```python
local_adjustment_path = _resolve_local_adjustment_base_path(output_path)
setattr(item, "_local_output_path", str(local_adjustment_path.absolute()))
item.file_url = resolved_delivery_url
```

**Step 5: Rodar o teste para validar**

Run: `pytest tests/test_integration_mock.py -k local_editable_path -v`
Expected: PASS

**Step 6: Commit**

```bash
git add api/job_service.py tests/test_integration_mock.py
git commit -m "feat: keep manual adjustment state on same job item"
```

---

### Task 5: Validar que o ajuste cru nao quebra a geracao padrao

**Files:**
- Test: `tests/test_integration_mock.py`
- Test: `tests/test_template_payloads_consistency.py`

**Step 1: Escrever um teste de nao-regressao da geracao padrao**

Adicionar um teste simples garantindo que `process_job()` continua usando o pipeline padrao sem cair no caminho cru de ajuste manual.

```python
def test_standard_generation_flow_does_not_use_manual_raw_path(monkeypatch):
    called = {"raw_adjustment": False}

    def fake_raw(*args, **kwargs):
        called["raw_adjustment"] = True
        raise AssertionError("manual raw path should not be called")

    orchestrator = NexusImageOrchestrator()
    monkeypatch.setattr(orchestrator, "_edit_image_step_raw", fake_raw)

    # executar fluxo padrao com request valido
    assert called["raw_adjustment"] is False
```

**Step 2: Rodar o teste para verificar isolamento**

Run: `pytest tests/test_integration_mock.py -k standard_generation_flow -v`
Expected: PASS

**Step 3: Executar a bateria focal de regressao**

Run: `pytest tests/test_integration_mock.py tests/test_template_payloads_consistency.py -v`
Expected: todos os testes focalizados PASS

**Step 4: Commit**

```bash
git add tests/test_integration_mock.py tests/test_template_payloads_consistency.py
git commit -m "test: cover raw manual adjustment isolation"
```

---

### Task 6: Verificacao manual do fluxo encadeado

**Files:**
- Run: `api/app.py`
- Run: `manual_test.py`

**Step 1: Subir a API localmente**

Run: `python -m uvicorn api.app:app --reload`
Expected: servidor em execucao sem erro de import.

**Step 2: Executar uma geracao padrao**

Submeter um job valido de geracao e aguardar um item concluido com:
- `file_url` apontando para a entrega resized
- `_local_output_path` apontando para a `editable`

Expected: job/item concluido normalmente.

**Step 3: Executar ajuste manual 1**

Enviar apenas:

```json
{
  "prompt": "mude a frase principal para uma versao mais sofisticada"
}
```

Expected:
- o ajuste usa a `editable` da geracao padrao
- gera uma nova `editable`
- entrega uma nova imagem resized
- atualiza o mesmo `job/item`

**Step 4: Executar ajuste manual 2**

Enviar apenas:

```json
{
  "prompt": "adicione novos elementos visuais para explorar ideias"
}
```

Expected:
- o ajuste usa a `editable` do ajuste 1
- gera uma nova `editable`
- entrega uma nova imagem resized
- mantem o mesmo `job/item`

**Step 5: Verificar rastros em log**

Confirmar nos logs:
- sem refinamento de prompt
- sem referencia externa
- sem `_preserve_non_target_regions()`
- ajuste manual sempre em `4K`
- resize final usando a medida da peca original de entrega

**Step 6: Commit**

```bash
git add .
git commit -m "docs: verify raw manual adjustment flow end to end"
```
