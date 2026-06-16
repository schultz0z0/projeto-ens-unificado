# SOP: Integração Frontend ↔ API de Banners

## Objetivo
Padronizar a integração do frontend com a API usando:
- Cloudflare Quick Tunnel (URL aleatória por sessão)
- Fluxo assíncrono com criação de job + polling
- Payload único para `peca_unica` e `enxoval`

---

## 1) Pré-requisitos

1. Subir a API local (`http://localhost:8000`)
2. Subir o tunnel Cloudflare:

```powershell
cloudflared tunnel --url http://localhost:8000
```

3. Copiar a URL `https://...trycloudflare.com`

---

## 2) Variável de ambiente no frontend

### Vite
```env
VITE_API_BASE_URL=https://abc-def-123.trycloudflare.com
```

### Next.js
```env
NEXT_PUBLIC_API_BASE_URL=https://abc-def-123.trycloudflare.com
```

Use no código:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL
// ou
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL
```

Importante:
- Quick Tunnel muda URL ao reiniciar.
- Sempre que mudar URL, atualize o `.env` do frontend e reinicie o app frontend.

---

## 3) Endpoints usados pelo frontend

### 3.1 `GET /banners/form-options`
Retorna opções para montar o formulário sem hardcode.

Exemplo de resposta:

```json
{
  "modos_geracao": ["peca_unica", "enxoval"],
  "canais_enxoval": [
    "01_feed_instagram",
    "03_banner_interno_desktop",
    "04_banner_interno_mobile",
    "05_whatsapp",
    "08_topo_email"
  ],
  "canais_disponiveis": ["01_feed_instagram", "03_banner_interno_desktop"],
  "kvs_disponiveis": ["graduacao", "pos"],
  "templates": {
    "01_feed_instagram": { "pos": ["base_pos_01feed_padrao.jpg"] }
  }
}
```

---

### 3.2 `POST /banners/json`
Cria job com payload JSON para formulário frontend.

Header opcional recomendado:

```http
x-user-id: <uuid-do-usuario-logado-no-supabase-auth>
```

#### Payload — peça única

```json
{
  "modo_geracao": "peca_unica",
  "canal": "03_banner_interno_desktop",
  "kv": "pos",
  "etiqueta": "PÓS-GRADUAÇÃO",
  "titulo": "Gestão de Resseguro",
  "frase": "Onde o resseguro vira decisão.",
  "box1": "Aulas Ao Vivo",
  "box2": "Matrículas Abertas",
  "persona": "Executivo maduro em escritório premium"
}
```

#### Payload — enxoval

```json
{
  "modo_geracao": "enxoval",
  "kv": "pos",
  "etiqueta": "PÓS-GRADUAÇÃO",
  "titulo": "Gestão de Resseguro",
  "frase": "Onde o resseguro vira decisão.",
  "box1": "Aulas Ao Vivo",
  "box2": "Matrículas Abertas",
  "persona": "Executivo maduro em escritório premium"
}
```

Regras:
- `peca_unica`: `canal` obrigatório.
- `enxoval`: `canal` deve ser omitido; API usa canais fixos internos.
- `box2` pode ser string vazia.

Resposta `202`:

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "status_url": "/banners/550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-03-18T12:00:00Z"
}
```

---

### 3.3 `GET /banners/{job_id}`
Consulta andamento do job.

Status possíveis:
- `pending`
- `running`
- `done`
- `partial_done`
- `failed`

Exemplo resumido:

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "modo_geracao": "enxoval",
  "requested_by": "b8f74bbf-6b31-4bf6-9867-2138d2666630",
  "progress": "2/5",
  "itens": [
    {
      "item_id": "0a13f866-4d8d-4e5f-8d91-f2f3c3f8f011",
      "canal": "01_feed_instagram",
      "kv": "pos",
      "status": "done",
      "file_url": "https://<project>.supabase.co/storage/v1/object/sign/image-gen-outputs/...",
      "storage_path": "550e8400-e29b-41d4-a716-446655440000/01_feed_instagram/0a13f866-4d8d-4e5f-8d91-f2f3c3f8f011.png",
      "signed_url_expires_at": "2026-03-18T18:10:00Z"
    }
  ],
  "metrics": {},
  "file_url": null,
  "error": null
}
```

---

### 3.4 Download do resultado
- `file_url` de cada item pode vir como signed URL do Supabase Storage.
- `GET /banners/{job_id}/download` agora redireciona para o arquivo final quando `file_url` for URL assinada.
- Se a URL assinada expirar, usar:

`POST /banners/{job_id}/items/{item_id}/refresh-url`

Resposta:

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "item_id": "0a13f866-4d8d-4e5f-8d91-f2f3c3f8f011",
  "file_url": "https://<project>.supabase.co/storage/v1/object/sign/image-gen-outputs/...",
  "signed_url_expires_at": "2026-03-18T18:25:00Z"
}
```

---

## 4) Fluxo recomendado no frontend

1. Carregar opções com `GET /banners/form-options`
2. Renderizar formulário
3. Enviar com `POST /banners/json`
4. Fazer polling em `GET /banners/{job_id}` a cada 3s
5. Encerrar polling quando status for `done`, `partial_done` ou `failed`
6. Exibir `file_url` (quando houver) e mensagens de erro amigáveis
7. Se `signed_url_expires_at` estiver vencido, chamar endpoint de refresh e atualizar preview/download

---

## 5) Exemplo de cliente frontend (TypeScript)

```ts
type BannerPayload = {
  modo_geracao: "peca_unica" | "enxoval"
  canal?: string
  kv: string
  etiqueta: string
  titulo: string
  frase: string
  box1: string
  box2?: string
  persona: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function createBannerJob(payload: BannerPayload) {
  const res = await fetch(`${API_BASE}/banners/json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": user.id
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function waitBannerJob(
  jobId: string,
  onProgress?: (status: any) => void
) {
  const timeoutMs = 5 * 60 * 1000
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    await sleep(3000)
    const res = await fetch(`${API_BASE}/banners/${jobId}`)
    const data = await res.json()
    onProgress?.(data)

    if (["done", "partial_done", "failed"].includes(data.status)) {
      return data
    }
  }

  throw new Error("Timeout aguardando conclusão do job")
}

export async function refreshItemSignedUrl(jobId: string, itemId: string) {
  const res = await fetch(`${API_BASE}/banners/${jobId}/items/${itemId}/refresh-url`, {
    method: "POST"
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

---

## 6) CORS na API

No `.env` da API:

```env
ALLOWED_ORIGINS=https://seu-frontend.vercel.app,https://abc-def-123.trycloudflare.com
```

Em dev local, pode usar:

```env
ALLOWED_ORIGINS=*
```

---

## 7) Checklist rápido de operação

- API rodando em `localhost:8000`
- Tunnel ativo com URL HTTPS válida
- `API_BASE` do frontend atualizado
- CORS permitindo origem do frontend
- `GET {API_BASE}/health` retornando `{ "status": "ok" }`

---

## 8) Troubleshooting rápido

- `CORS error`: conferir `ALLOWED_ORIGINS` e reiniciar API
- `404` em endpoint: conferir se `API_BASE` usa URL atual do tunnel
- Timeout no polling: verificar logs da API e credenciais de geração
- `422`: payload inválido (campo ausente, tipo errado ou `canal` faltando em `peca_unica`)
- `400` no refresh-url: integração de Supabase outputs não habilitada no backend
- `404` no refresh-url: item sem `storage_path` ou item/job não encontrado

---

## 9) Estrutura no banco (Supabase)

Schema:
- `image_gen`

Tabela:
- `image_gen.outputs`
  - `id uuid`
  - `job_id uuid`
  - `item_id uuid`
  - `requested_by uuid`
  - `canal text`
  - `kv text`
  - `storage_bucket text`
  - `storage_path text`
  - `mime_type text`
  - `file_size_bytes bigint`
  - `created_at timestamptz`

Bucket:
- `image-gen-outputs` (privado)

RLS:
- `SELECT` em `image_gen.outputs` permitido apenas para `requested_by = auth.uid()`
