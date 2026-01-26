-- ============================================
-- New Database Schema Migration
-- Complete restructure of tables and relations
-- ============================================

-- Drop existing tables if they exist (in reverse dependency order)
-- This is a major migration, so we drop old tables first
DROP TABLE IF EXISTS public.stops CASCADE;
DROP TABLE IF EXISTS public.routes CASCADE;
DROP TABLE IF EXISTS public.optimizations CASCADE;
DROP TABLE IF EXISTS public.passengers CASCADE;
DROP TABLE IF EXISTS public.pickup_points CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;

-- ============================================
-- Table: pickup_points
-- ============================================
CREATE TABLE public.pickup_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  address TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT pickup_points_latitude_check CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT pickup_points_longitude_check CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT pickup_points_quantity_check CHECK (quantity > 0)
);

-- Index for coordinates (useful for geospatial queries)
CREATE INDEX idx_pickup_points_coordinates ON public.pickup_points(latitude, longitude);

-- ============================================
-- Table: passengers
-- ============================================
CREATE TABLE public.passengers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  fk_pickup_point UUID NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT passengers_name_check CHECK (LENGTH(TRIM(name)) > 0)
);

-- Index for foreign key (improves join performance)
CREATE INDEX idx_passengers_fk_pickup_point ON public.passengers(fk_pickup_point);

-- ============================================
-- Table: vehicles
-- ============================================
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL,
  max_distance NUMERIC(10, 2) NOT NULL,
  nextmv_id TEXT,
  start_latitude NUMERIC(10, 7),
  start_longitude NUMERIC(10, 7),
  end_latitude NUMERIC(10, 7),
  end_longitude NUMERIC(10, 7),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT vehicles_capacity_check CHECK (capacity > 0),
  CONSTRAINT vehicles_max_distance_check CHECK (max_distance > 0),
  CONSTRAINT vehicles_plate_check CHECK (LENGTH(TRIM(plate)) > 0),
  CONSTRAINT vehicles_start_latitude_check CHECK (start_latitude IS NULL OR (start_latitude >= -90 AND start_latitude <= 90)),
  CONSTRAINT vehicles_start_longitude_check CHECK (start_longitude IS NULL OR (start_longitude >= -180 AND start_longitude <= 180)),
  CONSTRAINT vehicles_end_latitude_check CHECK (end_latitude IS NULL OR (end_latitude >= -90 AND end_latitude <= 90)),
  CONSTRAINT vehicles_end_longitude_check CHECK (end_longitude IS NULL OR (end_longitude >= -180 AND end_longitude <= 180))
);

-- Index for nextmv_id (useful for lookups)
CREATE INDEX idx_vehicles_nextmv_id ON public.vehicles(nextmv_id) WHERE nextmv_id IS NOT NULL;

-- Index for plate (already unique, but explicit index helps)
CREATE INDEX idx_vehicles_plate ON public.vehicles(plate);

-- ============================================
-- Table: optimizations
-- ============================================
CREATE TABLE public.optimizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nextmv_id TEXT NOT NULL UNIQUE,
  result_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for nextmv_id (already unique, but explicit index helps)
CREATE INDEX idx_optimizations_nextmv_id ON public.optimizations(nextmv_id);

-- GIN index for JSONB queries (useful for querying result_json)
CREATE INDEX idx_optimizations_result_json ON public.optimizations USING GIN(result_json);

-- ============================================
-- Table: routes
-- ============================================
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nextmv_id TEXT NOT NULL,
  fk_vehicle UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  fk_optimization UUID REFERENCES public.optimizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  distance NUMERIC(10, 2),
  time NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT routes_name_check CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT routes_nextmv_id_check CHECK (LENGTH(TRIM(nextmv_id)) > 0),
  CONSTRAINT routes_distance_check CHECK (distance IS NULL OR distance >= 0),
  CONSTRAINT routes_time_check CHECK (time IS NULL OR time >= 0)
);

-- Index for foreign key
CREATE INDEX idx_routes_fk_vehicle ON public.routes(fk_vehicle);

-- Index for foreign key to optimizations
CREATE INDEX idx_routes_fk_optimization ON public.routes(fk_optimization);

-- Index for nextmv_id
CREATE INDEX idx_routes_nextmv_id ON public.routes(nextmv_id);

-- Unique constraint: nextmv_id should be unique per route
CREATE UNIQUE INDEX idx_routes_nextmv_id_unique ON public.routes(nextmv_id);

-- ============================================
-- Table: stops
-- ============================================
CREATE TABLE public.stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nextmv_id TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  fk_route UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  fk_pickup_point UUID REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT stops_order_check CHECK ("order" >= 0),
  CONSTRAINT stops_nextmv_id_check CHECK (LENGTH(TRIM(nextmv_id)) > 0)
);

-- Index for foreign key
CREATE INDEX idx_stops_fk_route ON public.stops(fk_route);

-- Index for foreign key to pickup_points
CREATE INDEX idx_stops_fk_pickup_point ON public.stops(fk_pickup_point);

-- Index for nextmv_id
CREATE INDEX idx_stops_nextmv_id ON public.stops(nextmv_id);

-- Composite index for route and order (useful for ordering stops in a route)
CREATE INDEX idx_stops_route_order ON public.stops(fk_route, "order");

-- ============================================
-- Table: stop_passenger
-- Junction table for many-to-many relationship between stops and passengers
-- ============================================
CREATE TABLE public.stop_passenger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fk_stop UUID NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  fk_passenger UUID NOT NULL REFERENCES public.passengers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique combination of stop and passenger
  CONSTRAINT stop_passenger_unique UNIQUE (fk_stop, fk_passenger)
);

-- Index for foreign keys (improves join performance)
CREATE INDEX idx_stop_passenger_fk_stop ON public.stop_passenger(fk_stop);
CREATE INDEX idx_stop_passenger_fk_passenger ON public.stop_passenger(fk_passenger);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_passenger ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies - Allow public access for now
-- (You can modify these later based on your security requirements)
-- ============================================

-- Pickup Points Policies
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

-- Passengers Policies
CREATE POLICY "Allow public read access to passengers"
  ON public.passengers FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to passengers"
  ON public.passengers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to passengers"
  ON public.passengers FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from passengers"
  ON public.passengers FOR DELETE
  USING (true);

-- Vehicles Policies
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

-- Optimizations Policies
CREATE POLICY "Allow public read access to optimizations"
  ON public.optimizations FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to optimizations"
  ON public.optimizations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to optimizations"
  ON public.optimizations FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from optimizations"
  ON public.optimizations FOR DELETE
  USING (true);

-- Routes Policies
CREATE POLICY "Allow public read access to routes"
  ON public.routes FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to routes"
  ON public.routes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to routes"
  ON public.routes FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from routes"
  ON public.routes FOR DELETE
  USING (true);

-- Stops Policies
CREATE POLICY "Allow public read access to stops"
  ON public.stops FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to stops"
  ON public.stops FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to stops"
  ON public.stops FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from stops"
  ON public.stops FOR DELETE
  USING (true);

-- Stop Passenger Policies
CREATE POLICY "Allow public read access to stop_passenger"
  ON public.stop_passenger FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to stop_passenger"
  ON public.stop_passenger FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to stop_passenger"
  ON public.stop_passenger FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete from stop_passenger"
  ON public.stop_passenger FOR DELETE
  USING (true);

-- ============================================
-- Functions for updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_pickup_points_updated_at
  BEFORE UPDATE ON public.pickup_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_passengers_updated_at
  BEFORE UPDATE ON public.passengers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_optimizations_updated_at
  BEFORE UPDATE ON public.optimizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stops_updated_at
  BEFORE UPDATE ON public.stops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stop_passenger_updated_at
  BEFORE UPDATE ON public.stop_passenger
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Migration Complete
-- ============================================