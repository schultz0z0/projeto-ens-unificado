# Chat Signed URL Refresh Design

**Data:** 2026-05-28

**Objetivo**

Reduzir `ERR_ABORTED` no carregamento visual de anexos do chat evitando renovacao desnecessaria de signed URLs, sem enfraquecer a seguranca do bucket privado.

## Problema

- O chat renova a signed URL de anexos sempre que carrega o historico.
- Ao trocar `src` de imagens ja renderizadas, o navegador pode abortar a request anterior e registrar `net::ERR_ABORTED`.
- O comportamento e geralmente benigno, mas polui o console e gera churn de requests.

## Decisao

Persistir junto de cada anexo o metadado `signedUrlExpiresAt` e renovar a URL somente quando ela estiver ausente ou perto de expirar.

## Racional

- Mantem bucket privado e validade curta.
- Evita refresh desnecessario de signed URL.
- Reduz troca de `src` em `<img>`, diminuindo requests abortadas no navegador.
- O metadado de expiracao nao expoe conteudo sensivel, apenas informacao operacional.

## Mudancas

- Adicionar `signedUrlExpiresAt?: string` em `ChatMessageFilePart`.
- No upload inicial, persistir `url`, `storagePath` e `signedUrlExpiresAt`.
- Em `refreshChatMessageAttachmentUrls()`, renovar apenas quando:
  - `signedUrlExpiresAt` estiver ausente
  - ou a URL estiver dentro da janela de refresh
- Usar uma margem curta de seguranca antes do vencimento, por exemplo `60s`.

## Seguranca

- Nenhum anexo vira publico.
- Nenhum TTL longo sera persistido.
- A regra continua privilegiando validade curta e menor privilegio.
- Isso e mais alinhado com LGPD do que tornar o bucket publico ou manter links de longa duracao.
