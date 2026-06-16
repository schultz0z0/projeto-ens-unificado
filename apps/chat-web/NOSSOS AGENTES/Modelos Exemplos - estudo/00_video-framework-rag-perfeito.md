# Framework do Vídeo: “Como CRIAR um Agente de IA RAG PERFEITO (5 passos)”

**Fonte:** https://youtu.be/LZoLvV7p25A  
**Autor:** Ronnald Hawk  
**Duração:** 34:06  
**Stack citada na descrição:** Python, Supabase, LangChain, LangGraph  

## Estrutura (capítulos do vídeo)
- 0:00 Introdução
- 0:59 O que é uma RAG e qual a importância
- 1:47 RAGs de diferentes tipos
- 3:20 Agente de IA RAG (agentic RAG)
- 4:12 Passo 0. Entendendo os documentos; criando perguntas e respostas
- 12:12 Passo 1. ETL, chunking, embeddings e estratégias
- 14:07 Passo 2. Testando e melhorando o Retrieval. LLM as a Judge, HyDE e Busca Híbrida
- 22:22 Passo 3. Testando o Agente com RAG e entendendo o comportamento do Agente (automação com scripts para facilitar)
- 29:12 Passo 4. Engenharia de Prompt e mais testes

## O “framework de 5 passos” (com o Passo 0)
O vídeo organiza a construção de um RAG “profissional” em uma sequência incremental:

### Passo 0 — Entender documentos + criar perguntas e respostas
Objetivo: antes de ajustar modelos, definir o que é “resposta boa” para o seu domínio.

Entregáveis esperados:
- Conjunto de documentos-alvo (o que entra e o que fica de fora).
- Um conjunto de **perguntas e respostas (Q/A)** derivadas do conteúdo, para servir como base de teste.
- Critérios de qualidade (ex.: precisão factual, completude, citações/trechos, linguagem, segurança).

### Passo 1 — ETL + chunking + embeddings + estratégias
Objetivo: preparar dados e montar um baseline de retrieval.

Componentes:
- **ETL**: extração e normalização de documentos (texto, metadados, limpeza).
- **Chunking**: segmentação do texto em unidades recuperáveis.
- **Embeddings**: vetorização para busca semântica.
- Estratégias iniciais de busca (baseline), preparando terreno para melhorias.

### Passo 2 — Testar e melhorar o Retrieval
Objetivo: elevar a qualidade da busca (retrieval) com testes e técnicas avançadas.

Técnicas explicitamente citadas:
- **LLM as a Judge**: usar um LLM para avaliar a qualidade de resultados/respostas (com critérios).
- **HyDE**: gerar uma “resposta hipotética” para orientar a busca semântica.
- **Busca híbrida**: combinar sinais (ex.: semântica + textual) para melhorar recall/precision.

### Passo 3 — Testar o agente com RAG e entender o comportamento
Objetivo: validar o sistema end-to-end, não só o retrieval isolado.

Foco:
- Analisar falhas típicas: alucinação, resposta sem base, uso errado do contexto, over-retrieval, under-retrieval.
- Ajustar orquestração do “agente” (fluxo de decisão) a partir do que os testes mostram.

### Passo 4 — Engenharia de prompt + mais testes
Objetivo: consolidar comportamento, reduzir variância e “amarrar” o agente ao contexto.

Foco:
- Prompt de sistema e instruções para: usar somente o contexto quando aplicável, citar fontes/trechos, declarar incerteza, pedir esclarecimentos.
- Repetir ciclos de teste para evitar regressões.

## Estratégias destacadas (explicitamente citadas na descrição/capítulos)
- ETL + chunking
- Embeddings
- Busca híbrida (mais usada)
- HyDE
- Avaliação com LLM as a Judge

## Observação sobre “códigos” e “documentos” mostrados no vídeo
Neste ambiente eu consegui extrair a **estrutura (capítulos)** e a **descrição** com os tópicos e técnicas, mas **não consegui capturar de forma confiável os trechos de código exibidos na tela** nem quaisquer documentos/prints que apareçam visualmente durante a reprodução (bloqueios de UI/legendas/transcrição).

Se você me enviar qualquer um destes itens, eu incorporo nesta mesma referência:
- Link para repositório usado no vídeo (se existir)
- Prints dos trechos de código
- Trechos colados do código
- Arquivos/prints dos documentos/diagramas citados

## Tradução do framework para o nosso projeto (OpenAI API + Supabase)
No nosso chatbot:
- OpenAI API entra em **dois pontos**: embeddings (indexação) e chat (geração).
- Supabase é a base para: armazenamento, índices (incl. vetores), políticas de acesso (RLS), e execução dos scripts finais.

O desenho do projeto vai seguir a mesma progressão:
1) dataset de avaliação (Passo 0)  
2) pipeline de ingestão e baseline de retrieval (Passo 1)  
3) ciclo de melhoria com HyDE/híbrida + avaliação (Passo 2)  
4) orquestração do agente + testes end-to-end (Passo 3)  
5) prompt/guardrails + regressão (Passo 4)  

