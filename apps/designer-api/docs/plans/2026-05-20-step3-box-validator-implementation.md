# Step3 Box Validator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensinar o Validador AI do Step 3 a gerar correções específicas para boxes largas, diferenciando `box1` branca compacta de `box2` com contorno/estilo do KV.

**Architecture:** A regra fica centralizada no prompt do Step 3 em `main.py`, para evitar duplicação entre templates e manter comportamento consistente nos canais ENS. A implementação segue TDD: primeiro travamos o novo wording do validador e da correção por testes, depois fazemos o ajuste mínimo no prompt e validamos que `box1` e `box2` passam a ter instruções distintas.

**Tech Stack:** Python, pytest, unittest.mock.

---

### Task 1: Travar por teste a diferenciação visual entre `box1` e `box2`

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\tests\test_integration_mock.py`

**Step 1: Write the failing test**

Adicionar um teste focado no texto do prompt do Step 3, validando que ele diferencia explicitamente `box1` e `box2`.

```python
def test_step3_validator_prompt_differentiates_box1_and_box2_styles():
    with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-api-key"}):
        orchestrator = NexusImageOrchestrator()
        request = BannerRequest(
            request_meta={"canal": "05_whatsapp", "kv": "pos"},
            content_keys={
                "etiqueta": "EXTENSÃO",
                "titulo": "Gestão de Resseguro",
                "frase": "Frase de apoio",
                "box1": "INÍCIO: 23/04",
                "box2": "ON-LINE | AO VIVO",
                "persona": "executivo em escritório",
            },
        )
        context = {
            "meta": {"kv_palette": {"primary": "#005E7A", "overlay": "#004F6A"}},
            "etiqueta": {"texto_atual": "EXTENSÃO"},
            "titulo": {"texto_atual": "Gestão de Resseguro"},
            "frase": {"texto_atual": "Frase de apoio"},
        }

        prompt = orchestrator._build_step3_validator_prompt(context, request.request_meta).lower()

        assert "box1" in prompt
        assert "box branca" in prompt
        assert "box2" in prompt
        assert "não é branca" in prompt
        assert "contorno" in prompt
        assert "cor do kv" in prompt
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_integration_mock.py -k differentiates_box1_and_box2_styles -v`
Expected: FAIL, porque o prompt atual ainda não deixa essa distinção explícita.

**Step 3: Write minimal implementation**

Em `main.py`, ajustar a seção de estilo/largura das boxes em `_build_step3_validator_prompt()` para explicitar:

```python
"4) Estilo independente box1/box2: box1 é a box branca do layout e deve permanecer branca quando esse estilo for exigido pelo template. "
"Box2 não é branca; deve preservar a lógica visual do template, incluindo contorno, preenchimento e cores derivadas do KV. "
"Reprovar se box2 for convertida em caixa branca sólida quando o template exigir box com contorno/estilo do KV.\n"
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_integration_mock.py -k differentiates_box1_and_box2_styles -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_integration_mock.py main.py
git commit -m "test: lock box1 and box2 style semantics in step3 validator"
```

---

### Task 2: Travar por teste a instrução dedicada para `box1` larga

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\tests\test_integration_mock.py`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\main.py`

**Step 1: Write the failing test**

Expandir o teste já existente do prompt do Step 3 ou criar um novo teste validando que o protocolo de correção exige instrução dedicada para `box1` larga.

```python
def test_step3_validator_prompt_requires_dedicated_box1_compaction_instruction():
    orchestrator = NexusImageOrchestrator()
    meta = BannerRequest(
        request_meta={"canal": "05_whatsapp", "kv": "pos"},
        content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "INÍCIO: 23/04", "box2": "ON-LINE", "persona": "P"},
    ).request_meta
    context = {"meta": {"kv_palette": {"primary": "#005E7A"}}}

    prompt = orchestrator._build_step3_validator_prompt(context, meta).lower()

    assert "se for erro de largura de box1" in prompt
    assert "tight, short white rectangular pill-shaped box" in prompt
    assert "closely wrapping the text" in prompt
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_integration_mock.py -k dedicated_box1_compaction_instruction -v`
Expected: FAIL, porque o prompt atual apenas manda “encurtar a box”.

**Step 3: Write minimal implementation**

Em `main.py`, substituir a orientação genérica de correção de largura por uma regra direcionada para `box1`.

```python
"No prompt_correcao, se for erro de largura de box1, usar uma instrução dedicada e autossuficiente focada só na box1, "
"no estilo: Include a tight, short white rectangular pill-shaped box containing the text 'TEXTO DA BOX'. "
"The white box must be narrow, closely wrapping the text without extra horizontal space on the sides.\n"
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_integration_mock.py -k dedicated_box1_compaction_instruction -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_integration_mock.py main.py
git commit -m "feat: add dedicated box1 compact correction wording"
```

---

### Task 3: Travar por teste que `box2` larga não vira box branca

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\tests\test_integration_mock.py`
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\main.py`

**Step 1: Write the failing test**

Adicionar um teste cobrindo que a orientação de correção para `box2` larga preserva o estilo do KV e proíbe box branca.

```python
def test_step3_validator_prompt_requires_kv_styled_box2_instruction():
    orchestrator = NexusImageOrchestrator()
    meta = BannerRequest(
        request_meta={"canal": "05_whatsapp", "kv": "pos"},
        content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "INÍCIO", "box2": "ON-LINE | AO VIVO", "persona": "P"},
    ).request_meta
    context = {"meta": {"kv_palette": {"primary": "#005E7A"}}}

    prompt = orchestrator._build_step3_validator_prompt(context, meta).lower()

    assert "se for erro de largura de box2" in prompt
    assert "não transformar a box2 em box branca" in prompt
    assert "contorno" in prompt
    assert "cor do kv" in prompt
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_integration_mock.py -k kv_styled_box2_instruction -v`
Expected: FAIL, porque o prompt atual não traz essa proteção específica.

**Step 3: Write minimal implementation**

Em `main.py`, complementar o protocolo de correção com uma instrução dedicada para `box2`.

```python
"No prompt_correcao, se for erro de largura de box2, usar uma instrução dedicada e autossuficiente focada só na box2, "
"preservando o estilo do template: box2 não é branca, deve manter contorno, preenchimento e cor ligados ao KV, "
"ficando justa ao redor do ícone e do texto, sem espaço lateral excessivo.\n"
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/test_integration_mock.py -k kv_styled_box2_instruction -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_integration_mock.py main.py
git commit -m "feat: protect box2 kv outline style in step3 corrections"
```

---

### Task 4: Reforçar a regra central sem espalhar para payloads existentes

**Files:**
- Modify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\main.py`
- Test: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\tests\test_integration_mock.py`

**Step 1: Write the failing test**

Adicionar um teste para garantir que o protocolo do Step 3 manda focar apenas as boxes reprovadas, sem misturar com KV/logo/persona quando o problema é só largura de box.

```python
def test_step3_validator_prompt_keeps_box_width_corrections_scoped():
    orchestrator = NexusImageOrchestrator()
    meta = BannerRequest(
        request_meta={"canal": "05_whatsapp", "kv": "pos"},
        content_keys={"etiqueta": "A", "titulo": "B", "frase": "C", "box1": "D", "box2": "E", "persona": "F"},
    ).request_meta

    prompt = orchestrator._build_step3_validator_prompt({}, meta).lower()

    assert "se somente boxes falharem" in prompt
    assert "não mencionar degradê ou logotipo" in prompt
    assert "persona/fundo são fora de escopo" in prompt
```

**Step 2: Run test to verify it fails or is incomplete**

Run: `pytest tests/test_integration_mock.py -k keeps_box_width_corrections_scoped -v`
Expected: PASS parcial ou FAIL por falta de clareza suficiente; usar o resultado para ajustar wording mínimo.

**Step 3: Write minimal implementation**

Se necessário, reforçar o protocolo em `main.py` sem criar nova camada ou novo payload:

```python
"Se a reprovação for apenas box1 e/ou box2 por largura excessiva, o prompt_correcao deve focar exclusivamente nessas boxes, "
"sem mencionar persona, fundo, degradê, logotipo ou qualquer critério já aprovado.\n"
```

**Step 4: Run the focused tests**

Run: `pytest tests/test_integration_mock.py -k "step3_validator_prompt and (box1 or box2 or boxes)" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_integration_mock.py main.py
git commit -m "refactor: tighten step3 box-width correction scope"
```

---

### Task 5: Verificação final e sanidade do arquivo

**Files:**
- Verify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\main.py`
- Verify: `c:\Users\raphaeloliveira\Desktop\Projetos Saas\Agência NexusAI\nexus-designer-v3-main\tests\test_integration_mock.py`

**Step 1: Run the targeted regression suite**

Run: `pytest tests/test_integration_mock.py -k "step3_validator_prompt or planner_step" -v`
Expected: PASS

**Step 2: Run diagnostics on edited files**

Usar diagnósticos do editor para verificar se `main.py` e `tests/test_integration_mock.py` ficaram sem erros novos.

Expected: sem erros introduzidos pela mudança.

**Step 3: Review prompt size and maintainability**

Confirmar que `_build_step3_validator_prompt()` continua legível. Se a função crescer demais, extrair pequenos blocos auxiliares para manter o arquivo sustentável.

**Step 4: Commit**

```bash
git add main.py tests/test_integration_mock.py
git commit -m "test: cover step3 compact box correction workflow"
```
