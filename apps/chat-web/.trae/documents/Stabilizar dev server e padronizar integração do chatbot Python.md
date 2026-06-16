## Contexto (o que está acontecendo)
- O `npm run dev` está falhando antes mesmo de rodar o app por um problema de dependência nativa do Rollup no Windows: `@rollup/rollup-win32-x64-msvc` com `ERR_DLOPEN_FAILED` (“not a valid Win32 application”). Isso é um problema de instalação de dependências (node_modules), não do chatbot em si. O próprio stack trace aponta a falha e sugere reinstalar dependências (bug de optional deps do npm). [StackOverflow](https://stackoverflow.com/questions/77583341/cannot-find-module-rollup-rollup-win32-x64-msvc-npm-has-a-bug-related-to-optio) e [issue do Rollup](https://github.com/rollup/rollup/issues/5571).
- Você já confirmou que o Windows é x64 e que o CORS do backend do chatbot está ok.

## Restrições que vou respeitar
- Não vou mexer no seu Windows (nada de instalar redistribuíveis, drivers, etc.).
- Não vou trocar Node nem “mexer no que já está funcionando” sem extrema necessidade.
- Vou focar em: (1) destravar `npm run dev`, (2) garantir lint sem erros, (3) validar o padrão do chatbot Python.

## Plano (execução após sua confirmação)
### 1) Destravar `npm run dev` com o mínimo de mudanças
1. Medir estado atual (sem mudanças): rodar `node -p process.arch`, `node -v` e `npm -v` para registrar ambiente.
2. Tentativa mínima A (preserva lock):
   - Remover **somente** `node_modules`.
   - Rodar `npm ci` (usa o `package-lock.json` existente).
   - Rodar `npm run dev`.
3. Se ainda falhar com o mesmo erro do Rollup, tentativa mínima B (só se necessário, seguindo o erro do próprio Rollup):
   - Remover `node_modules` **e** `package-lock.json`.
   - Rodar `npm i` (regenera lock).
   - Rodar `npm run dev`.
4. Se ainda falhar, tentativa C (cirúrgica, sem trocar stack):
   - Instalar explicitamente o binário: `npm i -D @rollup/rollup-win32-x64-msvc`.
   - Rodar `npm run dev`.

### 2) “Check total” do frontend para o chatbot (sem mexer em features alheias)
- Rodar `npm run lint`.
- Corrigir **apenas** erros (não warnings) e dar prioridade absoluta ao que toca o chat.

### 3) Padronizar o `.env` para o chatbot (apenas instrução + validação)
- Como o projeto é Vite, a forma mais segura é:
  - `VITE_CHATBOT_API=https://ethyl-cleverish-elyse.ngrok-free.dev`
- Vou validar no código que o frontend está lendo a variável correta e que uma troca no `.env` reflete após reiniciar o dev server.

### 4) Validar a integração do chatbot Python ponta a ponta
- No navegador:
  - Confirmar POST `/api/sessions` com `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`.
  - Confirmar POST `/api/chat/stream` com streaming SSE, juntando `delta` até `done`.
  - Confirmar persistência do `session_id` no localStorage.
  - Confirmar gravação do histórico no Supabase (tabelas já existentes), sem mexer no gerador de imagens (n8n fica intacto).

## Critérios de pronto
- `npm run dev` sobe.
- `npm run lint` sem erros.
- Fluxo do chatbot Python funcionando (sessão + stream + persistência), com URL configurável via `.env`.

Se você aprovar esse plano, eu executo as etapas na ordem acima e só parto para a próxima tentativa se a anterior não resolver.