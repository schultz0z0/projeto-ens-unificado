# Relatório de Auditoria de Segurança e Confiabilidade - Nexus AI

**Data:** 10/12/2025
**Responsável:** Líder de QA, Segurança e Confiabilidade (SRE)
**Status:** 🔴 CRÍTICO (Ação Imediata Necessária)

---

## 1. Resumo Executivo

A auditoria identificou **2 vulnerabilidades críticas** que expõem dados sensíveis de usuários (e-mails) e permitem abuso financeiro/operacional das integrações de IA. O sistema, em seu estado atual, **NÃO** deve ir para produção sem as correções detalhadas abaixo.

## 2. Matriz de Vulnerabilidades

| ID | Vulnerabilidade | Severidade | Localização | Impacto |
|---|---|---|---|---|
| **VULN-01** | **Exposição de Dados Pessoais (LGPD)** | 🔴 CRÍTICA | Supabase RLS (`profiles`) | Qualquer visitante pode baixar a lista completa de nomes e e-mails de todos os usuários cadastrados. |
| **VULN-02** | **Integração n8n Sem Autenticação** | 🔴 CRÍTICA | `ChatInterface.tsx`, `ImageGenerator.tsx` | Webhooks estão públicos. Um atacante pode disparar milhares de requisições, gerando custos de IA e travando a automação. |
| **VULN-03** | **Logs Sensíveis no Console** | 🟡 MÉDIA | `ChatInterface.tsx` | IDs de sessão e usuário são expostos no console do navegador ("🔍 Validation: ..."). |
| **VULN-04** | **Permissões Excessivas para 'Anon'** | 🟡 MÉDIA | `00_master_setup.sql` | Role `anon` tinha permissão de `SELECT` em tabelas públicas desnecessariamente. |

---

## 3. Detalhamento Técnico e Correções

### 3.1. Validação de Segurança de Dados (Supabase)

**Problema:**
A migração inicial criou uma política `Public Read Profiles` com `USING (true)`. Isso desabilita efetivamente a proteção RLS para leitura, tornando a tabela pública.

**Evidência:**
Arquivo `supabase/migrations/00_master_setup.sql`:
```sql
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);
```

**Solução Aplicada (Script SQL):**
Criado o script `supabase/manual/fix_privacy_rls.sql` que:
1. Remove a política pública.
2. Cria política restritiva: Usuário só vê seu próprio perfil (`auth.uid() = id`).
3. Mantém acesso total para Admins via `public.is_admin()`.

### 3.2. Segurança das Integrações Webhook (n8n)

**Problema:**
Os componentes React fazem `fetch` direto para URLs do n8n (`https://ens-automacao.app.n8n.cloud/webhook/...`) sem nenhum cabeçalho de autorização.

**Recomendação Imediata:**
1. **Adicionar Header de Autenticação:** Configurar os workflows do n8n para exigir um Header `X-API-KEY` ou similar.
2. **Proxy de Backend:** Idealmente, o Frontend não deve chamar o n8n diretamente. O Frontend deve chamar uma Edge Function do Supabase, que valida o usuário logado e ENTÃO chama o n8n, injetando a chave de API (que fica segura no servidor).

**Ação Provisória (Mitigação):**
Implementar Rate Limiting no lado do n8n ou usar CAPTCHA no formulário antes de enviar.

### 3.3. Proteção Anti-Hack e Frontend

**Problema:**
Uso excessivo de `console.log` em produção expondo fluxo interno.

**Recomendação:**
Remover ou comentar todos os `console.log` e `console.group` em `src/components/ChatInterface.tsx` antes do build de produção.

---

## 4. Instruções para Intervenção Manual (Supabase)

Para corrigir a falha crítica de privacidade (VULN-01), execute o seguinte procedimento **imediatamente**:

### Pré-requisitos
*   Acesso ao Dashboard do Supabase > SQL Editor.
*   Nenhum backup complexo necessário (alteração apenas de políticas, não de dados), mas um dump da estrutura é recomendado.

### Passo a Passo

1.  Acesse o **SQL Editor** no Supabase.
2.  Copie o conteúdo do arquivo `supabase/manual/fix_privacy_rls.sql`.
3.  Cole no editor e clique em **RUN**.
4.  **Verificação:**
    *   Vá em **Table Editor** > `profiles`.
    *   Tente visualizar os dados. Se você estiver logado como Admin, deve ver tudo.
    *   Crie um usuário de teste (não admin), faça login e tente ver dados de outro usuário via API/Console. Deve ser bloqueado.

---

## 5. Próximos Passos

1.  [ ] Executar script `fix_privacy_rls.sql`.
2.  [ ] Refatorar `ChatInterface.tsx` para remover logs.
3.  [ ] Planejar migração das chamadas n8n para Supabase Edge Functions (para esconder a URL do webhook e proteger com autenticação).

**Assinado:**
*Trae AI SRE & Security Lead*

