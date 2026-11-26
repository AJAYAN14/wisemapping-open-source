-- =============================================================================
-- WiseMapping Personal Private Edition — Migration 0005: Harden RLS Helper Functions
-- Target: WiseMapping Supabase PostgreSQL
-- Idempotent migration: safe to re-run without side effects.
-- Moves SECURITY DEFINER RLS helper functions out of the exposed `public` schema
-- into an unexposed `private` schema and enforces auth.uid() checks on all three.
-- =============================================================================

BEGIN;

-- 1. Create unexposed private schema for internal RLS helper functions
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Recreate all 3 RLS validator helpers in `private` with caller-ownership checks
CREATE OR REPLACE FUNCTION private.is_valid_parent_label(p_parent_id BIGINT, p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT p_parent_id IS NULL OR (
    p_owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.labels WHERE id = p_parent_id AND owner_id = p_owner_id
    )
  );
$$;

REVOKE ALL ON FUNCTION private.is_valid_parent_label(BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_valid_parent_label(BIGINT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_valid_parent_folder(p_parent_id BIGINT, p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT p_parent_id IS NULL OR (
    p_owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.folders WHERE id = p_parent_id AND owner_id = p_owner_id
    )
  );
$$;

REVOKE ALL ON FUNCTION private.is_valid_parent_folder(BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_valid_parent_folder(BIGINT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_valid_mindmap_folder(p_folder_id BIGINT, p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT p_folder_id IS NULL OR (
    p_owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.folders WHERE id = p_folder_id AND owner_id = p_owner_id
    )
  );
$$;

REVOKE ALL ON FUNCTION private.is_valid_mindmap_folder(BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_valid_mindmap_folder(BIGINT, UUID) TO authenticated, service_role;

-- 3. Point RLS policies to `private.*` helpers
ALTER POLICY labels_insert_own ON public.labels
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND private.is_valid_parent_label(parent_label_id, (SELECT auth.uid()))
  );

ALTER POLICY labels_update_own ON public.labels
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND private.is_valid_parent_label(parent_label_id, (SELECT auth.uid()))
  );

ALTER POLICY folders_insert_own ON public.folders
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND private.is_valid_parent_folder(parent_id, (SELECT auth.uid()))
  );

ALTER POLICY folders_update_own ON public.folders
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND private.is_valid_parent_folder(parent_id, (SELECT auth.uid()))
  );

ALTER POLICY mindmaps_insert_own ON public.mindmaps
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND private.is_valid_mindmap_folder(folder_id, (SELECT auth.uid()))
  );

ALTER POLICY mindmaps_update_own ON public.mindmaps
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND private.is_valid_mindmap_folder(folder_id, (SELECT auth.uid()))
  );

-- 4. Drop old exposed `public.is_valid_*` SECURITY DEFINER functions
DROP FUNCTION IF EXISTS public.is_valid_parent_label(BIGINT, UUID);
DROP FUNCTION IF EXISTS public.is_valid_parent_folder(BIGINT, UUID);
DROP FUNCTION IF EXISTS public.is_valid_mindmap_folder(BIGINT, UUID);

COMMIT;
