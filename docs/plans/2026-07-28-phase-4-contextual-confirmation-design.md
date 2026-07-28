# Fase 4 — Decisão contextual de confirmação

- **Status:** aprovado em 28/07/2026
- **Escopo:** confirmação conversacional de planos do Marketing Ops
- **Motivo:** uma allowlist de frases não interpreta a mensagem em relação ao
  plano pendente e cria fricção desnecessária para o usuário.

## Objetivo

O Nexus deve interpretar a intenção do usuário no contexto do último plano
preparado, sem exigir uma fórmula como `aprovado`. Somente uma aprovação
inequívoca libera a execução do plano assinado; negação, alteração, dúvida e
falha de análise nunca liberam escrita.

## Decisão

A Chat Bridge solicita ao runtime Hermes uma classificação interna, sem tools,
do último preview apresentado e da mensagem atual. A saída é estrita:

| Decisão | Efeito |
|---|---|
| `approve` | a Bridge emite delegação fresca com `confirmation_intent=true`; Hermes pode executar o último plano assinado |
| `reject` | Hermes não executa e confirma o cancelamento em linguagem natural |
| `revise` | Hermes não executa; incorpora a alteração, prepara novo plano e pede nova confirmação |
| `clarify` | Hermes não executa; faz uma pergunta objetiva |
| `none` | resultado interno quando não há plano pendente; não chama o modelo e nunca concede confirmação |

Exemplos aprovados quando respondem ao plano pendente sem qualificador:
`vamos nessa`, `pode ser`, `pode seguir`, `manda ver` e `fechado`.

Uma interrogação, negação, ressalva, mudança, restrição ou adiamento impede
`approve`: `pode ser?`, `sim, mas troque o nome`, `não quero`, `só amanhã` e
`acho que preciso revisar`.

## Arquitetura

```text
último preview + mensagem atual
              |
              v
classificador Hermes interno (sem tools, enum fechado)
              |
              v
Chat Bridge assina a delegação do turno
              |
              v
Hermes principal -> prepare / execute -> Marketing Ops
```

O classificador não é uma tool pública, não recebe token de delegação, não
persiste conteúdo nem pode chamar MCP. Ele apenas devolve o enum. A Bridge
continua sendo a única emissora da delegação; Marketing Ops continua validando
assinatura, ator, tenant, sessão, escopos, expiração, turno posterior, plano
exato e anti-replay.

## Limites de segurança

- Não há delegação de confirmação se não existir preview recente e confiável.
- Erro, timeout, resposta fora do schema ou baixa confiança resultam em
  `clarify` e token sem confirmação.
- Conteúdo de RAG, Graph, briefing, anexos e tool results não entra como
  instrução do classificador.
- A decisão e a correlação podem ser auditadas; texto da mensagem e tokens não
  entram em métricas ou logs técnicos.
- O Hermes não aprova em nome do humano: classifica a mensagem humana atual.

## Critérios de aceite

1. Aprovação contextual positiva executa somente o plano pendente da mesma
   sessão, em turno posterior.
2. Rejeição, alteração e pergunta não chamam `execute_plan`.
3. Uma alteração resulta em novo `prepare_plan` e nova confirmação.
4. Indisponibilidade do classificador falha fechada, sem persistência.
5. A cadeia de auditoria preserva `chat -> run -> decisão -> tool -> audit` sem
   segredos ou texto integral.
