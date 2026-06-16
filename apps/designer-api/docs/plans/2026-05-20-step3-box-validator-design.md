# Step3 Box Validator Design

**Objetivo:** ensinar o Validador AI do Step 3 a tratar boxes largas como falha específica de geometria compacta e, quando isso acontecer, devolver um `prompt_correcao` 100% focado apenas na box reprovada.

## Contexto

O comportamento atual de validação de boxes já existe no prompt central do Step 3 em `main.py`, com foco em largura justa, ícone interno, alinhamento e organização horizontal/vertical. Porém, a instrução de correção ainda é genérica demais quando a falha é “box larga”, o que permite que o modelo corrija mais áreas da peça do que o necessário.

Os payloads `step3_planner_payload.json` por template hoje reforçam locks de cor e preservação do KV, mas não carregam uma instrução dedicada por box para este caso. Como o comportamento desejado deve valer de forma consistente para os templates ENS, a regra principal deve viver no prompt central do validador, deixando os payloads apenas como espaço de override futuro.

## Decisão

Adotar a solução híbrida:

1. Centralizar em `main.py` a instrução de auditoria para boxes largas.
2. Ensinar o `prompt_correcao` a gerar instruções curtas e autossuficientes por box.
3. Manter os payloads existentes intactos nesta primeira etapa, evitando duplicação e divergência entre templates.
4. Preservar a possibilidade de adicionar regras específicas por template depois, via `planner_overrides` ou `hard_constraints`.

## Regras de Negócio

- `box1` é a box branca.
- Quando `box1` estiver larga demais, a correção deve mandar criar uma white pill box curta, justa ao redor do texto.
- `box2` não é branca.
- `box2` deve manter a lógica visual do template, com contorno/estilo vinculado ao KV, sem virar uma caixa branca sólida.
- O Step 3 continua proibido de alterar persona, fundo, degradê, logo e demais critérios já aprovados.
- Se somente `box1` falhar, a correção deve mencionar somente `box1`.
- Se somente `box2` falhar, a correção deve mencionar somente `box2`.
- Se ambas falharem, a correção deve listar duas instruções curtas, uma para cada box, sem misturar com persona/fundo e sem tocar em KV/logo se já estiverem aprovados.

## Fluxo Proposto

1. O validador analisa a imagem gerada comparando template base, imagem atual e contexto.
2. Se identificar largura excessiva em `box1` ou `box2`, reprova o critério de largura compacta.
3. O `prompt_correcao` passa a ser especializado:
   - para `box1`, instrução dedicada no estilo “tight, short white rectangular pill-shaped box...”
   - para `box2`, instrução dedicada preservando a identidade visual de contorno/fundo da cor do KV, sem solid white fill
4. A correção continua autossuficiente e limitada apenas aos critérios reprovados.

## Impacto Técnico

Os pontos principais de alteração são:

- `main.py`
  - reforçar a redação do prompt do Step 3 para diferenciar claramente `box1` e `box2`
  - orientar a construção de `prompt_correcao` específico por box
- `tests/test_integration_mock.py`
  - travar por teste a nova redação do prompt
  - travar por teste que `box1` usa instrução branca compacta
  - travar por teste que `box2` preserva contorno/estilo do KV e não vira box branca

## Critérios de Aceitação

- O prompt do validador deixa explícito que `box1` é branca e `box2` segue a lógica visual de contorno/estilo do KV.
- O prompt do validador orienta que falha de box larga deve resultar em instrução dedicada por box.
- Os testes falham antes da mudança e passam depois.
- A mudança não exige editar todos os payloads de template nesta primeira etapa.

## Riscos e Mitigações

- Risco: o modelo continuar emitindo correção genérica.
  Mitigação: wording explícito no protocolo do `prompt_correcao` e testes de substring específicos.
- Risco: `box2` ser corrigida como box branca por analogia com `box1`.
  Mitigação: instrução textual explícita dizendo que `box2` não é branca e deve manter contorno/estilo do KV.
- Risco: espalhar regra em vários payloads e gerar inconsistência entre templates.
  Mitigação: manter a regra centralizada no Step 3 por enquanto.

## Próximo Passo

Escrever um plano de implementação TDD em `docs/plans/2026-05-20-step3-box-validator-implementation.md`, com tarefas pequenas para teste, ajuste do prompt e verificação final.
