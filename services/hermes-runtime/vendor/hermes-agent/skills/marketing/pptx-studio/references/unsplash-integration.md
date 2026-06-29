# Unsplash Integration — Image Source para PDF/PPTX

> Documentação de como usar o Unsplash como source de imagens reais (substituindo ou complementando gpt-image-2).
> Compartilhado entre `pdf-studio` (master copy em `/opt/data/skills/marketing/pdf-studio/references/unsplash-integration.md`) e `pptx-studio` (cópia local).

## Status

- ✅ **Skill instalada**: `unsplash-js@2.x` (npm oficial, 2.2k stars, MIT)
- ✅ **Wrapper criado**: `skills/unsplash.js` em pdf-studio/ (também pode ser usado em pptx-studio copiando o arquivo)
- ⚠️ **Inativo até config**: requer `UNSPLASH_ACCESS_KEY` no `.env`

## Como ativar

1. Pegar Access Key em https://unsplash.com/developers (Application ID + Access Key + Secret Key)
2. Adicionar ao `.env` (no diretório do framework):
   ```
   UNSPLASH_ACCESS_KEY=<sua_access_key>
   ```
3. Pronto. O wrapper detecta automaticamente.

## Como usar

```js
const { searchImage, SUGGESTED_QUERIES } = require('./skills/unsplash.js');

const imagePath = await searchImage({
  query: 'boardroom',
  orientation: 'landscape',
  size: 'regular',
});
```

## Rate limits

- **Demo (default)**: 50 requests/hour
- **Production** (após review da Unsplash): 5000 requests/hour
- **Custo**: GRÁTIS

## Queries úteis por contexto (SUGGESTED_QUERIES)

| Contexto | Query |
|---|---|
| `capa_mba` | "insurance business" |
| `hero_avancada` | "executive boardroom" |
| `hero_juridica` | "law library books" |
| `testemunho` | "professional portrait" |
| `icone_campus` | "university campus modern" |
| `icone_tecnologia` | "technology innovation" |

## Hierarquia de preferência (atualizada 2026-06-24)

1. **gpt-image-2** (via `image_generate` tool) — gerar BG customizado por modality
2. **Imagens já geradas em assets/** — reusar (mba_capa_bg.png, mba_boardroom.jpg, mba_law_books.jpg, mba_cta_bg.jpg)
3. **Unsplash** (skill `unsplash.js`) — fotos reais de pessoas/espaços
4. **lucide-static** — ícones SVG (1982 disponíveis)

## Notas PPTX 16:9 específico

- Para slides 16:9, **sempre** usar `orientation: 'landscape'` no `searchImage`
- O `dom-to-pptx` embute a imagem como `<p:pic>` shape, não como background
- Para BG full-bleed, usar `<img class="full-bleed" src="...">` que vira `<p:pic>` com `anchor: 'ctr'` no dom-to-pptx

## Créditos

⚠️ **Importante**: quando usar imagem Unsplash, **SEMPRE creditar o fotógrafo**. Exemplo:
> Foto por [Nome do Fotógrafo](unsplash.com/@username) via Unsplash

## Workflow típico

```bash
# 1. Ativar
echo "UNSPLASH_ACCESS_KEY=xxx" >> /opt/data/skills/marketing/pptx-studio/.env

# 2. Pré-baixar todas as imagens antes de renderizar
node -e "
const { searchImage, SUGGESTED_QUERIES } = require('./skills/unsplash.js');
(async () => {
  for (const [name, opts] of Object.entries(SUGGESTED_QUERIES)) {
    try {
      const path = await searchImage(opts);
      console.log(name, path);
    } catch (e) { console.error(name, e.message); }
  }
})();
"

# 3. Usar no HTML, substituir src
```

## Security notes

- **NUNCA** commitar a Access Key no git (`.env` no `.gitignore`)
- **NUNCA** usar em client-side (server-side only)
