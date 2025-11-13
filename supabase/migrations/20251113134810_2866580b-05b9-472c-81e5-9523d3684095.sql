-- Create pickup_points table
CREATE TABLE public.pickup_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 100,
  max_distance NUMERIC(10, 2),
  start_location JSONB,
  end_location JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create routes table to store optimization results
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  route_data JSONB NOT NULL,
  total_distance NUMERIC(10, 2),
  total_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (making tables public for now as this is a logistics dashboard)
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- Create public access policies
CREATE POLICY "Allow public read access to pickup_points"
  ON public.pickup_points FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to pickup_points"
  ON public.pickup_points FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to pickup_points"
  ON public.pickup_points FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from pickup_points"
  ON public.pickup_points FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to vehicles"
  ON public.vehicles FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to vehicles"
  ON public.vehicles FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from vehicles"
  ON public.vehicles FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to routes"
  ON public.routes FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to routes"
  ON public.routes FOR INSERT
  WITH CHECK (true);

-- Create function for updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_pickup_points_updated_at
  BEFORE UPDATE ON public.pickup_points
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();