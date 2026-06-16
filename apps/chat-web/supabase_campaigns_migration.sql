-- 1. Criação de ENUMs para garantir integridade e padronização
CREATE TYPE campaign_status AS ENUM ('active', 'paused', 'ended');
CREATE TYPE campaign_platform AS ENUM ('meta', 'google', 'email');
CREATE TYPE event_type AS ENUM ('email_blast', 'ad_launch', 'content_post');
CREATE TYPE event_status AS ENUM ('scheduled', 'sent', 'cancelled');

-- 2. Tabela Principal: Campanhas
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    status campaign_status NOT NULL DEFAULT 'active',
    platform campaign_platform NOT NULL,
    budget NUMERIC(10, 2) DEFAULT 0 CHECK (budget >= 0),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Métricas (Relacionamento 1:N)
CREATE TABLE campaign_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    leads INT DEFAULT 0 CHECK (leads >= 0),
    inscritos INT DEFAULT 0 CHECK (inscritos >= 0),
    matriculados INT DEFAULT 0 CHECK (matriculados >= 0),
    spend NUMERIC(10, 2) DEFAULT 0 CHECK (spend >= 0),
    impressions INT DEFAULT 0 CHECK (impressions >= 0),
    clicks INT DEFAULT 0 CHECK (clicks >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Garante que não haja métricas duplicadas para a mesma campanha na mesma data
    UNIQUE(campaign_id, date)
);

-- 4. Tabela de Eventos/Calendário (Relacionamento 1:N)
CREATE TABLE campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    type event_type NOT NULL,
    status event_status NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Índices para Performance (Essencial para dashboards)
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaign_metrics_campaign_id ON campaign_metrics(campaign_id);
CREATE INDEX idx_campaign_metrics_date ON campaign_metrics(date);
CREATE INDEX idx_campaign_events_campaign_id ON campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_date ON campaign_events(date);

-- 6. Habilitar RLS (Segurança)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de Segurança (RLS Policies)

-- CAMPAIGNS: Acesso direto pelo user_id
CREATE POLICY "Users can view own campaigns" 
    ON campaigns FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns" 
    ON campaigns FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" 
    ON campaigns FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" 
    ON campaigns FOR DELETE 
    USING (auth.uid() = user_id);

-- CAMPAIGN_METRICS: Acesso verificado através da tabela pai (campaigns)
CREATE POLICY "Users can view metrics of own campaigns" 
    ON campaign_metrics FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM campaigns 
        WHERE campaigns.id = campaign_metrics.campaign_id 
        AND campaigns.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert metrics to own campaigns" 
    ON campaign_metrics FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM campaigns 
        WHERE campaigns.id = campaign_metrics.campaign_id 
        AND campaigns.user_id = auth.uid()
    ));

CREATE POLICY "Users can update metrics of own campaigns" 
    ON campaign_metrics FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM campaigns 
        WHERE campaigns.id = campaign_metrics.campaign_id 
        AND campaigns.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete metrics of own campaigns" 
    ON campaign_metrics FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM campaigns 
        WHERE campaigns.id = campaign_metrics.campaign_id 
        AND campaigns.user_id = auth.uid()
    ));

-- CAMPAIGN_EVENTS: Acesso verificado através da tabela pai (campaigns)
CREATE POLICY "Users can view events of own campaigns" 
    ON campaign_events FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM campaigns 
        WHERE campaigns.id = campaign_events.campaign_id 
        AND campaigns.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert events to own campaigns" 
    ON campaign_events FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM campaigns 
        WHERE campaigns.id = campaign_events.campaign_id 
        AND campaigns.user_id = auth.uid()
    ));

CREATE POLICY "Users can update events of own campaigns" 
    ON campaign_events FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM campaigns 
        WHERE campaigns.id = campaign_events.campaign_id 
        AND campaigns.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete events of own campaigns" 
    ON campaign_events FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM campaigns 
        WHERE campaigns.id = campaign_events.campaign_id 
        AND campaigns.user_id = auth.uid()
    ));

-- 8. Trigger para atualização automática do updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
