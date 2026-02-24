-- Add missing columns to documents table for admin management
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0;
