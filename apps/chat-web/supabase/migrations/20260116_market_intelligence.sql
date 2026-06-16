-- Migration: Limpeza do Gestor de Campanhas Antigo e Criação do Market Intelligence
-- Data: 2026-01-16

-- ==============================================================================
-- 1. LIMPEZA (DROP OLD TABLES & TYPES)
-- Removemos tabelas do antigo gestor de campanhas que não são mais usadas.
-- ==============================================================================

DROP VIEW IF EXISTS campaign_stats;
DROP TABLE IF EXISTS campaign_metrics CASCADE;
DROP TABLE IF EXISTS campaign_events CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- Drop Enums antigos (se existirem)
DROP TYPE IF EXISTS campaign_status;
DROP TYPE IF EXISTS campaign_platform;
DROP TYPE IF EXISTS event_type;
DROP TYPE IF EXISTS event_status;

-- ==============================================================================
-- 2. CRIAÇÃO DAS TABELAS DE MARKET INTELLIGENCE
-- Estrutura para suportar o novo dashboard "Oceano Azul" e integrações n8n.
-- ==============================================================================

-- 2.1 Tabela de Concorrentes (Players Monitorados)
CREATE TABLE market_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    domain TEXT, -- Ex: "concorrente.com.br"
    brand_color TEXT, -- Para gráficos
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Tabela de Anúncios dos Concorrentes (Alimentada via n8n/Apify)
CREATE TABLE market_competitor_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES market_competitors(id) ON DELETE CASCADE,
    ad_library_id TEXT, -- ID único na biblioteca de anúncios (Meta/Google)
    platform TEXT NOT NULL DEFAULT 'meta', -- meta, google, tiktok
    format TEXT, -- image, video, carousel
    status TEXT DEFAULT 'active', -- active, inactive
    
    -- Conteúdo do Anúncio
    copy_text TEXT, -- Texto principal extraído
    headline TEXT, -- Título do anúncio
    landing_page_url TEXT,
    thumbnail_url TEXT, -- URL da imagem salva no Storage ou link externo
    
    -- Metadados de Veiculação
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 Tabela de Tendências e Gaps (Blue Ocean Radar)
CREATE TABLE market_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    term TEXT NOT NULL, -- Termo de busca (ex: "Seguro Cyber")
    
    -- Eixos do Gráfico de Dispersão
    demand_score INTEGER DEFAULT 0, -- 0-100 (Volume de busca Google Trends)
    competition_score INTEGER DEFAULT 0, -- 0-100 (Densidade de anúncios encontrados)
    
    opportunity_score INTEGER GENERATED ALWAYS AS (demand_score - competition_score) STORED, -- Calculado
    
    category TEXT, -- Ex: "Seguros", "Investimentos"
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 Feed de Inteligência (Alertas e Insights gerados por IA)
CREATE TABLE market_intelligence_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    
    type TEXT NOT NULL, -- 'opportunity', 'threat', 'new_ad', 'trend'
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium', -- low, medium, high
    
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. SEGURANÇA (RLS - ROW LEVEL SECURITY)
-- Garante que cada usuário veja apenas seus dados.
-- ==============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE market_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_competitor_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_intelligence_feed ENABLE ROW LEVEL SECURITY;

-- Políticas para market_competitors
CREATE POLICY "Users can manage own competitors"
    ON market_competitors FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para market_competitor_ads
-- (Acesso indireto via competitor -> user_id)
CREATE POLICY "Users can view ads of own competitors"
    ON market_competitor_ads FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM market_competitors
        WHERE market_competitors.id = market_competitor_ads.competitor_id
        AND market_competitors.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage ads of own competitors"
    ON market_competitor_ads FOR ALL
    USING (EXISTS (
        SELECT 1 FROM market_competitors
        WHERE market_competitors.id = market_competitor_ads.competitor_id
        AND market_competitors.user_id = auth.uid()
    ));

-- Políticas para market_trends
CREATE POLICY "Users can manage own trends"
    ON market_trends FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para market_intelligence_feed
CREATE POLICY "Users can manage own feed"
    ON market_intelligence_feed FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 4. ÍNDICES E PERFORMANCE
-- ==============================================================================

CREATE INDEX idx_competitors_user ON market_competitors(user_id);
CREATE INDEX idx_ads_competitor ON market_competitor_ads(competitor_id);
CREATE INDEX idx_ads_status ON market_competitor_ads(status);
CREATE INDEX idx_ads_created ON market_competitor_ads(created_at DESC);
CREATE INDEX idx_trends_user ON market_trends(user_id);
CREATE INDEX idx_feed_user_unread ON market_intelligence_feed(user_id) WHERE is_read = false;
