# Picture-Hermes: melhorias pós-validação em produção

**Data:** 2026-08-01  
**Branch:** `main`  
**Escopo:** troca imediata de peça no frontend, status do gateway no dashboard e redução de chamadas inválidas no modo determinístico.

## Evidência e causas-raiz

### Nova peça exigia F5

O backend encerrava o workspace anterior e devolvia uma nova sessão corretamente. O componente de chat, porém, permanecia montado. Como o carregamento de uma sessão vazia preserva mensagens otimistas, as mensagens da sessão anterior continuavam na tela até o reload.

**Correção:** o `ChatInterface` agora é identificado por `chat_session_id`. Uma nova sessão remonta apenas o chat, zerando mensagens, anexos, streaming e rascunho sem recarregar a página inteira.

### Dashboard mostrava gateway parado

O gateway executa no container `hermes-api`, enquanto o dashboard executa em `hermes-kanban`. A checagem local por PID não é válida entre namespaces de processos de containers diferentes, apesar de ambos compartilharem os dados do Hermes.

**Correção:** o dashboard recebe `GATEWAY_HEALTH_URL=http://hermes-api:8652` e usa o probe HTTP já suportado pelo Hermes. O timeout é configurável por `NEXUS_HERMES_GATEWAY_HEALTH_TIMEOUT`, com padrão de três segundos.

### Fluxo determinístico fazia chamadas extras

Os logs mostraram duas rejeições de schema antes do primeiro job aceito: `workspace_id` em forma incorreta e `depth` fora do enum. O único template inicial era generativo e não servia como referência literal para o cenário sem crédito FAL.

**Correções:** 

- contrato efêmero informa a sequência mínima `picture_get_workspace` → `picture_start_job` → `picture_get_job`;
- `workspace_id` deve ser a string literal fornecida pelo sistema;
- `depth` fica restrito a `background`, `midground`, `foreground`, `overlay` ou `frame`;
- a skill 1.4 inclui `picture-start-deterministic.json`, com um único `compose`, gradiente KV, uma forma de apoio e texto Satori JSON;
- `picture_start_job` não deve ser repetido após aceitação; apenas o status do job pode ser consultado novamente.

## Upload de referência

O upload do app não apresentou falha funcional: seletor, drag-and-drop e colagem convergem para o mesmo fluxo, e a colagem foi validada em produção. O erro `Not allowed` ocorreu na integração de automação do Chrome ao tentar controlar o seletor nativo de arquivos. Não foi adicionada uma alteração artificial ao produto para contornar uma permissão do navegador; a validação automatizada local pode usar diretamente o input `#chat-composer-file-upload`.

## Testes de regressão

- frontend: troca de `chat_session_id` remove imediatamente o estado local da peça anterior;
- dashboard: entrypoint e Compose propagam URL e timeout do health remoto;
- bridge: o prompt Picture contém o caminho determinístico mínimo e argumentos literais;
- runtime: o template determinístico existe, contém somente `compose`, limita formas e usa apenas depths válidos;
- schema/render: o template foi aceito pelos schemas reais e renderizado localmente em PNG 1080 × 1080 sem `FAL_KEY`.

## Impacto de deploy

É necessário reconstruir e recriar `app-frontend`, `app-bridge`, `hermes-api` e `hermes-kanban`. O `picture-it` não recebeu código novo, mas deve permanecer saudável para o teste integrado. A nova skill é instalada no boot do `hermes-api`; sessões Hermes antigas devem ser reiniciadas ou substituídas por uma nova sessão para receber a versão 1.4.
