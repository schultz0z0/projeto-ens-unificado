-- Apply manually after 2026-06-16-ens-rag-collections.sql.
-- This removes the old NexusAI tenant and cascades its documents/chunks.

delete from tenants
where slug = 'nexusai';
