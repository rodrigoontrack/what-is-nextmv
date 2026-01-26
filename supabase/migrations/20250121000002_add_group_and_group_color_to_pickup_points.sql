-- Add group and group_color columns to pickup_points table
ALTER TABLE public.pickup_points
ADD COLUMN IF NOT EXISTS "group" TEXT,
ADD COLUMN IF NOT EXISTS group_color TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN public.pickup_points."group" IS 'Group identifier for the pickup point';
COMMENT ON COLUMN public.pickup_points.group_color IS 'Color associated with the group (hex color code)';

-- Create index for group column (useful for filtering and grouping queries)
CREATE INDEX IF NOT EXISTS idx_pickup_points_group ON public.pickup_points("group") WHERE "group" IS NOT NULL;
