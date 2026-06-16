# Fluxo Operacional de Melhoria: Orquestrador de Imagens Nexus Designer (Nano Banana Pro)

Este documento detalha o fluxo operacional, arquitetura de dados e plano de implementação para o sistema de geração de banners iterativo utilizando a API do Gemini (Nano Banana Pro).

## 1. Visão Geral do Processo

O sistema opera como um **pipeline de edição iterativa**. Diferente de gerar uma imagem do zero, ele parte de um **Template Base (PNG)** e aplica edições sequenciais (inpainting/editing) preservando rigidamente o layout e fontes originais (Outfit).

### Princípio "Stateful Image"
A saída do Passo N torna-se a entrada do Passo N+1.
`Template Original -> Edição 1 (Etiqueta) -> Edição 2 (Título) -> ... -> Resultado Final`

---

## 2. Fluxo de Orquestração Detalhado

O backend (`app.py` + `execution/pipeline.py`) deve gerenciar este estado.

### Etapa 0: Recepção e Validação (Firewall)
*   **Entrada**: JSON do Frontend (`BannerJobRequest`).
*   **Ação**:
    1.  Validar Schema (Pydantic).
    2.  Verificar existência do Template Base (KV + Modalidade) no disco.
    3.  **Carregar Contexto**: Ler o arquivo `template_context.json` correspondente ao template.
    4.  Se usuário enviou PNG de persona: Validar formato/tamanho e salvar em temp.
*   **Checkpoint**: Se falhar aqui, retornar `400 Bad Request` imediatamente.

### 1.1 Arquitetura de Contexto (O "Cérebro" do Template)
Cada pasta de template terá não apenas a imagem (`base.png`), mas um arquivo de definição (`template_context.json`) que descreve o que *já existe* na imagem. Isso permite que a IA saiba exatamente o que deve ser substituído.

**Exemplo de `template_context.json`:**
```json
{
  "etiqueta": { "texto_atual": "MBA", "descricao_visual": "Texto pequeno em caixa branca no centro superior" },
  "titulo": { "texto_atual": "Finanças e Seguros", "descricao_visual": "Título grande em destaque central, fonte Outfit Bold" },
  "frase": { "texto_atual": "Quem domina finanças e seguros não acompanha o mercado, lidera ele.", "descricao_visual": "Frase de apoio abaixo do título, fonte Outfit Regular" },
  "box1": { "texto_atual": "Início: 07/04", "descricao_visual": "Box informativo esquerdo" },
  "box2": { "texto_atual": "On-line | Ao vivo", "descricao_visual": "Box informativo direito" },
  "persona": { "descricao": "homem no computador vendo gráficos financeiros" }
}
```

### Etapa 1: Preparação do Contexto
*   **Ação**: Carregar o Template Base (`execution/select_template.py`) e o Contexto JSON.
*   **Estado Inicial**: `current_image_path = template_base.png`, `contexto = template_context.json`

### Etapa 2: Loop de Edição Textual (Sequencial)
Para cada campo (`etiqueta`, `titulo`, `frase`):
1.  **Verificação**: O valor solicitado (`novo_valor`) é diferente do `contexto[campo].texto_atual`?
2.  **Prompt Otimizado**: O prompt agora é comparativo e preciso:
    *   *"Localize o texto '{contexto[campo].texto_atual}' ({contexto[campo].descricao_visual}) e substitua por '{novo_valor}'. Mantenha a fonte Outfit, cor e estilo idênticos ao original."*
3.  **Execução**: Chamar API `gemini-3-pro-image-preview` enviando `current_image_path`.
4.  **Atualização**: Salvar resultado em temp. `current_image_path = resultado_etapa_1.png`.

5.  **Fallback**: Se a API falhar (500/Timeout), tentar mais 1 vez. Se falhar novamente, abortar job e notificar erro.

### Etapa 3: Gestão de Boxes (Lógica Condicional)
Para `box1` e `box2`:
*   **Cenário A (Texto fornecido)**: Mesmo fluxo de edição textual acima.
*   **Cenário B (Vazio)**:
    *   **Prompt**: *"Remova a caixa de texto/elemento visual localizado em [descrição]. Preencha o fundo coerentemente (inpainting)."*
    *   **Execução**: Atualizar `current_image_path`.

### Etapa 4: Integração de Persona (O passo mais complexo)
*   **Cenário A (Upload de PNG)**:
    *   **Ação**: Composição de imagem (Overlay) ou Inpainting guiado.
    *   **Prompt**: *"Substitua a pessoa na imagem atual por esta imagem de referência fornecida. Ajuste iluminação e recorte para harmonizar com o fundo."*
*   **Cenário B (Descrição de Persona)**:
    *   **Prompt**: *"Gere uma [descrição da persona] e substitua a pessoa atual na imagem. Mantenha o estilo fotográfico do template."*

### Etapa 5: Finalização e Entrega
*   Salvar `current_image_path` como `final_{job_id}.png` na pasta pública.
*   Atualizar status do Job para `COMPLETED`.
*   Disponibilizar URL para download.

---

## 3. Checkpoints e Política de Fallback

Para garantir robustez ("Trust No One"):

| Ponto de Falha | Risco | Política de Fallback (Ação Automática) |
| :--- | :--- | :--- |
| **Validação de Input** | Dados maliciosos ou incompletos | Rejeitar requisição com mensagem de erro detalhada (Zod/Pydantic). |
| **Template não encontrado** | Arquivo deletado ou nome errado | Logar erro crítico. Retornar erro ao usuário: "Template indisponível no momento". |
| **API Gemini (Timeout)** | Latência alta na geração | Retry imediato (até 2x) com backoff exponencial. |
| **API Gemini (Recusa/Safety)** | Prompt bloqueado por segurança | Marcar job como `FAILED_SAFETY`. Notificar usuário para revisar termos. |
| **Erro de IO (Salvar imagem)** | Disco cheio ou permissão | Logar erro de sistema. Tentar salvar em `/tmp` alternativo se possível. |

---

## 4. Estrutura de Dados (Interfaces)

### Backend (Pydantic)
```python
class BannerJobRequest(BaseModel):
    canal: str
    kv: str  # Define o Template Base
    etiqueta: str
    titulo: str
    frase: str
    box1: Optional[str] = None
    box2: Optional[str] = None
    persona_style: Optional[str] = None
    persona_image_b64: Optional[str] = None # Para upload direto
```

### Job Store (In-Memory -> Redis Futuro)
```python
class JobStatus(Enum):
    PENDING = "pending"
    PROCESSING_STEP_1 = "processing_etiqueta"
    PROCESSING_STEP_2 = "processing_titulo"
    # ... outros passos granulares para feedback na UI
    COMPLETED = "completed"
    FAILED = "failed"

class JobRecord(BaseModel):
    id: str
    status: JobStatus
    current_image_url: Optional[str] # Para preview em tempo real (opcional)
    final_image_url: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
```

---

## 5. Plano de Implementação (To-Do)

1.  **Refatoração do `main.py` (Core Logic)**:
    *   [ ] Criar classe `NexusImageOrchestrator`.
    *   [ ] Implementar método `process_step(image, instruction) -> image`.
    *   [ ] Implementar lógica de salvamento temporário entre passos.

2.  **Atualização da API (`app.py`)**:
    *   [ ] Atualizar endpoints para suportar upload de arquivo (Multipart) para a persona PNG.
    *   [ ] Melhorar endpoint de status para retornar em qual "passo" o processo está.

3.  **Integração com Google GenAI SDK**:
    *   [ ] Configurar cliente com API Key.
    *   [ ] Implementar chamadas seguras com tratamento de exceção (`try/except`).

4.  **Testes**:
    *   [ ] Criar teste unitário simulando o fluxo completo (mockando a API do Gemini para não gastar créditos nos testes de lógica).
