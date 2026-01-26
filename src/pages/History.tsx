import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { History, Loader2, MapPin, Truck, Route, X, Download, ArrowLeft, ZoomIn } from "lucide-react";
import Layout from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import Map from "@/components/Map";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  quantity?: number;
  person_id?: string;
  grupo?: string;
}

interface Vehicle {
  id?: string;
  name: string;
  capacity: number;
  max_distance: number;
  start_location?: {
    lon: number;
    lat: number;
  };
  end_location?: {
    lon: number;
    lat: number;
  };
  grupo?: string;
}

const HistoryPage = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [optimizationRuns, setOptimizationRuns] = useState<any[]>([]); // Optimization runs from Supabase
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedOptimizationRunId, setSelectedOptimizationRunId] = useState<string | null>(null); // Selected optimization_run_id
  const [selectedRunData, setSelectedRunData] = useState<any | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<number>>(new Set());
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [focusLocation, setFocusLocation] = useState<{ lon: number; lat: number } | null>(null);
  const [zoomToRoute, setZoomToRoute] = useState<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load pickup points and vehicles
  useEffect(() => {
    const loadPickupPoints = async () => {
      const { data, error } = await supabase.from("pickup_points").select("*");
      if (error) {
        console.error("Error loading pickup points:", error);
      } else {
        setPickupPoints(data || []);
      }
    };

    const loadVehicles = async () => {
      const { data, error } = await supabase.from("vehicles").select("*");
      if (error) {
        console.error("Error loading vehicles:", error);
      } else {
        setVehicles(data || []);
      }
    };

    loadPickupPoints();
    loadVehicles();
  }, []);


  useEffect(() => {
    loadRuns();
    loadOptimizationRuns();
  }, []);

  // Load optimization runs from Supabase (grouped by optimization_run_id)
  const loadOptimizationRuns = async () => {
    try {
      // Get distinct optimization_run_ids with their metadata
      const { data: routesData, error } = await supabase
        .from("routes")
        .select("optimization_run_id, grupo, created_at, nextmv_run_ids")
        .not("optimization_run_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading optimization runs:", error);
        return;
      }

      if (!routesData || routesData.length === 0) {
        setOptimizationRuns([]);
        return;
      }

      // Group routes by optimization_run_id
      const runsMap = new Map<string, {
        optimization_run_id: string;
        grupos: Set<string | null>;
        created_at: string;
        route_count: number;
        nextmv_run_ids: Set<string>; // Collect all Nextmv run IDs
      }>();

      routesData.forEach((route: any) => {
        const runId = route.optimization_run_id;
        if (!runId) return;

        if (!runsMap.has(runId)) {
          runsMap.set(runId, {
            optimization_run_id: runId,
            grupos: new Set<string | null>(),
            created_at: route.created_at,
            route_count: 0,
            nextmv_run_ids: new Set<string>(),
          });
        }

        const run = runsMap.get(runId)!;
        if (route.grupo) {
          run.grupos.add(route.grupo);
        } else {
          run.grupos.add(null);
        }
        run.route_count++;
        // Keep the earliest created_at for this run
        if (new Date(route.created_at) < new Date(run.created_at)) {
          run.created_at = route.created_at;
        }
        // Collect Nextmv run IDs
        if (route.nextmv_run_ids && Array.isArray(route.nextmv_run_ids)) {
          route.nextmv_run_ids.forEach((id: string) => run.nextmv_run_ids.add(id));
        }
      });

      // Convert to array and sort by created_at
      const runsArray = Array.from(runsMap.values()).map(run => ({
        ...run,
        nextmv_run_ids: Array.from(run.nextmv_run_ids)
      })).sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setOptimizationRuns(runsArray);
      console.log(`Loaded ${runsArray.length} optimization runs from Supabase`);
    } catch (error) {
      console.error("Error loading optimization runs:", error);
    }
  };

  // Load routes by optimization_run_id
  const handleOptimizationRunSelect = async (optimizationRunId: string) => {
    setSelectedOptimizationRunId(optimizationRunId);
    setSelectedRunId(null); // Clear Nextmv run selection
    setIsOptimizing(true);

    try {
      // Load all routes from this optimization run (all groups together)
      const { data: routesData, error: routesError } = await supabase
        .from("routes")
        .select("*")
        .eq("optimization_run_id", optimizationRunId)
        .order("created_at", { ascending: false });

      if (routesError) {
        throw new Error(`Error loading routes: ${routesError.message}`);
      }

      if (!routesData || routesData.length === 0) {
        throw new Error("No se encontraron rutas para esta ejecución");
      }

      console.log(`Loaded ${routesData.length} routes for optimization run ${optimizationRunId}`);
      console.log("Routes by grupo:", routesData.reduce((acc: any, r: any) => {
        const grupo = r.grupo || 'sin grupo';
        acc[grupo] = (acc[grupo] || 0) + 1;
        return acc;
      }, {}));

      // Load pickup points associated with this optimization run
      // This ensures we have the exact points with their passenger IDs that were used in this optimization
      const { data: pointsData, error: pointsError } = await supabase
        .from("pickup_points")
        .select("*")
        .eq("optimization_run_id", optimizationRunId)
        .order("created_at", { ascending: false });

      if (pointsError) {
        console.warn("Error loading points for optimization run:", pointsError);
        // Continue anyway - we can still show routes
      } else if (pointsData && pointsData.length > 0) {
        console.log(`Loaded ${pointsData.length} pickup points for optimization run ${optimizationRunId}`);
        // Update pickup points state with the loaded points
        // Map the data to match PickupPoint interface format
        const formattedPoints: PickupPoint[] = pointsData.map((point: any) => ({
          id: point.id,
          name: point.name,
          address: point.address,
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          quantity: point.quantity || 1,
          person_id: point.person_id || undefined,
          grupo: point.grupo || undefined,
        }));
        setPickupPoints(formattedPoints);
      } else {
        console.log("No points found for this optimization run - using current points");
        // Keep existing points if none found for this run
      }

      // Transform routes to include total_distance and total_duration from distance and time fields
      const transformedRoutes = routesData.map((route: any) => ({
        ...route,
        total_distance: route.distance ? Number(route.distance) : 0,
        total_duration: route.time ? Number(route.time) : 0,
        route_data: {
          ...route.route_data,
          route_travel_distance: route.distance ? Number(route.distance) : 0,
          route_travel_duration: route.time ? Number(route.time) : 0,
        }
      }));
      
      setRoutes(transformedRoutes);
      setVisibleRoutes(new Set(transformedRoutes.map((_, index) => index)));

      toast({
        title: "Ejecución cargada",
        description: `Se cargaron ${routesData.length} rutas de todos los grupos`,
      });
    } catch (error) {
      console.error("Error loading optimization run:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cargar la ejecución",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const loadRuns = async () => {
    setIsLoadingRuns(true);
    try {
      // Load optimizations from Supabase instead of Nextmv API
      const { data: optimizationsData, error } = await supabase
        .from("optimizations")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Transform Supabase optimizations to match expected format
      const runsList = (optimizationsData || []).map((opt: any) => {
        // Extract status from result_json if available
        const resultJson = opt.result_json || {};
        const status = resultJson.metadata?.status || resultJson.status || "succeeded";
        
        return {
          id: opt.nextmv_id,
          optimization_id: opt.id, // Store Supabase ID for loading routes
          metadata: {
            created_at: opt.created_at,
            id: opt.nextmv_id,
            status: status
          },
          created_at: opt.created_at,
          status: status,
          result_json: opt.result_json // Store the full result JSON
        };
      });
      
      setRuns(runsList);
      console.log(`Loaded ${runsList.length} optimizations from Supabase`);
    } catch (error) {
      console.error("Error loading optimizations:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las ejecuciones anteriores",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const handleRunSelect = async (runId: string) => {
    setSelectedRunId(runId);
    setSelectedOptimizationRunId(null); // Clear optimization run selection
    setIsOptimizing(true);
    
    try {
      // Find the optimization in the runs list to get the Supabase ID
      const selectedRun = runs.find(r => r.id === runId || r.optimization_id === runId);
      let optimizationId = selectedRun?.optimization_id;
      
      // Load optimization from Supabase - try by ID first, then by nextmv_id
      let optimizationData: any = null;
      
      if (optimizationId) {
        const { data, error } = await supabase
          .from("optimizations")
          .select("*")
          .eq("id", optimizationId)
          .single();
        
        if (!error && data) {
          optimizationData = data;
        }
      }
      
      // If not found by ID, try by nextmv_id
      if (!optimizationData) {
        const { data, error } = await supabase
          .from("optimizations")
          .select("*")
          .eq("nextmv_id", runId)
          .single();
        
        if (error) {
          throw new Error(`No se encontró la optimización: ${error.message}`);
        }
        
        optimizationData = data;
        optimizationId = data.id;
      }
      
      console.log(`Loading optimization ${optimizationId} from Supabase...`);
      setSelectedRunData(optimizationData?.result_json || optimizationData);
      
      // Load routes with stops and passengers from Supabase
      const { data: routesData, error: routesError } = await supabase
        .from("routes")
        .select(`
          *,
          fk_vehicle:vehicles(*),
          stops:stops(
            *,
            fk_pickup_point:pickup_points(*),
            passengers:stop_passenger(
              fk_passenger:passengers(*)
            )
          )
        `)
        .eq("fk_optimization", optimizationId)
        .order("created_at", { ascending: false });
      
      if (routesError) {
        throw new Error(`Error cargando rutas: ${routesError.message}`);
      }
      
      if (!routesData || routesData.length === 0) {
        throw new Error("No se encontraron rutas para esta optimización");
      }
      
      // Transform Supabase data to match expected format
      const transformedRoutes = routesData.map((route: any) => {
        // Build route_data from stops
        const routeStops = (route.stops || []).sort((a: any, b: any) => a.order - b.order);
        
        // Get passengers for each stop from stop_passenger relation
        const stopsWithPassengers = routeStops.map((stop: any) => {
          // Extract passengers from stop_passenger relation
          const passengers = (stop.passengers || [])
            .map((sp: any) => sp.fk_passenger)
            .filter(Boolean);
          
          return {
            stop: {
              id: stop.nextmv_id,
              location: stop.fk_pickup_point ? {
                lat: Number(stop.fk_pickup_point.latitude),
                lon: Number(stop.fk_pickup_point.longitude)
              } : null
            },
            passengers: passengers,
            pickup_point: stop.fk_pickup_point,
            order: stop.order
          };
        });
        
        // Get distance and time from Supabase routes table
        // distance is stored in meters, time is stored in seconds
        const routeDistance = route.distance ? Number(route.distance) : 0;
        const routeTime = route.time ? Number(route.time) : 0;
        
        // Build route_data structure similar to Nextmv format
        const routeData = {
          id: route.fk_vehicle?.nextmv_id || route.nextmv_id,
          route: stopsWithPassengers.map((s: any) => ({ stop: s.stop })),
          route_travel_distance: routeDistance,
          route_travel_duration: routeTime,
        };
        
        return {
          id: route.id,
          vehicle_id: route.fk_vehicle?.id || null,
          route_data: routeData,
          stops: routeStops, // Include full stops with pickup_points and passengers from Supabase
          total_distance: routeDistance,
          total_duration: routeTime,
          created_at: route.created_at,
          grupo: route.grupo, // Preserve grupo if it exists
          name: route.name // Preserve route name from Supabase
        };
      });
      
      console.log(`✅ Loaded ${transformedRoutes.length} routes from Supabase with stops and passengers`);
      console.log("Routes by grupo:", transformedRoutes.reduce((acc: any, r: any) => {
        const grupo = r.grupo || 'sin grupo';
        acc[grupo] = (acc[grupo] || 0) + 1;
        return acc;
      }, {}));
      
      setRoutes(transformedRoutes);
      setVisibleRoutes(new Set(transformedRoutes.map((_, index) => index)));
      
      toast({
        title: "Ejecución cargada",
        description: `Se cargaron ${transformedRoutes.length} rutas exitosamente`,
      });
    } catch (error) {
      console.error("Error loading run:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo cargar la ejecución",
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // Calculate route count and other metrics
  const routeCount = useMemo(() => {
    const validRoutes = routes.filter(route => {
      const duration = route.route_data?.route_travel_duration || route.route_data?.route_duration || route.total_duration || 0;
      return duration > 0;
    });
    const seenVehicles = new Set<string | null>();
    const uniqueRoutes = validRoutes.filter(route => {
      const vehicleId = route.vehicle_id || route.route_data?.id || null;
      if (vehicleId && seenVehicles.has(vehicleId)) {
        return false;
      }
      if (vehicleId) {
        seenVehicles.add(vehicleId);
      }
      return true;
    });
    return uniqueRoutes.length;
  }, [routes]);

  // Calculate unique points count from routes
  const uniquePointsCount = useMemo(() => {
    if (routes.length === 0) return pickupPoints.length;
    
    const uniquePointIds = new Set<string>();
    
    routes.forEach((route: any) => {
      const vehicleRoute = route.route_data?.route || [];
      vehicleRoute.forEach((routeStop: any) => {
        const stopId = routeStop.stop?.id;
        if (!stopId || stopId.includes("-end")) return;
        
        // Extract original point ID (remove person_id encoding and start/end markers)
        const extractOriginalPointId = (stopId: string): string => {
          if (!stopId) return stopId;
          const idx = stopId.indexOf('__person_');
          const baseId = idx > -1 ? stopId.substring(0, idx) : stopId;
          // Remove -start suffix if present
          return baseId.replace(/-start$/, '');
        };
        
        const originalPointId = extractOriginalPointId(stopId);
        if (originalPointId) {
          uniquePointIds.add(originalPointId);
        }
      });
    });
    
    // Return the count, preferring routes if available, otherwise use pickupPoints
    return uniquePointIds.size > 0 ? uniquePointIds.size : pickupPoints.length;
  }, [routes, pickupPoints.length]);

  // Extract passengers helper
  const extractPassengersFromRoute = (route: any): string[] => {
    const vehicleRoute = route.route_data?.route || [];
    const personIds = new Set<string>();
    
    vehicleRoute.forEach((routeStop: any) => {
      const stopId = routeStop.stop?.id;
      if (!stopId || stopId.includes("-start") || stopId.includes("-end")) return;
      
      if (stopId.includes('__person_')) {
        const regex = /__person_([^_]+?)(?=__person_|$)/g;
        let match;
        while ((match = regex.exec(stopId)) !== null) {
          const personId = match[1];
          if (personId) {
            personIds.add(personId);
          }
        }
      }
      
      const originalPointId = stopId.split('__person_')[0];
      const point = pickupPoints.find(p => p.id === originalPointId);
      if (point?.person_id) {
        const ids = point.person_id.split(',').map(id => id.trim()).filter(id => id);
        ids.forEach(id => personIds.add(id));
      }
    });
    
    return Array.from(personIds);
  };

  // Export functions
  const handleExportToExcel = () => {
    if (routes.length === 0) {
      toast({
        title: "Error",
        description: "No hay rutas disponibles para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("=== EXCEL EXPORT STARTED (History) ===");
      console.log("Routes count:", routes.length);
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Helper function to get vehicle name
      const getVehicleName = (route: any, routeIndex: number): string => {
        if (route.name) return route.name;
        const vehicle = vehicles.find(v => v.id === route.vehicle_id);
        if (vehicle) return vehicle.name;
        return `Ruta ${routeIndex + 1}`;
      };

      // Helper function to get stops with details from route
      const getStopsWithDetails = (route: any) => {
        const vehicleRoute = route.route_data?.route || [];
        const stops: any[] = [];
        let stopOrder = 1; // Start counting from 1 (start point will be 0)
        
        vehicleRoute.forEach((routeStop: any, index: number) => {
          const stopId = routeStop.stop?.id;
          if (!stopId || stopId.includes("-end")) return;
          
          const isStartPoint = stopId.includes("-start");
          let address = "";
          let passengers: Array<{ name: string; code: string | null }> = [];
          
          // Try to get address and passengers from Supabase stops
          if (route.stops && Array.isArray(route.stops)) {
            const dbStop = route.stops.find((s: any) => s.nextmv_id === stopId);
            if (dbStop) {
              if (dbStop.fk_pickup_point?.address) {
                address = dbStop.fk_pickup_point.address;
              }
              if (dbStop.passengers) {
                passengers = dbStop.passengers
                  .map((sp: any) => sp.fk_passenger)
                  .filter(Boolean)
                  .map((p: any) => ({ name: p.name, code: p.code || null }));
              }
            }
          }
          
          // Fallback to pickupPoints if not found in Supabase
          if (!address) {
            const extractOriginalPointId = (stopId: string): string => {
              if (!stopId) return stopId;
              const idx = stopId.indexOf('__person_');
              return idx > -1 ? stopId.substring(0, idx) : stopId;
            };
            const originalPointId = extractOriginalPointId(stopId);
            const point = pickupPoints.find(p => p.id === originalPointId);
            if (point) {
              address = point.address || point.name || "";
            }
          }
          
          const order = isStartPoint ? 0 : stopOrder++;
          
          stops.push({
            order,
            isStartPoint,
            address: isStartPoint ? "Punto de inicio" : address || "Sin dirección",
            location: routeStop.stop?.location,
            passengers,
          });
        });
        
        // Sort stops by order
        stops.sort((a, b) => {
          if (a.isStartPoint) return -1;
          if (b.isStartPoint) return 1;
          return a.order - b.order;
        });
        
        return stops;
      };

      // ===== CREATE A TAB FOR EACH ROUTE =====
      routes.forEach((route: any, routeIndex: number) => {
        try {
          console.log(`Processing route ${routeIndex}:`, route);
          
          const routeName = getVehicleName(route, routeIndex);
          const stops = getStopsWithDetails(route);
          
          console.log(`Route ${routeIndex} (${routeName}): ${stops.length} stops`);
          
          // Get route distance and duration
          const totalDistance = route.total_distance || route.route_data?.route_travel_distance || 0;
          const totalDuration = route.total_duration || route.route_data?.route_travel_duration || 0;
          const distanceKm = (Number(totalDistance) / 1000).toFixed(2);
          const durationMin = (Number(totalDuration) / 60).toFixed(1);
          
          // Build route sheet data with combined passengers list
          const routeData: any[] = [
            [routeName],
            [],
            ["Distancia Total", `${distanceKm} km`],
            ["Duración Total", `${durationMin} min`],
            [],
            ["Orden", "Nombre", "Dirección", "Latitud", "Longitud"],
          ];
          
          // Add one row per passenger (stop order repeats if multiple passengers at same stop)
          stops.forEach((stop) => {
            // Skip start point if it has no passengers
            if (stop.isStartPoint && stop.passengers.length === 0) return;
            
            const orderLabel = stop.isStartPoint ? "Inicio" : String(stop.order);
            const address = stop.address || "Sin dirección";
            const lat = stop.location?.lat || "";
            const lon = stop.location?.lon || "";
            
            // If stop has passengers, create one row per passenger
            if (stop.passengers.length > 0) {
              stop.passengers.forEach((passenger) => {
                routeData.push([
                  orderLabel,
                  passenger.name || "",
                  address,
                  lat,
                  lon,
                ]);
              });
            } else {
              // If stop has no passengers, still add one row with empty name
              routeData.push([
                orderLabel,
                "",
                address,
                lat,
                lon,
              ]);
            }
          });
          
          // Create sheet and add to workbook
          const routeSheet = XLSX.utils.aoa_to_sheet(routeData);
          // Limit sheet name to 31 characters (Excel limit)
          const sheetName = routeName.length > 31 ? routeName.substring(0, 31) : routeName;
          XLSX.utils.book_append_sheet(workbook, routeSheet, sheetName);
          console.log(`Added sheet: ${sheetName} with ${routeData.length} rows`);
        } catch (routeError) {
          console.error(`Error processing route ${routeIndex}:`, routeError);
          // Continue with other routes even if one fails
        }
      });
      
      console.log(`Total sheets created: ${workbook.SheetNames.length}`);

      // Check if workbook has any sheets
      if (workbook.SheetNames.length === 0) {
        console.error("No sheets were created in the workbook");
        toast({
          title: "Error",
          description: "No se pudieron crear las hojas de Excel. Verifica que haya rutas con datos válidos.",
          variant: "destructive",
        });
        return;
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const runId = selectedRunId || selectedOptimizationRunId || timestamp;
      const filename = `optimizacion_${runId}_${timestamp}.xlsx`;

      console.log(`Writing Excel file: ${filename} with ${workbook.SheetNames.length} sheets`);

      // Write the file
      XLSX.writeFile(workbook, filename);

      console.log("Excel file written successfully");

      toast({
        title: "Exportación exitosa",
        description: `Archivo ${filename} descargado correctamente`,
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      console.error("Error details:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        routesCount: routes.length,
      });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo exportar el archivo Excel",
        variant: "destructive",
      });
    }
  };

  // Helper function to convert hex color to KML format (ABGR)
  const hexToKMLColor = (hex: string, opacity: number = 255): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Convert to ABGR (Alpha, Blue, Green, Red)
    return `${opacity.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`.toUpperCase();
  };

  const handleExportToKML = async () => {
    console.log("handleExportToKML called", {
      hasSelectedRunData: !!selectedRunData,
      routesCount: routes.length,
      selectedRunId,
      selectedOptimizationRunId
    });
    
    // Check if we have routes loaded (either from selectedRunData or from Supabase)
    if (!selectedRunData && routes.length === 0) {
      console.error("No data available for export");
      toast({
        title: "Error",
        description: "No hay datos de optimización para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prioritize routes loaded from Supabase (more reliable for previously loaded optimizations)
      let solutions: any[] = [];
      
      if (routes.length > 0) {
        // Build solutions structure from routes (works for both newly run and loaded optimizations)
        // Routes from Supabase have route_data.route which contains stops with stop.location
        console.log("Building solutions from routes. Routes count:", routes.length);
        console.log("Sample route structure:", routes[0]);
        
        try {
          solutions = [{
            vehicles: routes.map((route: any, routeIndex: number) => {
              try {
                // Parse route_data if it's a string (JSONB from Supabase)
                let routeData = route.route_data;
                if (typeof routeData === 'string') {
                  try {
                    routeData = JSON.parse(routeData);
                  } catch (e) {
                    console.warn(`Failed to parse route_data as JSON for route ${routeIndex}:`, e);
                    routeData = null;
                  }
                }
                
                // Get route stops from route_data.route
                // The route_data.route already has stops in format { stop: { id, location } }
                let routeStops = routeData?.route || [];
                
                // If route_data.route is empty, try to build from stops array
                if (routeStops.length === 0 && route.stops && Array.isArray(route.stops)) {
                  console.log(`Route ${routeIndex} has no route_data.route, building from stops array`);
                  routeStops = route.stops.map((stop: any) => {
                    // Try to get location from fk_pickup_point first
                    let location = null;
                    if (stop.fk_pickup_point) {
                      const lat = stop.fk_pickup_point.latitude;
                      const lon = stop.fk_pickup_point.longitude;
                      if (lat != null && lon != null) {
                        location = {
                          lat: Number(lat),
                          lon: Number(lon)
                        };
                      }
                    }
                    
                    // Fallback to stop's own location fields if available
                    if (!location && stop.latitude != null && stop.longitude != null) {
                      location = {
                        lat: Number(stop.latitude),
                        lon: Number(stop.longitude)
                      };
                    }
                    
                    return {
                      stop: {
                        id: stop.nextmv_id || stop.id,
                        location: location
                      }
                    };
                  });
                }
                
                console.log(`Route ${routeIndex}:`, {
                  routeId: route.id,
                  routeDataId: routeData?.id,
                  routeStopsCount: routeStops.length,
                  firstStop: routeStops[0],
                  hasRouteData: !!routeData,
                  hasStops: !!route.stops
                });
                
                // Validate and filter stops with valid locations
                const validStops = routeStops.filter((routeStop: any) => {
                  const location = routeStop.stop?.location;
                  const isValid = location && location.lat != null && location.lon != null;
                  if (!isValid) {
                    console.warn(`Invalid stop in route ${routeIndex}:`, routeStop);
                  }
                  return isValid;
                });
                
                if (validStops.length === 0) {
                  console.warn(`Route ${route.id} has no valid stops with locations`);
                }
                
                return {
                  id: routeData?.id || route.vehicle_id || `vehicle-${routeIndex}`,
                  route: validStops, // Filter out stops without valid locations
                  _routeIndex: routeIndex, // Store original route index for matching
                  _route: route // Store route reference for accessing fk_vehicle
                };
              } catch (error) {
                console.error(`Error processing route ${routeIndex}:`, error);
                // Return empty route to avoid breaking the entire export
                return {
                  id: route.vehicle_id || `vehicle-${routeIndex}`,
                  route: [],
                  _routeIndex: routeIndex,
                  _route: route
                };
              }
            }).filter((vehicle: any) => vehicle.route.length > 0) // Only include vehicles with valid stops
          }];
          console.log("Built solutions from routes:", solutions);
          console.log("Total vehicles in solutions:", solutions[0]?.vehicles?.length || 0);
        } catch (error) {
          console.error("Error building solutions from routes:", error);
          throw error; // Re-throw to be caught by outer catch
        }
      } else if (selectedRunData) {
        // Fallback to selectedRunData if routes are not available
        solutions = selectedRunData.output?.solutions || selectedRunData.solutions || [];
      }
      
      if (solutions.length === 0 || (solutions[0]?.vehicles?.length || 0) === 0) {
        console.error("No solutions available for export:", {
          solutionsLength: solutions.length,
          vehiclesCount: solutions[0]?.vehicles?.length || 0,
          routesCount: routes.length,
          hasSelectedRunData: !!selectedRunData
        });
        toast({
          title: "Error",
          description: "No hay soluciones disponibles para exportar. Verifique que las rutas tengan paradas válidas.",
          variant: "destructive",
        });
        return;
      }

      // Show loading toast
      toast({
        title: "Generando KML",
        description: "Obteniendo rutas de Mapbox...",
      });

      // Mapbox token (same as in Map component)
      const MAPBOX_TOKEN = "pk.eyJ1Ijoicm9kcmlnb2l2YW5mIiwiYSI6ImNtaHhoOHk4azAxNjcyanExb2E2dHl6OTMifQ.VO6hcKB-pIDvb8ZFFpLdfw";

      // Color palette matching the map colors
      const routeColors = [
        "#26bc30", // Green
        "#3b82f6", // Blue
        "#f59e0b", // Amber
        "#ef4444", // Red
        "#8b5cf6", // Purple
        "#ec4899", // Pink
        "#06b6d4", // Cyan
        "#84cc16", // Lime
      ];

      // Start building KML
      const runId = selectedRunId || selectedOptimizationRunId || 'N/A';
      let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Optimización de Rutas - ${runId}</name>
    <description>Rutas generadas por NextMV con rutas de Mapbox</description>
`;

      // Add styles for each vehicle route
      let globalRouteIndex = 0;
      solutions.forEach((solution: any, solutionIndex: number) => {
        const solutionVehicles = solution.vehicles || [];
        solutionVehicles.forEach((vehicle: any, vehicleIndex: number) => {
          const colorIndex = globalRouteIndex % routeColors.length;
          const color = routeColors[colorIndex];
          const kmlColor = hexToKMLColor(color, 200); // 200 opacity for routes
          const kmlColorOpaque = hexToKMLColor(color, 255); // Full opacity for placemarks
          
          const styleId = `route-${solutionIndex}-${vehicleIndex}`;
          kml += `    <Style id="${styleId}">
      <LineStyle>
        <color>${kmlColor}</color>
        <width>4</width>
      </LineStyle>
      <PolyStyle>
        <color>${kmlColorOpaque}</color>
      </PolyStyle>
    </Style>
`;
          globalRouteIndex++;
        });
      });

      // Fetch Mapbox routes for all vehicles in parallel
      const routePromises: Promise<{ solutionIndex: number; vehicleIndex: number; vehicle: any; geometry: any }>[] = [];
      globalRouteIndex = 0;
      
      solutions.forEach((solution: any, solutionIndex: number) => {
        const solutionVehicles = solution.vehicles || [];
        
        solutionVehicles.forEach((vehicle: any, vehicleIndex: number) => {
          const vehicleRoute = vehicle.route || [];
          
          if (vehicleRoute.length >= 2) {
            // Build waypoints for Mapbox Directions API
            const coordinates: number[][] = [];
            vehicleRoute.forEach((routeStop: any) => {
              const location = routeStop.stop?.location;
              if (location && location.lat && location.lon) {
                coordinates.push([location.lon, location.lat]);
              }
            });

            if (coordinates.length >= 2) {
              const waypoints = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
              const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
              
              routePromises.push(
                fetch(directionsUrl)
                  .then(response => {
                    if (!response.ok) {
                      console.warn(`Mapbox API error for vehicle ${vehicle.id || vehicleIndex}: ${response.status} ${response.statusText}`);
                      throw new Error(`Mapbox API error: ${response.status}`);
                    }
                    return response.json();
                  })
                  .then(data => {
                    console.log(`Mapbox response for vehicle ${vehicle.id || vehicleIndex}:`, {
                      code: data.code,
                      hasRoutes: !!(data.routes && data.routes.length > 0),
                      hasGeometry: !!(data.routes && data.routes[0] && data.routes[0].geometry),
                      geometryType: data.routes?.[0]?.geometry?.type,
                      coordCount: data.routes?.[0]?.geometry?.coordinates?.length
                    });
                    
                    if (data.code === 'Ok' && data.routes && data.routes.length > 0 && data.routes[0].geometry) {
                      const geometry = data.routes[0].geometry;
                      // Ensure we have valid coordinates
                      if (geometry.coordinates && geometry.coordinates.length > 0) {
                        return {
                          solutionIndex,
                          vehicleIndex,
                          vehicle,
                          geometry: geometry
                        };
                      }
                    }
                    
                    // Fallback to straight line
                    console.warn(`Using fallback straight line for vehicle ${vehicle.id || vehicleIndex}`);
                    return {
                      solutionIndex,
                      vehicleIndex,
                      vehicle,
                      geometry: {
                        type: "LineString",
                        coordinates: coordinates
                      }
                    };
                  })
                  .catch(error => {
                    console.error(`Error fetching Mapbox route for vehicle ${vehicle.id || vehicleIndex}:`, error);
                    // Fallback to straight line
                    return {
                      solutionIndex,
                      vehicleIndex,
                      vehicle,
                      geometry: {
                        type: "LineString",
                        coordinates: coordinates
                      }
                    };
                  })
              );
            } else {
              // Not enough coordinates, use straight line
              routePromises.push(Promise.resolve({
                solutionIndex,
                vehicleIndex,
                vehicle,
                geometry: {
                  type: "LineString",
                  coordinates: coordinates.length > 0 ? coordinates : []
                }
              }));
            }
          } else {
            // Not enough stops, skip route line
            routePromises.push(Promise.resolve({
              solutionIndex,
              vehicleIndex,
              vehicle,
              geometry: null
            }));
          }
          
          globalRouteIndex++;
        });
      });

      // Wait for all Mapbox route fetches to complete
      console.log(`Waiting for ${routePromises.length} Mapbox route fetches...`);
      const routeData = await Promise.all(routePromises);
      console.log(`Completed ${routeData.length} route fetches. Results:`, routeData.map(r => ({
        solution: r.solutionIndex,
        vehicle: r.vehicleIndex,
        hasGeometry: !!r.geometry,
        coordCount: r.geometry?.coordinates?.length || 0,
        geometryType: r.geometry?.type
      })));

      // Helper functions to extract person_id
      const extractPersonIdFromStopId = (stopId: string): string | undefined => {
        if (!stopId) return undefined;
        const match = stopId.match(/__person_(.+)$/);
        return match ? match[1] : undefined;
      };
      
      const MapConstructorForKML = globalThis.Map || window.Map;
      const pointIdToPersonMapForKML = new MapConstructorForKML<string, string>();
      pickupPoints.forEach((point) => {
        if (point.person_id) {
          pointIdToPersonMapForKML.set(point.id, point.person_id);
        }
      });
      
      const extractOriginalPointId = (stopId: string): string => {
        if (!stopId) return stopId;
        const index = stopId.indexOf('__person_');
        return index > -1 ? stopId.substring(0, index) : stopId;
      };

      // Process all solutions and vehicles
      globalRouteIndex = 0;
      solutions.forEach((solution: any, solutionIndex: number) => {
        const solutionVehicles = solution.vehicles || [];
        
        solutionVehicles.forEach((vehicle: any, vehicleIndex: number) => {
          // Get route name - prioritize route.name (e.g., "Route for AAA120") as shown in web interface
          let routeName = `Vehículo ${vehicleIndex + 1}`;
          
          // First priority: get route name from stored route reference (matches web interface)
          if (vehicle._route?.name) {
            routeName = vehicle._route.name;
          } else if (routes.length > 0 && vehicle._routeIndex !== undefined && routes[vehicle._routeIndex]) {
            // Fallback: use stored route index to get route
            const route = routes[vehicle._routeIndex];
            if (route.name) {
              routeName = route.name;
            } else if (route.fk_vehicle?.name) {
              // If no route.name, construct it like the web interface: "Route for {plate}"
              routeName = `Route for ${route.fk_vehicle.name}`;
            } else if (route.vehicle_id) {
              const vehicleInfo = vehicles.find(v => v.id === route.vehicle_id);
              if (vehicleInfo?.name) {
                routeName = `Route for ${vehicleInfo.name}`;
              }
            }
          }
          
          // If still not found, try matching with vehicles array by vehicle.id
          if (routeName === `Vehículo ${vehicleIndex + 1}`) {
            const vehicleInfo = vehicles.find(v => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
            if (vehicleInfo?.name) {
              routeName = `Route for ${vehicleInfo.name}`;
            } else if (vehicle.id && vehicle.id !== `vehicle-${vehicleIndex}`) {
              routeName = `Route for ${vehicle.id}`;
            }
          }
          
          const vehicleRoute = vehicle.route || [];
          const routeInfo = routeData.find(r => r.solutionIndex === solutionIndex && r.vehicleIndex === vehicleIndex);
          const styleId = `route-${solutionIndex}-${vehicleIndex}`;
          
          // Debug: Log route info
          console.log(`Processing vehicle ${vehicle.id || vehicleIndex} (solution ${solutionIndex}, vehicle ${vehicleIndex}):`, {
            hasRouteInfo: !!routeInfo,
            hasGeometry: !!(routeInfo?.geometry),
            coordCount: routeInfo?.geometry?.coordinates?.length || 0,
            geometryType: routeInfo?.geometry?.type
          });
          
          // Create folder for this vehicle route with route name
          kml += `    <Folder>
      <name>${routeName} - Solución ${solutionIndex + 1}</name>
      <description>${routeName} (ID: ${vehicle.id || vehicleIndex + 1})</description>
`;

          // Create route path (LineString) using Mapbox geometry
          if (routeInfo && routeInfo.geometry && routeInfo.geometry.coordinates && Array.isArray(routeInfo.geometry.coordinates) && routeInfo.geometry.coordinates.length > 0) {
            // Convert GeoJSON coordinates (lon,lat) to KML format (lon,lat,altitude)
            const geoJsonCoords = routeInfo.geometry.coordinates;
            console.log(`Using Mapbox geometry for vehicle ${vehicle.id || vehicleIndex}: ${geoJsonCoords.length} coordinates, first:`, geoJsonCoords[0]);
            
            const kmlCoordinates = geoJsonCoords
              .map((coord: number[]) => {
                // Handle both [lon, lat] and [lon, lat, elevation] formats
                const lon = coord[0];
                const lat = coord[1];
                const alt = coord.length > 2 ? coord[2] : 0;
                // KML format: longitude,latitude,altitude (space-separated)
                return `${lon},${lat},${alt}`;
              })
              .join(' ');

            kml += `      <Placemark>
        <name>${routeName}</name>
        <description>${routeName} (generada por Mapbox - ${geoJsonCoords.length} puntos)</description>
        <styleUrl>#${styleId}</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${kmlCoordinates}</coordinates>
        </LineString>
      </Placemark>
`;
          } else {
            console.warn(`No Mapbox geometry for vehicle ${vehicle.id || vehicleIndex}, routeInfo:`, routeInfo);
            if (vehicleRoute.length > 0) {
              // Fallback: use stop coordinates if Mapbox route not available
              const coordinates: string[] = [];
              vehicleRoute.forEach((routeStop: any) => {
                const location = routeStop.stop?.location;
                if (location && location.lat && location.lon) {
                  coordinates.push(`${location.lon},${location.lat},0`);
                }
              });

              if (coordinates.length > 0) {
                kml += `      <Placemark>
        <name>${routeName}</name>
        <description>${routeName} (línea recta - Mapbox no disponible)</description>
        <styleUrl>#${styleId}</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${coordinates.join(' ')}</coordinates>
        </LineString>
      </Placemark>
`;
              }
            }
          }

          // Create placemarks for each stop (always create these, regardless of route type)
          if (vehicleRoute && vehicleRoute.length > 0) {
            console.log(`Creating ${vehicleRoute.length} stop placemarks for vehicle ${vehicle.id || vehicleIndex}`);
            vehicleRoute.forEach((routeStop: any, stopIndex: number) => {
              const stop = routeStop.stop || {};
              const location = stop.location;
              
              if (location && location.lat && location.lon) {
                const originalPointId = extractOriginalPointId(stop.id || '');
                const originalPoint = pickupPoints.find(p => p.id === originalPointId);
                
                // Try to get passenger names and address from loaded routes
                let passengerNames: string[] = [];
                let stopAddress: string | null = null;
                
                // Check if we have routes with stops data (from loaded optimizations)
                if (routes.length > 0) {
                  for (const loadedRoute of routes) {
                    const routeStops = loadedRoute.stops || [];
                    for (const loadedStop of routeStops) {
                      const loadedStopId = loadedStop.nextmv_id || loadedStop.id;
                      const loadedOriginalPointId = extractOriginalPointId(loadedStopId);
                      
                      if (loadedOriginalPointId === originalPointId || loadedStopId === stop.id) {
                        // Get address from pickup_point
                        if (loadedStop.fk_pickup_point) {
                          stopAddress = loadedStop.fk_pickup_point.address || null;
                        }
                        
                        // Get passenger names
                        if (loadedStop.passengers && Array.isArray(loadedStop.passengers)) {
                          const names = loadedStop.passengers
                            .map((sp: any) => {
                              const passenger = sp.fk_passenger || sp;
                              return passenger?.name || null;
                            })
                            .filter((name: string | null) => name !== null);
                          passengerNames = [...new Set([...passengerNames, ...names])]; // Remove duplicates
                        }
                        break;
                      }
                    }
                    if (stopAddress || passengerNames.length > 0) break;
                  }
                }
                
                // Fallback to original point data if not found in routes
                if (!stopAddress && originalPoint?.address && originalPoint.address !== `${location.lat}, ${location.lon}`) {
                  stopAddress = originalPoint.address;
                }
                
                const stopType = stop.type || (stopIndex === 0 ? "Inicio" : stopIndex === vehicleRoute.length - 1 ? "Fin" : "Parada");
                const stopName = `${routeName} - ${stopIndex + 1}`;
                let stopDescription = `Tipo: ${stopType}\nOrden en ruta: ${stopIndex + 1}\nRuta: ${routeName}`;
                
                // Add address if available
                if (stopAddress) {
                  stopDescription += `\nDirección: ${stopAddress}`;
                }
                
                // Add passenger names if available
                if (passengerNames.length > 0) {
                  stopDescription += `\nPasajeros:\n${passengerNames.map(name => `  • ${name}`).join('\n')}`;
                } else {
                  // Fallback to person_id if no passenger names
                  let personIds = "";
                  if (originalPoint?.person_id) {
                    personIds = originalPoint.person_id;
                  } else {
                    const personIdFromStopId = extractPersonIdFromStopId(stop.id || '');
                    if (personIdFromStopId) {
                      personIds = personIdFromStopId;
                    } else {
                      const personIdFromMap = pointIdToPersonMapForKML.get(originalPointId);
                      if (personIdFromMap) {
                        personIds = personIdFromMap;
                      }
                    }
                  }
                  if (personIds) {
                    stopDescription += `\nID Persona(s): ${personIds}`;
                  }
                }
                
                // Use different icons for start/end/stops
                let iconUrl = "http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png";
                if (stopIndex === 0) {
                  iconUrl = "http://maps.google.com/mapfiles/kml/shapes/arrow.png"; // Start
                } else if (stopIndex === vehicleRoute.length - 1) {
                  iconUrl = "http://maps.google.com/mapfiles/kml/shapes/placemark_square.png"; // End
                }

                kml += `      <Placemark>
        <name>${stopName}</name>
        <description><![CDATA[${stopDescription}]]></description>
        <styleUrl>#${styleId}</styleUrl>
        <Point>
          <coordinates>${location.lon},${location.lat},0</coordinates>
        </Point>
        <Style>
          <IconStyle>
            <Icon>
              <href>${iconUrl}</href>
            </Icon>
            <scale>1.2</scale>
          </IconStyle>
          <LabelStyle>
            <scale>0.8</scale>
          </LabelStyle>
        </Style>
      </Placemark>
`;
              } else {
                console.warn(`Stop ${stopIndex} for vehicle ${vehicle.id || vehicleIndex} has no valid location:`, location);
              }
            });
          } else {
            console.warn(`No route stops found for vehicle ${vehicle.id || vehicleIndex}`);
          }

          kml += `    </Folder>
`;
          globalRouteIndex++;
        });
      });

      // Close KML
      kml += `  </Document>
</kml>`;

      // Create blob and download
      console.log("Creating KML blob. KML length:", kml.length);
      const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
      console.log("Blob created. Size:", blob.size, "bytes");
      
      if (blob.size === 0) {
        throw new Error("El archivo KML generado está vacío");
      }
      
      const url = URL.createObjectURL(blob);
      console.log("Object URL created:", url);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `optimizacion_${runId}_${timestamp}.kml`;
      
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        console.log("Link created and appended. Triggering click...");
        link.click();
        
        // Small delay before cleanup to ensure download starts
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log("Link removed and URL revoked");
        }, 100);

        toast({
          title: "Exportación exitosa",
          description: `Archivo KML ${filename} descargado correctamente`,
        });
      } catch (downloadError) {
        console.error("Error during download:", downloadError);
        URL.revokeObjectURL(url);
        throw new Error(`Error al descargar el archivo: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
      }
    } catch (error) {
      console.error("Error exporting to KML:", error);
      console.error("Error details:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        selectedRunData: !!selectedRunData,
        routesCount: routes.length,
      });
      toast({
        title: "Error",
        description: `Error al exportar KML: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      {/* Banner indicating historical execution */}
      {(selectedRunId || selectedOptimizationRunId) && routes.length > 0 && (
        <Card className="mb-4 border-primary/50 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Visualizando Ejecución Histórica</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedOptimizationRunId ? (
                      <>Optimización: {selectedOptimizationRunId.substring(0, 8)}... | {routes.length} ruta(s) de todos los grupos</>
                    ) : (
                      <>ID: {selectedRunId} | {selectedRunData && (selectedRunData.metadata?.created_at || selectedRunData.created_at) && 
                      new Date(selectedRunData.metadata?.created_at || selectedRunData.created_at).toLocaleString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                        })}</>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedRunId(null);
                  setSelectedOptimizationRunId(null);
                  setSelectedRunData(null);
                  setRoutes([]);
                  setVisibleRoutes(new Set());
                  setSelectedRouteIndex(null);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Runs List - Show when no run is selected or collapsed */}
      {(!selectedRunId && !selectedOptimizationRunId || routes.length === 0) && (
        <div className="space-y-6 mb-6">
          {/* Optimization Runs from Supabase (grouped by optimization_run_id) */}
          {optimizationRuns.length > 0 && (
            <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" />
                    <span>Ejecuciones Anteriores (Todos los Grupos)</span>
                  </div>
                  <Button
                    onClick={loadOptimizationRuns}
                    variant="outline"
                    size="sm"
                    disabled={isOptimizing}
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <History className="w-4 h-4 mr-2" />
                        Actualizar
                      </>
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {optimizationRuns.map((optRun) => {
                    const isSelected = selectedOptimizationRunId === optRun.optimization_run_id;
                    const gruposList = Array.from(optRun.grupos).filter(g => g !== null);
                    const hasMultipleGrupos = gruposList.length > 1;
                    
                    return (
                      <Card
                        key={optRun.optimization_run_id}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => handleOptimizationRunSelect(optRun.optimization_run_id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">
                                Ejecución: {optRun.optimization_run_id.substring(0, 8)}...
                              </p>
                              <p className={`text-xs mt-1 ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>
                                {optRun.route_count} ruta(s) | {gruposList.length > 0 ? `${gruposList.length} grupo(s): ${gruposList.join(', ')}` : 'Sin grupo'}
                                {optRun.nextmv_run_ids && optRun.nextmv_run_ids.length > 0 && (
                                  <> | {optRun.nextmv_run_ids.length} ejecución(es) Nextmv</>
                                )}
                                <br />
                                {new Date(optRun.created_at).toLocaleString('es-ES', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            {isSelected && isOptimizing && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            {isSelected && !isOptimizing && (
                              <span className="text-xs">✓ Seleccionado</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nextmv Runs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  <span>Ejecuciones Nextmv</span>
              </div>
              <Button
                onClick={loadRuns}
                variant="outline"
                size="sm"
                disabled={isLoadingRuns}
              >
                {isLoadingRuns ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <History className="w-4 h-4 mr-2" />
                    Actualizar
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRuns ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">
                  No hay ejecuciones disponibles
                </p>
                <Button onClick={() => navigate("/new")} variant="outline">
                  Crear Nueva Optimización
                </Button>
              </div>
            ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {runs.map((run) => {
                  const runId = run.id || run.run_id;
                  const status = run.metadata?.status || run.status || "unknown";
                  const createdAt = run.metadata?.created_at || run.created_at || "";
                  const isSelected = selectedRunId === runId;
                  
                  const statusDisplay = status === "succeeded" ? "✓ Completado" :
                                       status === "failed" ? "✗ Fallido" :
                                       status === "error" ? "✗ Error" :
                                       status === "running" ? "⟳ Ejecutando" :
                                       status === "queued" ? "⏳ En cola" :
                                       status;
                  
                  return (
                    <Card
                      key={runId}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => handleRunSelect(runId)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">ID: {runId}</p>
                            <p className={`text-xs mt-1 ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>
                              {statusDisplay} | {createdAt ? new Date(createdAt).toLocaleString('es-ES', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : "Fecha desconocida"}
                                <br />
                                <span className="text-[10px] opacity-75">💡 Click para ver todas las optimizaciones relacionadas</span>
                            </p>
                          </div>
                          {isSelected && isOptimizing && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          {isSelected && !isOptimizing && (
                            <span className="text-xs">✓ Seleccionado</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* Routes and Map Display - Show when a run is selected and routes are loaded */}
      {(selectedRunId || selectedOptimizationRunId) && routes.length > 0 && (
        <div className="flex gap-4 w-full">
          {/* Results Container - Left Side */}
          <div className="w-[450px] flex-shrink-0 flex flex-col h-[calc(100vh-240px)] pr-2">
            <Tabs defaultValue="summary" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mb-2 flex-shrink-0 h-10">
                <TabsTrigger value="summary">Resumen</TabsTrigger>
                <TabsTrigger value="routes">Rutas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="!mt-0 h-[calc(100%-2.5rem)]">
                <div className="h-full flex flex-col">
                  <Card className="flex-1 min-h-0 flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Optimización
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm flex-1 min-h-0 overflow-y-auto">
                      <div className="grid grid-cols-3 gap-2 pb-3 border-b flex-shrink-0">
                        <div className="flex flex-col items-center text-center">
                          <MapPin className="w-5 h-5 mb-1 text-primary" />
                          <p className="text-xs text-muted-foreground mb-1">Puntos</p>
                          <p className="text-lg font-bold">{uniquePointsCount}</p>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <Truck className="w-5 h-5 mb-1 text-secondary-foreground" />
                          <p className="text-xs text-muted-foreground mb-1">Vehículos</p>
                          <p className="text-lg font-bold">{vehicles.length}</p>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <Route className="w-5 h-5 mb-1 text-accent-foreground" />
                          <p className="text-xs text-muted-foreground mb-1">Rutas</p>
                          <p className="text-lg font-bold">{routeCount}</p>
                        </div>
                      </div>

                      {selectedRunId && (
                        <div>
                          <p className="text-muted-foreground text-xs">ID de Ejecución</p>
                          <p className="font-mono text-xs break-all">{selectedRunId}</p>
                        </div>
                      )}
                      {selectedRunData && (selectedRunData.metadata?.created_at || selectedRunData.created_at) && (
                        <div>
                          <p className="text-muted-foreground text-xs">Fecha</p>
                          <p className="text-xs">
                            {new Date(selectedRunData.metadata?.created_at || selectedRunData.created_at).toLocaleString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                      {selectedRunData && (selectedRunData.metadata?.status || selectedRunData.status) && (
                        <div className="pt-2 border-t">
                          <p className="text-muted-foreground text-xs">Estado</p>
                          <p className="text-xs">
                            {(() => {
                              const status = selectedRunData.metadata?.status || selectedRunData.status;
                              return status === "succeeded" ? "✓ Completado" :
                                     status === "failed" ? "✗ Fallido" :
                                     status === "error" ? "✗ Error" :
                                     status === "running" ? "⟳ Ejecutando" :
                                     status === "queued" ? "⏳ En cola" :
                                     status;
                            })()}
                          </p>
                        </div>
                      )}
                      <div className="pt-2 border-t space-y-2">
                        <Button
                          onClick={handleExportToExcel}
                          variant="default"
                          size="sm"
                          className="w-full"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Descargar Excel
                        </Button>
                        <Button
                          onClick={handleExportToKML}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Descargar KML
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="routes" className="!mt-0 h-[calc(100%-2.5rem)]">
                <div className="h-full flex flex-col">
                  <Card className="flex-1 min-h-0 flex flex-col h-full">
                    <CardHeader className="pb-2 pt-3 px-3 flex-shrink-0">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>Lista de Rutas</span>
                        {selectedRouteIndex !== null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              setSelectedRouteIndex(null);
                              setVisibleRoutes(new Set(routes.map((_, index) => index)));
                            }}
                          >
                            <ArrowLeft className="w-3 h-3 mr-1" />
                            Volver
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 flex flex-col !p-0 overflow-hidden">
                      {selectedRouteIndex === null ? (
                        // Route List View
                        <div className="space-y-2 h-full overflow-y-auto px-3 pb-3">
                          {routes.map((route, index) => {
                            const routeColors = [
                              "#26bc30", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
                            ];
                            const color = routeColors[index % routeColors.length];
                            const vehicleRoute = route.route_data?.route || [];
                            const actualStops = vehicleRoute.filter((routeStop: any) => {
                              const stopId = routeStop.stop?.id;
                              return stopId && !stopId.includes("-start") && !stopId.includes("-end");
                            }).length;
                            const passengers = extractPassengersFromRoute(route);
                            const passengerCount = passengers.length;
                            // Get vehicle capacity
                            const vehicle = vehicles.find(v => v.id === route.vehicle_id);
                            const vehicleCapacity = vehicle?.capacity || 0;
                            // Get distance and duration from route (stored in meters and seconds)
                            const totalDistance = route.total_distance || route.route_data?.route_travel_distance || 0;
                            const totalDuration = route.total_duration || route.route_data?.route_travel_duration || 0;
                            
                            // Convert distance from meters to km
                            const distanceKm = (totalDistance / 1000).toFixed(2);
                            const distanceUnit = "km";
                            
                            // Convert duration from seconds to minutes
                            const durationMin = (totalDuration / 60).toFixed(1);
                            const durationUnit = "min";
                            
                            // Get grupo from the route itself (originally assigned group)
                            const routeGrupo = route.grupo;
                            
                            return (
                              <div
                                key={index}
                                className="p-2 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                                onClick={() => {
                                  setSelectedRouteIndex(index);
                                  setVisibleRoutes(new Set([index]));
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div
                                    className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5"
                                    style={{ backgroundColor: color }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm truncate">
                                        {route.name || vehicle?.name || `Ruta ${index + 1}`}
                                      </p>
                                      {routeGrupo && (
                                        <span className="px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-md border border-purple-300">
                                          {routeGrupo}
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                                      <div>
                                        <span className="font-medium">Pasajeros:</span> {vehicleCapacity > 0 ? `${passengerCount} / ${vehicleCapacity}` : passengerCount}
                                      </div>
                                      <div>
                                        <span className="font-medium">Paradas:</span> {actualStops}
                                      </div>
                                      <div>
                                        <span className="font-medium">Distancia:</span> {distanceKm} {distanceUnit}
                                      </div>
                                      <div>
                                        <span className="font-medium">Duración:</span> {durationMin} {durationUnit}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // Route Detail View
                        (() => {
                          const selectedRoute = routes[selectedRouteIndex];
                          if (!selectedRoute) return null;
                          
                          const routeColors = [
                            "#26bc30", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
                          ];
                          const color = routeColors[selectedRouteIndex % routeColors.length];
                          // Use route name from Supabase if available, otherwise fallback to vehicle name or generic name
                          const vehicleName = selectedRoute.name || vehicles.find(v => v.id === selectedRoute.vehicle_id)?.name || `Ruta ${selectedRouteIndex + 1}`;
                          const vehicleRoute = selectedRoute.route_data?.route || [];
                          
                          // Extract original point ID helper
                          const extractOriginalPointId = (stopId: string): string => {
                            if (!stopId) return stopId;
                            const idx = stopId.indexOf('__person_');
                            return idx > -1 ? stopId.substring(0, idx) : stopId;
                          };
                          
                          // Get all stops including start point (but excluding end point)
                          let stopCounter = 1; // Start at 1 for regular stops (start point will be 0)
                          const stopsWithDetails = vehicleRoute
                            .filter((routeStop: any) => {
                              const stopId = routeStop.stop?.id;
                              return stopId && !stopId.includes("-end");
                            })
                            .map((routeStop: any) => {
                              const stopId = routeStop.stop?.id;
                              const isStartPoint = stopId?.includes("-start");
                              
                              // Extract original point ID (always do this for fallback)
                              const extractOriginalPointId = (stopId: string): string => {
                                if (!stopId) return stopId;
                                const index = stopId.indexOf('__person_');
                                return index > -1 ? stopId.substring(0, index) : stopId;
                              };
                              
                              const originalPointId = extractOriginalPointId(stopId);
                              
                              // NEW APPROACH: Find pickup_point by stop_id from database
                              // This is more reliable than extracting from encoded stop IDs
                              let point = pickupPoints.find(p => p.stop_id === stopId);
                              
                              // Fallback: if not found by stop_id, try original point ID extraction
                              if (!point) {
                                point = pickupPoints.find(p => p.id === originalPointId);
                              }
                              
                              // Extract person IDs from the pickup_point (primary source)
                              const personIds = new Set<string>();
                              if (!isStartPoint && point?.person_id) {
                                const ids = point.person_id.split(',').map(id => id.trim()).filter(id => id);
                                ids.forEach(id => personIds.add(id));
                              }
                              
                              // Legacy fallback: Extract person IDs from stop ID if encoded (only if not found in point)
                              // This is for backwards compatibility with older optimizations
                              if (!isStartPoint && personIds.size === 0 && stopId.includes('__person_')) {
                                const regex = /__person_([^_]+?)(?=__person_|$)/g;
                                let match;
                                while ((match = regex.exec(stopId)) !== null) {
                                  const personId = match[1];
                                  if (personId) {
                                    personIds.add(personId);
                                  }
                                }
                              }
                              
                              // Get passengers from stop_passenger relation (if route was loaded from Supabase)
                              const stopPassengers: Array<{ id: string; name: string; code: string | null }> = [];
                              if (selectedRoute.stops && Array.isArray(selectedRoute.stops)) {
                                // Find the stop in the route's stops array
                                const dbStop = selectedRoute.stops.find((s: any) => s.nextmv_id === stopId);
                                if (dbStop && dbStop.passengers) {
                                  // Extract passengers from stop_passenger relation
                                  dbStop.passengers.forEach((sp: any) => {
                                    const passenger = sp.fk_passenger;
                                    if (passenger) {
                                      stopPassengers.push({
                                        id: passenger.id,
                                        name: passenger.name,
                                        code: passenger.code || null
                                      });
                                    }
                                  });
                                }
                              }
                              
                              // Use passengers from Supabase if available, otherwise fallback to personIds
                              const finalPassengers = stopPassengers.length > 0 
                                ? stopPassengers 
                                : Array.from(personIds).map(id => ({ id, name: id, code: id }));
                              
                              // Get point address from Supabase pickup_point (preferred) or fallback to name
                              let pointName: string;
                              if (isStartPoint) {
                                pointName = "Punto de inicio";
                              } else {
                                // Try to get address from Supabase stop's pickup_point
                                if (selectedRoute.stops && Array.isArray(selectedRoute.stops)) {
                                  const dbStop = selectedRoute.stops.find((s: any) => s.nextmv_id === stopId);
                                  if (dbStop && dbStop.fk_pickup_point && dbStop.fk_pickup_point.address) {
                                    pointName = dbStop.fk_pickup_point.address;
                                  } else if (point?.address) {
                                    pointName = point.address;
                                  } else {
                                    pointName = point?.name || `Punto ${stopCounter}`;
                                  }
                                } else if (point?.address) {
                                  pointName = point.address;
                                } else {
                                  pointName = point?.name || `Punto ${stopCounter}`;
                                }
                              }
                              
                              // Calculate stop index: start point is 0, others increment from 1
                              const stopIndex = isStartPoint ? 0 : stopCounter;
                              if (!isStartPoint) {
                                stopCounter++;
                              }
                              
                              return {
                                stopIndex: stopIndex,
                                isStartPoint: isStartPoint,
                                stopId: point?.id || originalPointId || stopId,
                                pointName: pointName,
                                personIds: Array.from(personIds), // Keep for backwards compatibility
                                passengers: finalPassengers, // New field with passenger details
                                location: routeStop.stop?.location,
                              };
                            })
                            .sort((a, b) => {
                              // Sort so start point (index 0) comes first, then others by index
                              if (a.isStartPoint) return -1;
                              if (b.isStartPoint) return 1;
                              return a.stopIndex - b.stopIndex;
                            });
                          
                          // Get vehicle from route's fk_vehicle relationship (loaded from Supabase)
                          // Fallback to vehicles array if not available in route
                          const vehicle = selectedRoute.fk_vehicle || vehicles.find(v => v.id === selectedRoute.vehicle_id);
                          
                          // Calculate route summary metrics
                          const actualStops = vehicleRoute.filter((routeStop: any) => {
                            const stopId = routeStop.stop?.id;
                            return stopId && !stopId.includes("-start") && !stopId.includes("-end");
                          }).length;
                          
                          const passengers = extractPassengersFromRoute(selectedRoute);
                          const passengerCount = passengers.length;
                          const vehicleCapacity = vehicle?.capacity || 0;
                          
                          // Add end point if vehicle has one
                          let finalStopsWithDetails = [...stopsWithDetails];
                          
                          // Check for end location from vehicle (Supabase or local)
                          let endLocation: { lon: number; lat: number } | null = null;
                          if (vehicle) {
                            // Try Supabase vehicle data first (end_latitude, end_longitude)
                            if (vehicle.end_latitude != null && vehicle.end_longitude != null) {
                              endLocation = {
                                lon: Number(vehicle.end_longitude),
                                lat: Number(vehicle.end_latitude)
                              };
                            }
                            // Fallback to local vehicle end_location
                            else if (vehicle.end_location) {
                              endLocation = vehicle.end_location;
                            }
                          }
                          
                          // If we have an end location, add it to the stop list
                          if (endLocation) {
                            finalStopsWithDetails.push({
                              stopIndex: finalStopsWithDetails.length, // Add at the end
                              isStartPoint: false,
                              isEndPoint: true,
                              stopId: 'end-point',
                              pointName: 'Punto de fin',
                              personIds: [],
                              passengers: [],
                              location: endLocation,
                            });
                          }
                          
                          // Get distance and duration from route (stored in meters and seconds)
                          const totalDistance = selectedRoute.total_distance || selectedRoute.route_data?.route_travel_distance || 0;
                          const totalDuration = selectedRoute.total_duration || selectedRoute.route_data?.route_travel_duration || 0;
                          
                          // Convert distance from meters to km
                          const distanceKm = (totalDistance / 1000).toFixed(2);
                          const distanceUnit = "km";
                          
                          // Convert duration from seconds to minutes
                          const durationMin = (totalDuration / 60).toFixed(1);
                          const durationUnit = "min";
                          
                          return (
                            <div className="space-y-3 h-full overflow-y-auto px-3 pb-3">
                              {/* Route Summary Card */}
                              <div className="p-2 rounded-lg border bg-card">
                                <div className="flex items-start gap-2">
                                  <div
                                    className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5"
                                    style={{ backgroundColor: color }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{vehicleName}</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                                      <div>
                                        <span className="font-medium">Pasajeros:</span> {vehicleCapacity > 0 ? `${passengerCount} / ${vehicleCapacity}` : passengerCount}
                                      </div>
                                      <div>
                                        <span className="font-medium">Paradas:</span> {actualStops}
                                      </div>
                                      <div>
                                        <span className="font-medium">Distancia:</span> {distanceKm} {distanceUnit}
                                      </div>
                                      <div>
                                        <span className="font-medium">Duración:</span> {durationMin} {durationUnit}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between gap-2 pb-2 border-b">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <p className="font-semibold text-sm">Detalles de Paradas</p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setZoomToRoute(selectedRouteIndex);
                                    setTimeout(() => setZoomToRoute(null), 100);
                                  }}
                                >
                                  <ZoomIn className="w-3 h-3 mr-1" />
                                  Ver ruta completa
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {finalStopsWithDetails.map((stop, idx) => (
                                  <div 
                                    key={idx} 
                                    className="p-2 rounded-lg border bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => {
                                      if (stop.location?.lon && stop.location?.lat) {
                                        setFocusLocation({
                                          lon: Number(stop.location.lon),
                                          lat: Number(stop.location.lat)
                                        });
                                        setTimeout(() => setFocusLocation(null), 1100);
                                      }
                                    }}
                                  >
                                    <div className="flex items-start gap-2 mb-1">
                                      <div 
                                        className="w-6 h-6 rounded-full text-white flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                                        style={{ backgroundColor: color }}
                                      >
                                        {stop.isStartPoint ? "S" : stop.isEndPoint ? "F" : stop.stopIndex}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">
                                          {stop.pointName}
                                        </p>
                                      </div>
                                    </div>
                                    {stop.isStartPoint ? (
                                      <p className="text-xs text-muted-foreground italic ml-8">Punto de inicio - Sin pasajeros</p>
                                    ) : stop.isEndPoint ? (
                                      <p className="text-xs text-muted-foreground italic ml-8">Punto de fin - Sin pasajeros</p>
                                    ) : stop.passengers && stop.passengers.length > 0 ? (
                                      <div className="mt-1 ml-8">
                                        <p className="text-xs text-muted-foreground mb-1">Pasajeros:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {stop.passengers.map((passenger: any, pIdx: number) => (
                                            <span
                                              key={pIdx}
                                              className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded"
                                              title={passenger.code ? `ID: ${passenger.code}` : undefined}
                                            >
                                              {passenger.name} {passenger.code ? `(${passenger.code})` : ''}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : stop.personIds && stop.personIds.length > 0 ? (
                                      <div className="mt-1 ml-8">
                                        <p className="text-xs text-muted-foreground mb-1">Pasajeros:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {stop.personIds.map((personId, pIdx) => (
                                            <span
                                              key={pIdx}
                                              className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded"
                                            >
                                              {personId}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic ml-8">Sin pasajeros asignados</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Map Container */}
          <div className="relative min-w-0 flex-1">
            <Card className="h-[calc(100vh-240px)] w-full">
              <CardContent className="p-0 h-full w-full">
                <Map 
                  pickupPoints={pickupPoints} 
                  routes={routes} 
                  vehicles={vehicles}
                  visibleRoutes={visibleRoutes}
                  onRouteVisibilityChange={(routeIndex, visible) => {
                    setVisibleRoutes(prev => {
                      const newSet = new Set(prev);
                      if (visible) {
                        newSet.add(routeIndex);
                      } else {
                        newSet.delete(routeIndex);
                      }
                      return newSet;
                    });
                  }}
                  selectedRouteIndex={selectedRouteIndex}
                  focusLocation={focusLocation}
                  zoomToRoute={zoomToRoute}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default HistoryPage;

