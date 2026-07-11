# Legacy app migrations

These files are preserved exactly as historical evidence. They were removed from the active migration chain during the Phase 1 baseline reconciliation because the chain did not bootstrap a clean project: base tables existed only in `ignored_migrations`, several remote-sync files were empty, and remote migration history diverged from Git.

Do not apply this directory automatically. Production adoption of the canonical baseline requires the backup, schema comparison and migration-history repair procedure in `docs/phase-1/supabase-baseline.md`.
