# Debug Session: hosted-image-url

Status: OPEN

## Sintoma
- O site hospedado nao utiliza a URL correta do gerador de imagem.
- No ambiente local, `VITE_IMAGE_GENERATOR_API_URL` aponta para `https://oops-spine-authors-trunk.trycloudflare.com`.
- Na captura do deploy, o toast mostra falha ao conectar na API do gerador.

## Hipoteses
1. O deploy da Vercel nao possui a variavel `VITE_IMAGE_GENERATOR_API_URL` configurada, entao o bundle publicado embutiu um valor antigo ou vazio.
2. O frontend hospedado usa outra chave/env fallback diferente de `VITE_IMAGE_GENERATOR_API_URL`.
3. A URL esta correta no bundle, mas o endpoint do tunnel mudou ou expirou e o erro percebido parece ser de configuracao.
4. O build esta sendo servido de um deploy antigo, sem rebuild apos a alteracao do `.env`.
5. Existe transformacao da URL em tempo de execucao que sobrescreve o valor esperado antes do `fetch`.

## Evidencias a Coletar
- Onde `VITE_IMAGE_GENERATOR_API_URL` eh lida no codigo.
- Se existe fallback, normalizacao ou outra env relacionada.
- Qual URL o bundle hospedado realmente esta tentando usar.
- Se a falha eh de configuracao de build/deploy ou indisponibilidade do endpoint remoto.
