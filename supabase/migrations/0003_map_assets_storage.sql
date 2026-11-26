-- =============================================================================
-- WiseMapping Personal Private Edition �?Migration 0003: Map Assets Storage Bucket
-- Target: WiseMapping Supabase PostgreSQL (storage schema)
-- Idempotent migration: safe to re-run without side effects.
-- =============================================================================

BEGIN;

-- Create dedicated public CDN bucket for externalized mindmap topic images.
-- Writes & deletes are authorized exclusively server-side via Vercel Functions
-- (signed upload URLs / service_role cleanup) after validating the 7-day JWT.
-- Keeping storage.objects without broad public SELECT prevents bucket listing
-- while public=true allows direct CDN image fetches by URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'map-assets',
  'map-assets',
  TRUE,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
