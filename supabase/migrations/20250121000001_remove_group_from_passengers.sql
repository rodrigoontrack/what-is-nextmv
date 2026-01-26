-- Remove group column from passengers table
ALTER TABLE public.passengers
DROP COLUMN IF EXISTS "group";

-- Drop the index if it exists
DROP INDEX IF EXISTS public.idx_passengers_group;
