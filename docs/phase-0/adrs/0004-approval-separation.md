# ADR 0004 — Separação entre approvals

- **Status:** `accepted`
- **Data:** 2026-07-10
- **Decisor:** responsável do produto
- **Fases afetadas:** 1 e 4–6

## Contexto

O frontend já possui um modal que responde a approvals do runtime Hermes. O produto futuro também precisa aprovar conteúdo e autorizar publicações/envios. Reusar uma decisão técnica como autorização de negócio permitiria executar versão errada, sem aprovador adequado ou fora do canal/janela pretendidos.

## Decisão

Manter três decisões independentes:

1. **Aprovação técnica:** permite uma tool call/comando específico no Hermes; pertence ao Hermes/Bridge.
2. **Aprovação editorial:** aceita ou rejeita uma versão imutável de conteúdo; pertence ao Marketing Ops.
3. **Autorização operacional:** permite executar um pacote imutável em canal, janela e limites definidos; pertence ao Marketing Ops.

Uma decisão não implica outra. Alterar conteúdo aprovado cria nova versão e invalida a aptidão operacional anterior. Workers executam somente pacotes cuja autorização está válida e cuja hash/version ID coincide com o pedido.

## Alternativas consideradas

1. **Um único botão “aprovar”:** rejeitada por ambiguidade e falta de segregação.
2. **Approval apenas no chat:** rejeitada porque telas e automações precisam do mesmo ledger.
3. **Autorização implícita ao aprovar conteúdo:** rejeitada; canal, audiência, orçamento e momento são decisões distintas.
4. **Hermes aprovar em nome do usuário:** rejeitada para decisões humanas obrigatórias.

## Consequências

- entidades e audit events separados;
- UI deve nomear claramente cada decisão;
- RLS/papéis podem variar por tipo de decisão;
- notificações e expiração são tratadas no Marketing Ops;
- a Fase 6 só executa depois da governança da Fase 5 ou de política piloto explicitamente equivalente.
