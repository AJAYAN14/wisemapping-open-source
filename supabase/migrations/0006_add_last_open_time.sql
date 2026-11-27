-- =============================================================================
-- WiseMapping Personal Private Edition — Migration 0006: Add last_open_time
-- Target: WiseMapping Supabase PostgreSQL
-- Idempotent migration: safe to re-run without side effects.
-- =============================================================================

BEGIN;

ALTER TABLE public.mindmaps
  ADD COLUMN IF NOT EXISTS last_open_time TIMESTAMPTZ;

UPDATE public.mindmaps
SET last_open_time = COALESCE(last_open_time, last_modification_time, creation_time, NOW())
WHERE last_open_time IS NULL;

ALTER TABLE public.mindmaps
  ALTER COLUMN last_open_time SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS mindmaps_owner_id_last_open_idx
  ON public.mindmaps (owner_id, last_open_time DESC);

COMMIT;
