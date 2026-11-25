-- =============================================================================
-- WiseMapping Personal Private Edition — Migration 0002: Add folder_path
-- Target: WiseMapping Supabase PostgreSQL
-- Idempotent migration: safe to re-run without side effects.
-- =============================================================================

BEGIN;

-- 1. Add folder_path column to public.mindmaps
ALTER TABLE public.mindmaps
  ADD COLUMN IF NOT EXISTS folder_path VARCHAR(1024) NOT NULL DEFAULT '';

-- 2. Create index on (owner_id, folder_path) for path-scoped queries
CREATE INDEX IF NOT EXISTS mindmaps_owner_id_folder_path_idx
  ON public.mindmaps (owner_id, folder_path);

COMMIT;
