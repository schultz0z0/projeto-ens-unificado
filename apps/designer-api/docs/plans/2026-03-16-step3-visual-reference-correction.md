# Plano de Implementação: Correção Visual Guiada por Template (Plano B)

> **Goal:** Melhorar a eficácia da correção automática de peças (Step 3) utilizando o template original como referência visual estrutural, mas preservando o texto da imagem atual para evitar regressões.

**Architecture:** 
Ajustaremos o fluxo de correção do Step 3 no `NexusImageOrchestrator`. Atualmente, ele usa `_edit_image_step` (apenas prompt + imagem atual). Mudaremos para `_edit_image_step_with_reference`, passando o template original (`kv_reference_path`) como âncora visual para degradê, logo e geometria.
Para evitar que o texto "volte" para o texto do template (que está na imagem de referência), o prompt de correção será blindado com instruções explícitas de "Text Lock" e "Structure Only Reference".

**Tech Stack:** Python, Google GenAI SDK (Gemini), Pillow.

---

### Task 1: Refatorar chamada de correção no Step 3

**Files:**
- Modify: `main.py` (método `process_job`)

**Step 1: Localizar bloco de correção do Step 3**
No arquivo `main.py`, dentro de `process_job`, localizar o bloco `if step3_validation.status == "CORREÇÃO"`.

**Step 2: Alterar estratégia de edição**
Substituir a chamada `self._edit_image_step(...)` por `self._edit_image_step_with_reference(...)`.

**Inputs necessários:**
- `current_image_path`: Imagem atual (com texto correto, mas KV/boxes com defeito).
- `correction_prompt`: Prompt de correção (será ajustado na Task 2).
- `step3_correction_path`: Caminho de saída.
- `kv_reference_path`: O template original (limpo ou base).
- `reference_hint`: String descritiva ("estrutura visual do template e degradê").

**Step 3: Tratamento de erro (Fallback)**
Manter `try/catch` para fallback. Se a edição com referência falhar (ex: erro 500 ou filtro de segurança), reverter para `_edit_image_step` simples.

---

### Task 2: Blindagem do Prompt de Correção

**Files:**
- Modify: `main.py` (construção de `correction_prompt` dentro de `process_job`)

**Step 1: Ajustar construção do prompt**
Atualizar a string `correction_prompt` para incluir instruções explícitas de separação de responsabilidade:
1. **Referência Visual:** "Use a imagem de referência APENAS para recuperar: degradê, logotipo, alinhamento de boxes e geometria."
2. **Trava de Texto:** "IGNORE TODO O TEXTO da imagem de referência. O texto correto é o que já está na imagem atual. NÃO reverta para o texto do template."
3. **Validação:** Inserir os textos esperados (`current_text_lock`) como verdade absoluta.

**Step 2: Refinar `_edit_image_step_with_reference`**
Verificar se o método `_edit_image_step_with_reference` (linha ~1193) precisa de ajuste no prompt interno para suportar essa lógica de "ignorar texto da referência".
*Ação:* Adicionar parâmetro opcional `ignore_reference_text=True` ou ajustar o prompt interno para não ser tão rígido em "copiar tudo da referência".

**Alteração proposta no `_edit_image_step_with_reference`:**
```python
full_prompt = (
    f"{prompt}\n"
    "FUNCÃO DA REFERÊNCIA: Fonte da verdade para DEGRADÊ, LOGO e GEOMETRIA das boxes.\n"
    "ATENÇÃO CRÍTICA: O texto da imagem de referência é antigo e DEVE SER IGNORADO.\n"
    "Mantenha os textos atuais da imagem de entrada, apenas ajustando o fundo/caixa ao redor deles para bater com a referência visual.\n"
    f"Aplique as correções solicitadas em: {reference_hint}."
)
```

---

### Task 3: Teste de Validação (Mock)

**Files:**
- Create/Modify: `tests/test_step3_correction.py`

**Step 1: Criar teste unitário**
Simular um cenário onde:
- `current_image`: Tem texto "NOVO TEXTO" mas degradê ruim.
- `reference_image`: Tem texto "LOREM IPSUM" e degradê bom.
- `prompt`: "Corrigir degradê".
- Mock da API Gemini deve receber os dois arquivos e o prompt blindado.

**Step 2: Verificar chamada**
Assegurar que o prompt enviado à API contém as instruções de "IGNORE TEXTO DA REFERÊNCIA".

---

### Task 4: Execução Manual (Opcional/Verificação)

**Files:**
- Run: `manual_test.py`

**Step 1: Rodar fluxo real**
Executar um job que force correção (ex: pedir algo que o modelo erra, como box muito larga) e observar os logs para ver se o "Step 3 Unified Correction" foi acionado com referência.
