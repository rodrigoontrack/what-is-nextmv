-- Add group column to passengers table
ALTER TABLE public.passengers
ADD COLUMN IF NOT EXISTS "group" TEXT;

-- Add comment to document the column
COMMENT ON COLUMN public.passengers."group" IS 'Group identifier for the passenger';

-- Create index for group column (useful for filtering and grouping queries)
CREATE INDEX IF NOT EXISTS idx_passengers_group ON public.passengers("group") WHERE "group" IS NOT NULL;
