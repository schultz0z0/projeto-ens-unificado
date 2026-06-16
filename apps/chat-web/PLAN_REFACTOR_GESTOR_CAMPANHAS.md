# Planejamento: Nexus Competitor Watch (Inteligência de Mercado 2026)

## 🎯 Objetivo Principal
Pivotar o antigo módulo de "Gestor de Campanhas" para um **Centro de Inteligência Competitiva (CICE)**.
O objetivo não é mais *gerenciar* campanhas (isso fica no Power BI/Meta), mas sim **fornecer munição estratégica** para que a equipe de marketing crie campanhas mais assertivas e diferenciadas.

**Foco**: Monitoramento de Concorrentes, Benchmarking de Promessas e Detecção de Gaps de Mercado.

---

## 🏗️ Nova Arquitetura do Módulo

O módulo será renomeado para **Market Intelligence** (ou *Radar de Mercado*) e terá 3 pilares principais:

### 1. 🕵️ Ad Library Scanner ("O Espião Ético")
**Objetivo**: Visualizar em tempo real o que os concorrentes (FGV, IBMEC, Influencers) estão anunciando.
- **Funcionalidades**:
  - **Feed de Anúncios**: Uma galeria visual (estilo Pinterest) com os criativos ativos dos concorrentes.
  - **Automação (n8n + Apify)**:
    - O n8n orquestra e o Apify executa o scraping pesado.
    - **Actor Recomendado**: `facebook-ads-scraper` (ou similar na Apify Store).
    - **Custo Estimado**: ~$4.50/mês (para 10 concorrentes diários).
    > **Estratégia de Storage (Free Tier)**: Para não estourar o limite do Supabase:
    > 1. O n8n baixa o criativo e gera um **thumbnail otimizado (WebP)** de baixa resolução (~50KB).
    > 2. Salvamos apenas o thumbnail no Supabase Storage.
    > 3. Vídeos pesados não são salvos; mantemos o link externo para a Ad Library.
    > *Capacidade estimada: ~20.000 anúncios no plano gratuito.*
  - **Histórico Persistente (Passado vs Presente)**:
    - Anúncios que saem do ar na Meta ganham uma tarja **"INATIVO"** no sistema, mas **não são deletados**.
    - Mantemos os dados (copy, impressões, datas) e o thumbnail visual para consulta histórica.
    - *Benefício*: Permite analisar estratégias passadas (ex: "O que eles anunciaram na Black Friday passada?").
  - **Gestão de Espaço**:
    - Botão **"Limpar Histórico"**: Opção para excluir anúncios antigos de um concorrente específico ou anteriores a uma data, liberando espaço no Supabase quando necessário.
  - **Filtros Inteligentes**: Filtrar por Status (Ativo/Inativo), Tema, Formato e Player.

### 2. 🧠 Análise de Promessas & Copy (IA Analítica)
**Objetivo**: Entender *como* os concorrentes estão vendendo para não sermos "mais do mesmo".
- **Funcionalidades**:
  - **Comparador de Promessas**:
    - **Actor Recomendado**: `website-content-crawler` (Raspa LPs completas).
    - *Fluxo*: Apify raspa a Landing Page do anúncio -> n8n envia texto para GPT-4 -> IA extrai a "Grande Promessa".
  - **Nuvem de Palavras-Chave**: Quais termos eles mais usam? (ex: "Prático", "Rápido", "Online").

### 3. 🌊 Blue Ocean Radar (Gap Analysis)
**Objetivo**: Identificar onde **ninguém** está anunciando.
- **Funcionalidades**:
  - Cruzamento de dados: **Volume de Busca (Google Trends)** vs. **Densidade de Anúncios (Competitors)**.
  - **Actor Recomendado**: `google-trends-scraper` (Monitora termos em alta).
  - *Alerta de Oportunidade*: "O termo 'Seguro Cyber para PMEs' cresceu 40% nas buscas, mas só existem 2 anúncios ativos dos concorrentes sobre isso. **Oceano Azul detectado.**"

---

## 🤖 Automações Inteligentes (n8n + Apify)

### Workflow A: "Competitor Watchdog"
- **Gatilho**: Diário (Manhã).
- **Ação**:
  1. n8n chama a API do **Apify** (Actor: `facebook-ads-scraper`).
  2. Apify navega, raspa os anúncios novos e retorna o JSON.
  3. n8n processa, usa OpenAI para analisar o copy e salva no Supabase.

### Workflow B: "Trend Spotter"
- **Gatilho**: Semanal.
- **Ação**:
  1. n8n chama **Apify** (Actor: `google-trends-scraper`).
  2. Consulta termos estratégicos ("Curso de Seguros", "Susep").
  3. Cruza com o banco de anúncios coletados.
  4. Gera o relatório de "Gaps".

---

## 💰 Viabilidade de Custos (Plano Starter $29)
Estimativa para monitorar 10 concorrentes:
- **Ads Scraping (Diário)**: ~$4.50/mês.
- **Website Scraping (Semanal)**: ~$3.00/mês.
- **Google Trends (Semanal)**: ~$1.00/mês.
- **Total Estimado**: ~$8.50 a $10.00 (Sobra ~65% dos créditos para escalar).

---

## 📝 Próximos Passos (Plano de Execução)

1.  **Limpeza**: Remover todo o código antigo de "Gestor de Campanhas" (Abas Ofertas, Calendário, etc).
2.  **Frontend**: Criar a nova interface **Market Intelligence** (Layout de Galeria + Dashboard Analítico).
3.  **Backend**: Criar tabelas `competitors`, `competitor_ads`, `market_trends`.
4.  **Integração n8n**: Configurar os nós de HTTP Request para o Apify.

---
**Aguardando aprovação para iniciar a Fase 1 (Limpeza Total e Novo Schema).**

