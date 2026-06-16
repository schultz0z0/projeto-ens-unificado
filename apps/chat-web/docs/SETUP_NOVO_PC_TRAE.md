# Setup em PC Novo (GitHub + Trae) — Nexus AI 2.0

Este passo a passo serve para:

- Clonar o projeto via GitHub em um computador novo
- Instalar dependências com consistência (lockfile)
- Configurar variáveis de ambiente sem vazar segredos
- Iniciar o projeto (dev/preview)
- Rodar o gate de QA/Segurança antes de continuar o desenvolvimento

## 1) Pré-requisitos (instalar no PC novo)

- Git (com acesso ao repositório no GitHub)
- Node.js LTS (recomendado: 20.x)
- npm (vem junto com o Node)

Opcional (para trabalhar com Supabase e Edge Functions):

- Supabase CLI (o projeto também tem `supabase` como devDependency)

## 2) Clonar o projeto via GitHub

1. Abra um terminal.
2. Escolha uma pasta de trabalho.
3. Clone o repositório:

```bash
git clone <URL_DO_REPO>
```

4. Entre na pasta do projeto:

```bash
cd "Nexus AI 2.0"
```

5. Se precisar mudar de branch:

```bash
git checkout <nome-da-branch>
```

## 3) Instalar dependências (modo reprodutível)

Este projeto usa `package-lock.json`. Para garantir que o PC novo fique idêntico ao anterior, use `npm ci`.

```bash
npm ci
```

## 4) Configurar variáveis de ambiente (.env)

Existe um arquivo `.env` no projeto. Para migrar de PC com segurança:

- Não commite `.env` no GitHub.
- Copie as chaves do seu gerenciador seguro (ou do PC antigo) e crie/atualize o `.env` localmente.
- Nunca coloque `service_role` no frontend.

### 4.1 Variáveis mínimas do Frontend (obrigatórias)

O app usa Supabase no browser via Vite. No `.env` (na raiz do projeto), garanta:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Se estiverem ausentes, o app falha ao iniciar com erro de variáveis do Supabase.

Referência: [supabase.ts](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/Nexus%20AI%202.0/src/lib/supabase.ts)

### 4.2 Variáveis para scripts de validação (recomendadas)

Os scripts de validação e o security gate aceitam tanto `SUPABASE_*` quanto `VITE_SUPABASE_*`.

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Referência: [validate_rls.mjs](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/Nexus%20AI%202.0/scripts/validate_rls.mjs) e [validate_rag_rls.mjs](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/Nexus%20AI%202.0/scripts/validate_rag_rls.mjs)

### 4.3 Variáveis para scripts de migração (somente se for usar)

Alguns scripts aplicam SQL direto via Postgres e exigem credenciais do banco:

```env
SUPABASE_PROJECT_REF=
SUPABASE_DB_PASSWORD=

# Opcional (se você preferir passar a URL completa)
SUPABASE_DATABASE_URL=
DATABASE_URL=
```

Referência: [apply_rag_migration.js](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/Nexus%20AI%202.0/scripts/apply_rag_migration.js) e [apply_migration.js](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/Nexus%20AI%202.0/scripts/apply_migration.js)

## 5) Rodar o gate de QA/Segurança (obrigatório antes de continuar)

Roda RLS checks, lint, build e audit:

```bash
npm run security:gate
```

Script: [security_gate.mjs](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/Nexus%20AI%202.0/scripts/security_gate.mjs)

Se falhar por variáveis ausentes, volte na seção 4.

## 6) Iniciar o projeto

### 6.1 Modo desenvolvimento

```bash
npm run dev
```

Abra a URL que o terminal indicar (normalmente `http://127.0.0.1:5173/`).

### 6.2 Modo preview (simula produção local)

```bash
npm run build
npm run preview
```

## 7) (Opcional) Edge Functions do Supabase

Se você for trabalhar nas Edge Functions (proxy para n8n, admin-create-user, etc.), os segredos devem ficar no Supabase (Dashboard/Secrets) e não no frontend.

### 7.1 Variáveis comuns das Edge Functions

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ALLOWED_ORIGINS` (lista separada por vírgula, ou `*`)

### 7.2 Integração n8n (proxy-chatbot)

- `N8N_CHATBOT_URL`
- `N8N_API_KEY`
- `N8N_WEBHOOK_SECRET`

Referência: [proxy-chatbot/index.ts](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/Nexus%20AI%202.0/supabase/functions/proxy-chatbot/index.ts)

### 7.3 Integração n8n (proxy-image-generator)

- `N8N_API_KEY`
- `N8N_WEBHOOK_SECRET`
- `N8N_GRADUACAO_WHATSAPP_URL`
- `N8N_MBA_WHATSAPP_URL`
- `N8N_CHCS_WHATSAPP_URL`
- `N8N_QUALIFICACOES_WHATSAPP_URL`

Referência: [proxy-image-generator/index.ts](file:///c:/Users/raphaeloliveira/Desktop/Projetos%20Saas/Nexus%20AI%202.0/supabase/functions/proxy-image-generator/index.ts)

## 8) Checklist rápido para a IA do Trae (no PC novo)

1. Abrir a pasta do projeto no Trae.
2. Rodar `npm ci`.
3. Garantir `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Rodar `npm run security:gate` e não prosseguir se falhar.
5. Rodar `npm run dev` para trabalhar no dia a dia.
6. Antes de entregar mudança: `npm run build` e (ideal) `npm run preview` para smoke manual.

