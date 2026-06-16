-- Migração Completa para Integração Meta (Nexus AI 2.0)
-- ATENÇÃO: Isso recria as tabelas de campanhas. Dados antigos de teste serão limpos.

-- 1. Limpeza
DROP VIEW IF EXISTS campaign_stats;
DROP TABLE IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS ads CASCADE;
DROP TABLE IF EXISTS ad_sets CASCADE;
DROP TABLE IF EXISTS campaign_events CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;

-- 2. Tabela de Campanhas (ID como TEXT para suportar IDs do Meta)
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    platform TEXT DEFAULT 'meta',
    objective TEXT,
    budget NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

-- 3. Tabelas Hierárquicas
CREATE TABLE ad_sets (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ads (
    id TEXT PRIMARY KEY,
    ad_set_id TEXT REFERENCES ad_sets(id) ON DELETE CASCADE,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT,
    creative_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Métricas Diárias
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    ad_id TEXT,
    report_date DATE NOT NULL,
    spend NUMERIC(10, 2) DEFAULT 0,
    impressions INT DEFAULT 0,
    clicks INT DEFAULT 0,
    leads INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ad_id, report_date) -- Garante unicidade para Upsert
);

-- 5. Tabela de Eventos (Calendário)
CREATE TABLE campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled'
);

-- 6. View Inteligente para Dashboard (Agregação Automática)
CREATE OR REPLACE VIEW campaign_stats AS
SELECT 
    c.id, c.user_id, c.name, c.status, c.platform, c.budget, c.objective,
    COALESCE(SUM(dm.spend), 0) as total_spend,
    COALESCE(SUM(dm.leads), 0) as total_leads,
    COALESCE(SUM(dm.clicks), 0) as total_clicks,
    CASE 
        WHEN COALESCE(SUM(dm.leads), 0) > 0 THEN COALESCE(SUM(dm.spend), 0) / SUM(dm.leads)
        ELSE 0 
    END as cpl
FROM campaigns c
LEFT JOIN daily_metrics dm ON c.id = dm.campaign_id
GROUP BY c.id;

-- 7. Permissões
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON campaign_stats TO authenticated;
GRANT SELECT ON campaign_stats TO service_role;
CREATE POLICY "Users can view own campaigns" ON campaigns FOR SELECT USING (auth.uid() = user_id);
-- (Adicione políticas similares para insert/update conforme necessário)
