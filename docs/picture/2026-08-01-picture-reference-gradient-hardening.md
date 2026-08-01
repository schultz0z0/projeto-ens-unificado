# Picture-Hermes: referência, degradê KV e texto determinístico

**Data:** 2026-08-01  
**Escopo:** importação de referências do workspace, composição de fundos KV, texto Satori, orientação do Hermes e validação do fluxo determinístico.  
**Branch:** `main`.  
**Estado inicial:** falha reproduzida em produção; implementação ainda não iniciada neste documento.

## 1. Objetivo

Corrigir o fluxo em que uma imagem anexada aparece no workspace Picture, mas não pode ser aberta pelo compositor, e elevar o modo determinístico para produzir fundos coerentes com o KV do curso:

- preservar e renderizar a referência pelo `relative_path` exato do manifest;
- aplicar degradê ENS/KV sobre fotografia ou sobre canvas local;
- garantir que texto determinístico não seja aceito em uma forma que renderize vazio;
- orientar o Hermes a consultar contexto oficial do curso, usar tokens do design system e escolher o pipeline adequado;
- manter FAL opcional: quando houver crédito, gerar apenas fotografia/persona/fundo e finalizar marca, degradê, logo e texto localmente.

## 2. Reprodução real de 2026-08-01

Fluxo executado no Chrome do usuário:

1. Abriu-se `https://app.solucoes-nexus.tech/` no workspace Picture já autenticado.
2. Confirmou-se a referência `Modelos P_s.png` na seção **Referências**.
3. Foi solicitada nova revisão 100% determinística, usando a referência como fundo, preservando foto e logo e aplicando degradê teal com texto à esquerda.
4. Em paralelo, os logs foram atualizados em `https://hermes.solucoes-nexus.tech/logs`.
5. O Hermes chamou `picture_get_workspace`, `picture_revise` e `picture_get_job`.
6. A revisão terminou com `picture_asset_missing`: `references/Modelos P_s.png` foi resolvido no pacote temporário, mas o arquivo não existia nesse caminho.
7. A candidata anterior foi preservada, como esperado.

### Evidências

| Superfície | Evidência |
|---|---|
| Frontend | O manifest exibe `references/Modelos P_s.png`. |
| Hermes | O plano de revisão usa exatamente `references/Modelos P_s.png`. |
| Picture | O job falha com `Image asset not found`. |
| Pacote temporário | O builder renomeia o arquivo para um slug, quebrando o caminho publicado no manifest. |
| Candidata anterior | Fundo creme com formas teal; degradê muito sutil e nenhum texto visível. |
| Plano anterior | `satori-text.jsx` foi enviado como string contendo marcação HTML/JSX, embora o compositor espere uma árvore JSON Satori. |

## 3. Causas-raiz

### P0 — divergência entre manifest e pacote

`PictureReferenceService` publica a referência com um path canônico sob `references/`. O Hermes recebe esse path pelo manifest e o reutiliza corretamente. Porém, `PicturePackageBuilder` transforma o nome outra vez com `safeReferenceName()` antes de escrever no pacote temporário.

Exemplo observado:

```text
manifest/CompositionPlan: references/Modelos P_s.png
arquivo materializado:   references/modelos-p-s.png
```

O compositor resolve o primeiro caminho e, corretamente, não encontra o segundo. Reimportar o mesmo arquivo não corrige a causa.

### P0 — texto aceito em forma não renderizável

O contrato aceita `satori-text.jsx` como string na raiz. O Hermes enviou strings como:

```text
<div style={{...}}>PÓS-GRADUAÇÃO</div>
```

O runtime não interpreta JSX/HTML arbitrário; ele passa strings como texto cru ao Satori. A chamada é aceita, mas o resultado pode ficar vazio. O contrato deve exigir um elemento JSON na raiz e permitir strings apenas em `children`.

### P1 — receita visual insuficientemente prescritiva

O engine já possui `gradient-overlay`, mas a skill não define uma receita específica para:

- fotografia de referência + faixa/degradê de leitura;
- canvas sem fotografia e sem FAL;
- uso de paleta do KV do curso recuperada do RAG/design system;
- geração futura de persona sem texto/logo e composição determinística posterior.

Como consequência, o Hermes criou um fundo creme genérico com círculos, apesar de o pedido e o KV apontarem para fotografia com degradê teal.

### P1 — imagem de fundo sem controle explícito de enquadramento

O overlay de imagem sempre usa `fit: cover` e posição central. Quando a proporção da referência diverge do canvas, logo ou persona podem ser recortados. O contrato precisa expor `fit` e `position` para que o planner escolha entre preenchimento, preservação integral e foco lateral.

### P1 — formas de linha podem ser aceitas sem geometria

`shape: line` e `shape: arrow` só renderizam quando `from` e `to` existem, mas o schema permite omiti-los. O plano real enviou uma linha sem esses pontos. O contrato deve rejeitar esse estado em vez de publicar uma camada vazia.

## 4. Desenho da correção

### 4.1 Referências

- Materializar cada artefato exatamente em `entry.relative_path`.
- Continuar validando ownership, categoria, lifecycle e path seguro.
- Não reconstruir, transliterar ou adivinhar nomes dentro do pacote.
- Manter o `relative_path` do manifest como a única identidade de caminho consumida pelo Hermes e pelo compositor.

### 4.2 Texto Satori

- Exigir objeto raiz `{ "tag", "props", "children" }` em `satori-text.jsx`.
- Permitir strings e números apenas dentro de `children`.
- Descrever a restrição no JSON Schema MCP.
- Atualizar skill, template e contrato efêmero do bridge para proibir strings HTML/JSX.

### 4.3 Fundo KV determinístico

Com referência:

1. `image` no fundo usando o path exato do manifest;
2. `fit` e `position` escolhidos conforme a proporção e os elementos que devem ser preservados;
3. `gradient-overlay` da cor primária do KV, opaco na área de texto e transparente sobre a persona;
4. texto e CTA em nós JSON Satori;
5. nenhuma nova logo quando a referência já possuir logo.

Sem referência e sem FAL:

1. gradiente multistop com cores oficiais do KV;
2. no máximo duas formas de apoio derivadas do design system;
3. área negativa e contraste definidos para a hierarquia textual;
4. nenhuma persona sintética falsa.

Com FAL disponível:

1. consultar RAG/design system antes do plano;
2. gerar somente cenário/persona sem texto, logo ou CTA;
3. reservar área negativa conforme o layout;
4. aplicar gradiente, marca e texto pelo compositor local.

### 4.4 Enquadramento de imagem

Adicionar ao overlay `image`:

- `fit`: `cover`, `contain`, `fill`, `inside` ou `outside`;
- `position`: `center`, `left`, `right`, `top`, `bottom`, `attention` ou `entropy`.

Defaults permanecem `cover` e `center` para compatibilidade.

## 5. Plano de implementação

### Fase A — RED

- [x] Teste: pacote preserva `references/Modelos P_s.png` byte a byte.
- [x] Teste: contrato rejeita raiz Satori em string/HTML.
- [x] Teste: contrato rejeita `line`/`arrow` sem `from` e `to`.
- [x] Teste: imagem respeita `fit`/`position` em cenário com proporções diferentes.
- [x] Teste: template de revisão por referência é determinístico, usa imagem → degradê → texto JSON e não contém operações FAL.
- [x] Teste: gradiente colorido para transparente renderiza mesmo sem fontes instaladas.
- [x] Teste: metadata de referência fora de `references/` é recusada e não gera retry inútil.
- [x] Executar os testes e registrar a falha esperada de cada comportamento.

### Fase B — GREEN

- [x] Preservar o path canônico no `PicturePackageBuilder`.
- [x] Tornar o schema Satori estrito na raiz.
- [x] Validar geometria obrigatória de linhas e setas.
- [x] Implementar `fit` e `position` no compositor/contrato/tipos.
- [x] Atualizar `picture-hermes` para versão 1.3 com a receita KV e regras de path/texto.
- [x] Adicionar template determinístico de revisão com referência.
- [x] Reforçar o contrato de sistema do chat bridge.

### Fase C — REFACTOR e documentação

- [x] Remover normalização redundante de nome de referência.
- [x] Atualizar `docs/picture-hermes-operations.md` com receita, deploy e teste manual.
- [x] Registrar resultados RED/GREEN e limitações neste documento.

### Fase D — validação

- [x] Testes focados Picture.
- [x] Suíte completa Picture, typecheck e build Bun.
- [x] Suíte completa do chat bridge.
- [x] Teste de runtime da skill Hermes.
- [x] Teste local de composição com a referência real `Modelos Pós.png`, degradê e texto.
- [x] `git diff --check` e revisão do diff.
- [x] Validação do merge do Docker Compose sem subir produção.

## 6. Critérios de aceite

- Uma referência cujo nome contenha espaço, underscore ou caractere normalizado é aberta pelo compositor usando o path do manifest.
- Reimportar não é necessário para corrigir a referência já existente.
- Um plano com JSX/HTML em string falha na validação antes do job.
- Um plano válido com nó JSON Satori produz pixels de texto visíveis.
- O degradê teal cobre a área esquerda e se torna transparente na área da persona.
- O Hermes usa contexto oficial do curso e tokens de KV antes de escolher cores.
- O modo determinístico não acessa FAL.
- O modo futuro com FAL gera apenas asset visual e preserva composição de marca local.
- Nenhum deploy é executado nesta sessão; os comandos e testes manuais ficam documentados para o operador.

## 7. Registro de execução

| Etapa | Estado |
|---|---|
| Reprodução no Chrome e logs Hermes | concluída |
| Diagnóstico de código | concluído |
| Documento e plano | concluídos antes da implementação |
| RED | concluído; cada regressão falhou pela causa esperada antes da implementação |
| GREEN | concluído |
| Verificação completa | concluída |
| Deploy | responsabilidade do operador |

## 8. Resultado da implementação

- `PicturePackageBuilder` materializa referências no `relative_path` canônico e
  recusa paths fora de `references/`.
- O schema MCP exige nó JSON na raiz de `satori-text.jsx` e endpoints em linhas
  e setas.
- Imagens aceitam `fit` e `position` com defaults retrocompatíveis.
- Gradientes não dependem mais de fontes quando não há texto.
- A skill `picture-hermes` 1.3 inclui consulta de RAG/KV, três receitas de fundo
  (referência, determinístico puro e híbrido FAL) e template de revisão.
- O Bridge reforça o contrato no prompt efêmero mesmo em sessões com skill
  persistida antiga.
- A composição local com a imagem real gerou 1200 × 800, com pessoa preservada,
  degradê teal e texto Outfit visível, sem acessar FAL.

### Evidência final local

| Verificação | Resultado |
|---|---|
| Picture | 78 testes, 0 falhas, 210 assertions |
| Picture typecheck | `tsc --noEmit`, exit 0 |
| Picture build | bundle concluído, `dist/index.js` |
| Chat Bridge | 87 testes, 0 falhas |
| Hermes skill/runtime | 1 teste passou; 1 skip esperado no Windows por exigir POSIX/bash |
| Docker Compose | merge base + produção válido |
| Chrome pré-correção | falha reproduzida; consoles do app e logs sem warnings/errors de navegador |
| FAL | nenhuma chamada executada |

### Limite da validação

O app de produção continua executando a imagem anterior até o deploy. A
validação pós-deploy deve seguir o roteiro de `docs/picture-hermes-operations.md`.
O caminho pago FAL permanece deliberadamente não executado até existir crédito.
