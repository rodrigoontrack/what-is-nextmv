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

      setRoutes(routesData);
      setVisibleRoutes(new Set(routesData.map((_, index) => index)));

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
      const NEXTMV_APPLICATION_ID = "workspace-dgxjzzgctd";
      const NEXTMV_API_KEY = import.meta.env.VITE_NEXTMV_API_KEY || "nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230";
      
      // Use Supabase Edge Function as proxy
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const runsApiUrl = `${SUPABASE_URL}/functions/v1/nextmv-proxy/v1/applications/${NEXTMV_APPLICATION_ID}/runs`;
      
      const response = await fetch(runsApiUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "apikey": `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load runs: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const runsList = Array.isArray(data) ? data : (data.runs || data.items || []);
      
      const sortedRuns = runsList.sort((a: any, b: any) => {
        const dateA = new Date(a.metadata?.created_at || a.created_at || 0).getTime();
        const dateB = new Date(b.metadata?.created_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      
      setRuns(sortedRuns);
    } catch (error) {
      console.error("Error loading runs:", error);
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
      // First, try to find routes in Supabase that are linked to this Nextmv run ID
      // This will load all routes from all groups that were optimized together
      // Use PostgREST array contains operator: .cs (contains) or .cd (contained by)
      let finalRoutesData: any[] | null = null;
      let routesError: any = null;
      
      // Try querying with array contains - check if nextmv_run_ids array contains the runId
      const { data: routesData, error: routesError1 } = await supabase
        .from("routes")
        .select("*")
        .contains("nextmv_run_ids", [runId]) // Check if array contains the runId
        .order("created_at", { ascending: false });
      
      if (!routesError1 && routesData && routesData.length > 0) {
        finalRoutesData = routesData;
      } else {
        // Try alternative syntax using filter with cs (contains) operator
        const { data: altRoutesData, error: altError } = await supabase
          .from("routes")
          .select("*")
          .filter("nextmv_run_ids", "cs", `{${runId}}`) // Contains operator: array contains value
          .order("created_at", { ascending: false });
        
        if (!altError && altRoutesData && altRoutesData.length > 0) {
          finalRoutesData = altRoutesData;
        } else {
          routesError = altError || routesError1;
        }
      }

      if (!routesError && finalRoutesData && finalRoutesData.length > 0) {
        // Found routes linked to this Nextmv run
        // Now, we need to find ALL routes from the same optimization session
        // All routes from the same optimization will share the same optimization_run_id
        const firstRoute = finalRoutesData[0];
        const optimizationRunId = firstRoute.optimization_run_id;
        
        // If we have an optimization_run_id, load ALL routes from that optimization (all groups)
        let allRoutesFromOptimization = finalRoutesData;
        
        if (optimizationRunId) {
          console.log(`Loading all routes from optimization_run_id: ${optimizationRunId}`);
          const { data: allRoutesData, error: allRoutesError } = await supabase
            .from("routes")
            .select("*")
            .eq("optimization_run_id", optimizationRunId)
            .order("created_at", { ascending: false });
          
          if (!allRoutesError && allRoutesData && allRoutesData.length > 0) {
            allRoutesFromOptimization = allRoutesData;
            console.log(`Found ${allRoutesFromOptimization.length} total routes from optimization session (across all groups)`);
          }
        }
        
        console.log(`Found ${finalRoutesData.length} routes linked to Nextmv run ${runId}`);
        console.log(`Total routes from optimization session: ${allRoutesFromOptimization.length}`);
        console.log("Routes by grupo:", allRoutesFromOptimization.reduce((acc: any, r: any) => {
          const grupo = r.grupo || 'sin grupo';
          acc[grupo] = (acc[grupo] || 0) + 1;
          return acc;
        }, {}));

        // Set all routes from the optimization session (all groups)
        setRoutes(allRoutesFromOptimization);
        setVisibleRoutes(new Set(allRoutesFromOptimization.map((_, index) => index)));

        // Also load the run data from Nextmv for display
        try {
          const NEXTMV_APPLICATION_ID = "workspace-dgxjzzgctd";
          const NEXTMV_API_KEY = import.meta.env.VITE_NEXTMV_API_KEY || "nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230";
          
          // Use Supabase Edge Function as proxy
          const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
          const runApiUrl = `${SUPABASE_URL}/functions/v1/nextmv-proxy/v1/applications/${NEXTMV_APPLICATION_ID}/runs/${runId}`;
          
          const response = await fetch(runApiUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "apikey": `${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
          });
          
          if (response.ok) {
            const runData = await response.json();
            setSelectedRunData(runData);
          }
        } catch (apiError) {
          console.warn("Could not load run data from Nextmv API:", apiError);
          // Continue anyway - we have the routes from Supabase
        }

        toast({
          title: "Ejecución cargada",
          description: `Se cargaron ${allRoutesFromOptimization.length} rutas de todos los grupos relacionados`,
        });
        return;
      }

      // If no routes found in Supabase, fall back to loading from Nextmv API
      // (This handles old runs that weren't saved with nextmv_run_ids)
      console.log(`No routes found in Supabase for run ${runId}, loading from Nextmv API...`);
      
      const NEXTMV_APPLICATION_ID = "workspace-dgxjzzgctd";
      const NEXTMV_API_KEY = import.meta.env.VITE_NEXTMV_API_KEY || "nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230";
      
      // Always use proxy to avoid CORS issues
      const runApiUrl = `/api/nextmv/v1/applications/${NEXTMV_APPLICATION_ID}/runs/${runId}`;
      
      const response = await fetch(runApiUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load run: ${response.status} ${response.statusText}`);
      }
      
      const runData = await response.json();
      setSelectedRunData(runData);
      
      // Check if run has solutions
      const solutions = runData.output?.solutions || runData.solutions;
      if (!solutions || solutions.length === 0) {
        throw new Error("Esta ejecución no tiene soluciones disponibles");
      }
      
      // Clear old routes
      await supabase
        .from("routes")
        .delete()
        .gte("created_at", "1970-01-01");
      
      // Helper functions
      const extractPersonIdFromStopId = (stopId: string): string | undefined => {
        if (!stopId) return undefined;
        const match = stopId.match(/__person_(.+)$/);
        return match ? match[1] : undefined;
      };

      const extractOriginalPointId = (stopId: string): string => {
        if (!stopId) return stopId;
        const index = stopId.indexOf('__person_');
        return index > -1 ? stopId.substring(0, index) : stopId;
      };

      const MapConstructor = globalThis.Map || window.Map;
      const pointIdToPersonMap = new MapConstructor<string, string>();
      pickupPoints.forEach((point) => {
        if (point.person_id) {
          pointIdToPersonMap.set(point.id, point.person_id);
        }
      });

      // Insert new routes
      const routeInserts = [];
      const solution = solutions[0];
      if (!solution || !solution.vehicles || solution.vehicles.length === 0) {
        throw new Error("La primera solución no tiene vehículos disponibles");
      }
      
      const seenVehicles = new Set<string | null>();
      
      for (let vehicleIndex = 0; vehicleIndex < solution.vehicles.length; vehicleIndex++) {
        const vehicle = solution.vehicles[vehicleIndex];
        const originalVehicle = vehicles.find((v) => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
        const vehicleIdentifier = originalVehicle?.id || vehicle.id || `vehicle-${vehicleIndex}`;
        
        if (seenVehicles.has(vehicleIdentifier)) {
          continue;
        }
        
        seenVehicles.add(vehicleIdentifier);
        
        // Extract grupo from the original vehicle
        const vehicleGrupo = originalVehicle?.grupo || null;
        
        // Try to extract grupo from pickup points if not available from vehicle
        let routeGrupo = vehicleGrupo;
        if (!routeGrupo && vehicle.route) {
          // Find the first stop that matches a pickup point and get its grupo
          const extractOriginalPointId = (stopId: string): string => {
            if (!stopId) return stopId;
            const index = stopId.indexOf('__person_');
            return index > -1 ? stopId.substring(0, index) : stopId;
          };
          
          for (const routeStop of vehicle.route) {
            const stopId = routeStop.stop?.id;
            if (!stopId || stopId.includes("-start") || stopId.includes("-end")) continue;
            
            const originalPointId = extractOriginalPointId(stopId);
            const point = pickupPoints.find(p => p.id === originalPointId);
            if (point?.grupo) {
              routeGrupo = point.grupo;
              break; // Use the first grupo found
            }
          }
        }
        
        const routeData = {
          vehicle_id: originalVehicle?.id || null,
          route_data: vehicle,
          total_distance: vehicle.route_travel_distance || 0,
          total_duration: vehicle.route_travel_duration || vehicle.route_duration || 0,
          grupo: routeGrupo, // Include grupo from vehicle or pickup points
          nextmv_run_ids: [runId], // Store this Nextmv run ID
        };

        routeInserts.push(supabase.from("routes").insert(routeData).select());
      }

      await Promise.allSettled(routeInserts);
      
      // Reload routes from database
      const { data: reloadedRoutesData, error: reloadedRoutesError } = await supabase
        .from("routes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (reloadedRoutesError) {
        console.error("Error loading routes:", reloadedRoutesError);
      } else {
        const loadedRoutes = reloadedRoutesData || [];
        setRoutes(loadedRoutes);
        setVisibleRoutes(new Set(loadedRoutes.map((_, index) => index)));
      }
      
      toast({
        title: "Ejecución cargada",
        description: "Las rutas de la ejecución seleccionada se han cargado exitosamente",
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

  // Export functions (simplified versions)
  const handleExportToExcel = () => {
    if (!selectedRunData) {
      toast({
        title: "Error",
        description: "No hay datos de optimización para exportar",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Exportación",
      description: "Funcionalidad de exportación a Excel (implementar según necesidad)",
    });
  };

  const handleExportToKML = () => {
    if (!selectedRunData) {
      toast({
        title: "Error",
        description: "No hay datos de optimización para exportar",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Exportación",
      description: "Funcionalidad de exportación a KML (implementar según necesidad)",
    });
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
                            const totalDistance = route.total_distance || route.route_data?.route_travel_distance || 0;
                            const totalDuration = route.total_duration || route.route_data?.route_travel_duration || 0;
                            const distanceKm = totalDistance > 1000 ? (totalDistance / 1000).toFixed(2) : totalDistance.toFixed(2);
                            const distanceUnit = totalDistance > 1000 ? "km" : "m";
                            const durationMin = totalDuration > 60 ? (totalDuration / 60).toFixed(1) : totalDuration.toFixed(0);
                            const durationUnit = totalDuration > 60 ? "min" : "seg";
                            
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
                                        {vehicle?.name || `Ruta ${index + 1}`}
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
                          const vehicleName = vehicles.find(v => v.id === selectedRoute.vehicle_id)?.name || `Ruta ${selectedRouteIndex + 1}`;
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
                              
                              // NEW APPROACH: Find pickup_point by stop_id from database
                              // This is more reliable than extracting from encoded stop IDs
                              let point = pickupPoints.find(p => p.stop_id === stopId);
                              
                              // Fallback: if not found by stop_id, try original point ID extraction
                              if (!point) {
                              const originalPointId = extractOriginalPointId(stopId);
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
                              
                              // Get point name
                              let pointName: string;
                              if (isStartPoint) {
                                pointName = point?.name || "Punto de inicio";
                              } else {
                                pointName = point?.name || `Punto ${stopCounter}`;
                              }
                              
                              // Calculate stop index: start point is 0, others increment from 1
                              const stopIndex = isStartPoint ? 0 : stopCounter;
                              if (!isStartPoint) {
                                stopCounter++;
                              }
                              
                              return {
                                stopIndex: stopIndex,
                                isStartPoint: isStartPoint,
                                stopId: point?.id || originalPointId,
                                pointName: pointName,
                                personIds: Array.from(personIds),
                                location: routeStop.stop?.location,
                              };
                            })
                            .sort((a, b) => {
                              // Sort so start point (index 0) comes first, then others by index
                              if (a.isStartPoint) return -1;
                              if (b.isStartPoint) return 1;
                              return a.stopIndex - b.stopIndex;
                            });
                          
                          // Calculate route summary metrics
                          const actualStops = vehicleRoute.filter((routeStop: any) => {
                            const stopId = routeStop.stop?.id;
                            return stopId && !stopId.includes("-start") && !stopId.includes("-end");
                          }).length;
                          
                          const passengers = extractPassengersFromRoute(selectedRoute);
                          const passengerCount = passengers.length;
                          // Get vehicle capacity
                          const vehicle = vehicles.find(v => v.id === selectedRoute.vehicle_id);
                          const vehicleCapacity = vehicle?.capacity || 0;
                          
                          const totalDistance = selectedRoute.total_distance || selectedRoute.route_data?.route_travel_distance || 0;
                          const totalDuration = selectedRoute.total_duration || selectedRoute.route_data?.route_travel_duration || 0;
                          
                          const distanceKm = totalDistance > 1000 ? (totalDistance / 1000).toFixed(2) : totalDistance.toFixed(2);
                          const distanceUnit = totalDistance > 1000 ? "km" : "m";
                          const durationMin = totalDuration > 60 ? (totalDuration / 60).toFixed(1) : totalDuration.toFixed(0);
                          const durationUnit = totalDuration > 60 ? "min" : "seg";
                          
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
                                {stopsWithDetails.map((stop, idx) => (
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
                                        {stop.isStartPoint ? "S" : stop.stopIndex}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">
                                          {stop.pointName}
                                        </p>
                                      </div>
                                    </div>
                                    {stop.isStartPoint ? (
                                      <p className="text-xs text-muted-foreground italic ml-8">Punto de inicio - Sin pasajeros</p>
                                    ) : stop.personIds.length > 0 ? (
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

