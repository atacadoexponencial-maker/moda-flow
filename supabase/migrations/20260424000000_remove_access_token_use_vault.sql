-- Migration: Remove access_token column and update meta_config_safe view
-- Replaces plain-text token storage with vault_secret_id reference

-- Step 1: Drop the existing view that depends on access_token
DROP VIEW IF EXISTS public.meta_config_safe;

-- Step 2: Remove the plain-text access_token column
ALTER TABLE public.meta_config DROP COLUMN IF EXISTS access_token;

-- Step 3: Recreate the view using vault_secret_id as the token indicator
CREATE VIEW public.meta_config_safe AS
SELECT
  id, ad_account_id, ativo, meta_user_name, token_expires_at, created_at,
  (vault_secret_id IS NOT NULL) AS token_configurado
FROM public.meta_config;
