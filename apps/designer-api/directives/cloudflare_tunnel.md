# SOP: Cloudflare Tunnel — Exposição da API (Grátis)

## Objetivo
Expor a API local (`http://localhost:8000`) para a internet usando **Cloudflare Tunnel** (gratuito, sem domínio próprio necessário) com o serviço `trycloudflare.com`.

---

## Por que Cloudflare Tunnel?
- **Gratuito** — sem conta ou cartão de crédito para o modo Quick Tunnel
- **HTTPS automático** — certificado SSL gerenciado pela Cloudflare
- **Sem abrir portas no roteador** — conexão de saída apenas
- **Zero configuração de servidor** — roda localmente junto com a API

---

## Pré-Requisito 1: Instalar o `cloudflared`

### Opção A — winget (recomendado, PowerShell como Administrador)
```cmd
winget install Cloudflare.cloudflared
```

### Opção B — Chocolatey
```cmd
choco install cloudflared
```

### Opção C — Download manual
1. Acesse: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Baixe `cloudflared-windows-amd64.exe`
3. Renomeie para `cloudflared.exe`
4. Mova para `C:\Windows\System32\` ou adicione ao PATH

### Verificar instalação
```cmd
cloudflared --version
```

---

## Pré-Requisito 2: Instalar dependências Python da API

```cmd
cd "r:\Projetos SaaS\Nova pasta\nexus designer"
pip install -r requirements.txt
```

---

## Passo a Passo: Subir a API + Tunnel

### Terminal 1 — Iniciar a API

```cmd
cd "r:\Projetos SaaS\Nova pasta\nexus designer"

REM Opção 1: usando o script (mais fácil)
start_api.bat

REM Opção 2: diretamente com uvicorn
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload
```

**Confirme que está rodando visitando:** `http://localhost:8000/docs`

---

### Terminal 2 — Iniciar o Tunnel Cloudflare

```cmd
cd "r:\Projetos SaaS\Nova pasta\nexus designer"

REM Opção 1: usando o script
start_tunnel.bat

REM Opção 2: diretamente
cloudflared tunnel --url http://localhost:8000
```

**Aguarde a saída como:**
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://abc-def-123.trycloudflare.com                                                     |
+--------------------------------------------------------------------------------------------+
```

**Copie a URL** — essa é sua API pública. Ex: `https://abc-def-123.trycloudflare.com`

---

## Configurar a URL no Frontend

Defina a variável de ambiente no frontend ou hardcode temporariamente:

```bash
# .env do frontend (React/Next/Vue)
VITE_API_BASE_URL=https://abc-def-123.trycloudflare.com
# ou
NEXT_PUBLIC_API_BASE_URL=https://abc-def-123.trycloudflare.com
```

> ⚠️ A URL do Quick Tunnel muda a cada reinicialização do `cloudflared`.
> Para URL fixa/permanente, crie uma conta na Cloudflare e use Named Tunnels (também gratuito).

---

## Tunnel Permanente (URL Fixa) — Named Tunnel

Para ter sempre a mesma URL (ex: `https://ens-banners.seu-dominio.com`):

```cmd
REM 1. Login na Cloudflare (abre browser)
cloudflared tunnel login

REM 2. Criar tunnel nomeado
cloudflared tunnel create ens-banner-factory

REM 3. Criar arquivo de config (edite o nome do tunnel e domínio)
REM    Salve como config.yml na raiz do projeto

REM 4. Rotear domínio para o tunnel
cloudflared tunnel route dns ens-banner-factory ens-banners.seu-dominio.com

REM 5. Rodar com config
cloudflared tunnel run ens-banner-factory
```

**Conteúdo do `config.yml`:**
```yaml
tunnel: ens-banner-factory
credentials-file: C:\Users\<SEU_USUARIO>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: ens-banners.seu-dominio.com
    service: http://localhost:8000
  - service: http_status:404
```

---

## Verificar se está funcionando

```cmd
REM Health check via CMD (PowerShell)
Invoke-WebRequest -Uri "https://abc-def-123.trycloudflare.com/health" | Select-Object -ExpandProperty Content

REM Ou com curl (se instalado)
curl https://abc-def-123.trycloudflare.com/health
```

**Resposta esperada:**
```json
{"status": "ok", "jobs_in_memory": 0}
```

---

## Variáveis de Ambiente Relevantes (`.env`)

```env
# Porta local da API
PORT=8000

# Origens permitidas para CORS (frontend URLs, separadas por vírgula)
# Use * em dev; restrinja em produção
ALLOWED_ORIGINS=https://seu-frontend.vercel.app,https://abc.trycloudflare.com

# Número de workers simultâneos para o pipeline
WORKER_THREADS=2
```

---

## Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| `cloudflared: command not found` | Não instalado ou fora do PATH | Reinstalar via winget |
| Tunnel inicia mas URL não abre | API não está rodando | Iniciar `start_api.bat` antes |
| `CORS error` no frontend | ALLOWED_ORIGINS incorreto | Adicionar URL do frontend no `.env` |
| Tunnel desconecta | Instabilidade de rede | Reiniciar `start_tunnel.bat` |
| API retorna 500 em `/banners` | Credenciais GCP ausentes | Verificar `.env` e `credentials.json` |

---

## Aprendizados (atualizar conforme descobertas)
- Quick Tunnel tem limite de 200 conexões simultâneas — suficiente para dev/demo
- Para produção com volume, considerar Cloud Run ou Railway.app com o mesmo `uvicorn`
