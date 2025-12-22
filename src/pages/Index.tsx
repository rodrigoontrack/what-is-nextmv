import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Map from "@/components/Map";
import PickupPointForm from "@/components/PickupPointForm";
import VehicleConfig from "@/components/VehicleConfig";
import PickupPointsList from "@/components/PickupPointsList";
import { Play, MapPin, Truck, Route, MousePointerClick, ChevronDown, ChevronUp, Code, ArrowLeft, Plus, History, X, Upload, Trash2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  quantity?: number;
  person_id?: string;
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
}

const Index = () => {
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [clickMode, setClickMode] = useState(false);
  const [focusedPoint, setFocusedPoint] = useState<PickupPoint | null>(null);
  const [editingPickupPoint, setEditingPickupPoint] = useState<PickupPoint | null>(null);
  const [vehicleLocationMode, setVehicleLocationMode] = useState<"start" | "end" | null>(null);
  const [vehicleLocationCallback, setVehicleLocationCallback] = useState<((lon: number, lat: number) => void) | null>(null);
  const [currentVehicleStartLocation, setCurrentVehicleStartLocation] = useState<{ lon: number; lat: number } | null>(null);
  const [currentVehicleEndLocation, setCurrentVehicleEndLocation] = useState<{ lon: number; lat: number } | null>(null);
  const [nextmvJson, setNextmvJson] = useState<any>(null);
  const [nextmvEndpoint, setNextmvEndpoint] = useState<string | null>(null);
  const [showNextmvJson, setShowNextmvJson] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunData, setSelectedRunData] = useState<any | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isNewRunMode, setIsNewRunMode] = useState(false);
  const [isPickupPointDialogOpen, setIsPickupPointDialogOpen] = useState(false);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isPreviousRunsDialogOpen, setIsPreviousRunsDialogOpen] = useState(false);
  const [isDeleteAllPointsDialogOpen, setIsDeleteAllPointsDialogOpen] = useState(false);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<number>>(new Set());
  const [generalStartTime, setGeneralStartTime] = useState<string>("08:00");
  const { toast } = useToast();

  // Helper function to get valid route count (routes with duration > 0, one per vehicle)
  const getValidRouteCount = useMemo(() => {
    // Filter routes: only count routes with duration > 0
    const validRoutes = routes.filter(route => {
      const duration = route.route_data?.route_travel_duration || route.route_data?.route_duration || route.total_duration || 0;
      return duration > 0;
    });
    
    // Group by vehicle_id and keep only one route per vehicle
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

  useEffect(() => {
    loadPickupPoints();
    loadVehicles();
    loadRuns();
  }, []);

  const loadRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const NEXTMV_APPLICATION_ID = "workspace-dgxjzzgctd";
      const NEXTMV_API_KEY = import.meta.env.VITE_NEXTMV_API_KEY || "nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230";
      
      const runsUrl = `https://api.cloud.nextmv.io/v1/applications/${NEXTMV_APPLICATION_ID}/runs`;
      const runsApiUrl = import.meta.env.DEV ? `/api/nextmv/v1/applications/${NEXTMV_APPLICATION_ID}/runs` : runsUrl;
      
      const response = await fetch(runsApiUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${NEXTMV_API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load runs: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      // Handle both array and object with runs property
      const runsList = Array.isArray(data) ? data : (data.runs || data.items || []);
      
      // Sort by created_at descending (newest first)
      const sortedRuns = runsList.sort((a: any, b: any) => {
        const dateA = new Date(a.metadata?.created_at || a.created_at || 0).getTime();
        const dateB = new Date(b.metadata?.created_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      
      setRuns(sortedRuns);
      console.log("Loaded runs:", sortedRuns);
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
    setIsNewRunMode(false);
    setIsOptimizing(true);
    
    try {
      const NEXTMV_APPLICATION_ID = "workspace-dgxjzzgctd";
      const NEXTMV_API_KEY = import.meta.env.VITE_NEXTMV_API_KEY || "nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230";
      
      const runUrl = `https://api.cloud.nextmv.io/v1/applications/${NEXTMV_APPLICATION_ID}/runs/${runId}`;
      const runApiUrl = import.meta.env.DEV ? `/api/nextmv/v1/applications/${NEXTMV_APPLICATION_ID}/runs/${runId}` : runUrl;
      
      const response = await fetch(runApiUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${NEXTMV_API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load run: ${response.status} ${response.statusText}`);
      }
      
      const runData = await response.json();
      console.log("Loaded run data:", runData);
      
      // Store the run data for display
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
      
      // Helper function to extract person_id from encoded stop ID
      // Format: {point.id}__person_{person_id} or just {point.id}
      const extractPersonIdFromStopId = (stopId: string): string | undefined => {
        if (!stopId) return undefined;
        const match = stopId.match(/__person_(.+)$/);
        return match ? match[1] : undefined;
      };

      // Helper function to extract original point ID from encoded stop ID
      const extractOriginalPointId = (stopId: string): string => {
        if (!stopId) return stopId;
        const index = stopId.indexOf('__person_');
        return index > -1 ? stopId.substring(0, index) : stopId;
      };

        // Create mapping of original point IDs to person_ids for fallback
        // Use global Map constructor explicitly to avoid conflict with Map component import
        const MapConstructor = globalThis.Map || window.Map;
        const pointIdToPersonMap = new MapConstructor<string, string>();
      pickupPoints.forEach((point) => {
        if (point.person_id) {
          pointIdToPersonMap.set(point.id, point.person_id);
        }
      });

      // Insert new routes - use only the FIRST solution and filter to one route per vehicle
      const routeInserts = [];
      let totalExpectedRoutes = 0;
      
      console.log(`Processing ${solutions.length} solution(s) from run data, using first solution only`);
      
      // Use only the first solution (solutions[0])
      const solution = solutions[0];
      if (!solution || !solution.vehicles || solution.vehicles.length === 0) {
        throw new Error("La primera solución no tiene vehículos disponibles");
      }
      
      const vehicleCount = (solution.vehicles || []).length;
      console.log(`Processing ${vehicleCount} vehicle(s) from first solution`);
      
      // Track seen vehicles to ensure only one route per vehicle
      const seenVehicles = new Set<string | null>();
      
      // Process vehicles from first solution, filtering to one per vehicle
      for (let vehicleIndex = 0; vehicleIndex < solution.vehicles.length; vehicleIndex++) {
        const vehicle = solution.vehicles[vehicleIndex];
        
        // Find the original vehicle to get its database ID - this ensures we use the correct vehicle_id
        const originalVehicle = vehicles.find((v) => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
        // Use the database vehicle_id or create a unique identifier from vehicle.id or index
        const vehicleIdentifier = originalVehicle?.id || vehicle.id || `vehicle-${vehicleIndex}`;
        
        // Skip if we've already processed a route for this vehicle
        if (seenVehicles.has(vehicleIdentifier)) {
          console.log(`Skipping duplicate vehicle ${vehicleIdentifier} (already processed)`);
          continue;
        }
        
        // Mark this vehicle as seen
        seenVehicles.add(vehicleIdentifier);
        totalExpectedRoutes++;
          
          // Extract person assignments from route stops
          const personAssignments: string[] = [];
          if (vehicle.route) {
            vehicle.route.forEach((routeStop: any) => {
              const stopId = routeStop.stop?.id;
              if (!stopId) return;
              
              // Extract person_id from encoded stop ID
              let personId = extractPersonIdFromStopId(stopId);
              
              // Fallback: try to get from original point ID mapping
              if (!personId) {
                const originalPointId = extractOriginalPointId(stopId);
                personId = pointIdToPersonMap.get(originalPointId);
              }
              
              if (personId) {
                personAssignments.push(personId);
              }
            });
          }
          
          const routeData = {
            vehicle_id: originalVehicle?.id || null,
            route_data: vehicle,
            total_distance: vehicle.route_travel_distance || 0,
            total_duration: vehicle.route_travel_duration || vehicle.route_duration || 0,
            // Note: person_assignments column doesn't exist in the routes table
            // If needed, this data can be stored in route_data JSON field
          };

          // Add error handling to each insert to see what's failing
          routeInserts.push(
            supabase.from("routes").insert(routeData).select().then(result => {
              if (result.error) {
                console.error(`Error inserting route for vehicle ${vehicle.id || vehicleIndex} (solution ${solutionIndex}):`, {
                  message: result.error.message,
                  details: result.error.details,
                  hint: result.error.hint,
                  code: result.error.code,
                  routeDataSize: JSON.stringify(routeData).length,
                  stopsCount: vehicle.route?.length || 0
                });
              }
              return result;
            }).catch(err => {
              console.error(`Exception inserting route for vehicle ${vehicle.id || vehicleIndex}:`, err);
              return { data: null, error: err };
            })
          );
      }

      // Execute all inserts and capture errors
      const insertResults = await Promise.allSettled(routeInserts);
      const errors: any[] = [];
      const successes: any[] = [];
      
      insertResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Route insert ${index} failed with rejection:`, result.reason);
          const errorInfo = result.reason instanceof Error 
            ? { message: result.reason.message, stack: result.reason.stack, name: result.reason.name }
            : result.reason;
          errors.push({ index, error: errorInfo });
        } else {
          const { data, error } = result.value;
          if (error) {
            console.error(`Route insert ${index} failed:`, error);
            // Extract error details in a serializable way
            const errorInfo = {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
              ...(error.response && {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
              })
            };
            errors.push({ index, error: errorInfo });
          } else {
            successes.push({ index, data });
          }
        }
      });
      
      console.log(`Route inserts: ${successes.length} successful, ${errors.length} failed`);
      if (errors.length > 0) {
        console.error('Failed route inserts:', errors);
        // Log first error details to understand what's wrong
        if (errors[0]?.error) {
          console.error('First error details:', errors[0].error);
          // Try to stringify, but handle non-serializable properties
          try {
            console.error('First error details (JSON):', JSON.stringify(errors[0].error, null, 2));
          } catch (e) {
            console.error('Could not stringify error:', e);
          }
        }
      }
      
      // Reload routes from database - load all routes that were just inserted
      // Use the actual number of routes from all solutions, or a reasonable limit
      const expectedRoutes = totalExpectedRoutes;
      const routesToLoad = Math.max(expectedRoutes, vehicles.length, 100); // Higher limit to ensure all routes are loaded
      const { data: routesData, error: routesError } = await supabase
        .from("routes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(routesToLoad);
      
      console.log(`Loading routes: Expected ${expectedRoutes}, Loading up to ${routesToLoad}, Got ${routesData?.length || 0}`);

      if (routesError) {
        console.error("Error loading routes:", routesError);
      } else {
        const loadedRoutes = routesData || [];
        console.log(`Setting ${loadedRoutes.length} routes. Route data:`, loadedRoutes.map(r => ({ id: r.id, vehicle_id: r.vehicle_id, has_route_data: !!r.route_data })));
        setRoutes(loadedRoutes);
        // Initialize all routes as visible
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

  const handleNewRun = () => {
    setIsNewRunMode(true);
    setSelectedRunId(null);
    setSelectedRunData(null);
    setRoutes([]);
    setVisibleRoutes(new Set());
    // Clear routes from database
    supabase
      .from("routes")
      .delete()
      .gte("created_at", "1970-01-01")
      .then(() => {
        console.log("Cleared routes for new run");
      });
  };

  // Convert hex color to KML ABGR format (Alpha, Blue, Green, Red)
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
    if (!selectedRunData) {
      toast({
        title: "Error",
        description: "No hay datos de optimización para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      const solutions = selectedRunData.output?.solutions || selectedRunData.solutions || [];
      
      if (solutions.length === 0) {
        toast({
          title: "Error",
          description: "No hay soluciones disponibles para exportar",
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
      let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Optimización de Rutas - ${selectedRunId || 'N/A'}</name>
    <description>Rutas generadas por NextMV con rutas de Mapbox</description>
`;

      // Add styles for each vehicle route
      let globalRouteIndex = 0;
      solutions.forEach((solution: any, solutionIndex: number) => {
        const vehicles = solution.vehicles || [];
        vehicles.forEach((vehicle: any, vehicleIndex: number) => {
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
        const vehicles = solution.vehicles || [];
        
        vehicles.forEach((vehicle: any, vehicleIndex: number) => {
          const route = vehicle.route || [];
          
          if (route.length >= 2) {
            // Build waypoints for Mapbox Directions API
            const coordinates: number[][] = [];
            route.forEach((routeStop: any) => {
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

      // Helper functions to extract person_id (same as Excel export)
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
          // Find the vehicle in the vehicles array to get the plate (name)
          const vehicleInfo = vehicles.find(v => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
          const vehiclePlate = vehicleInfo?.name || vehicle.id || `Vehículo ${vehicleIndex + 1}`;
          
          const route = vehicle.route || [];
          const routeInfo = routeData.find(r => r.solutionIndex === solutionIndex && r.vehicleIndex === vehicleIndex);
          const styleId = `route-${solutionIndex}-${vehicleIndex}`;
          
          // Debug: Log route info
          console.log(`Processing vehicle ${vehicle.id || vehicleIndex} (solution ${solutionIndex}, vehicle ${vehicleIndex}):`, {
            hasRouteInfo: !!routeInfo,
            hasGeometry: !!(routeInfo?.geometry),
            coordCount: routeInfo?.geometry?.coordinates?.length || 0,
            geometryType: routeInfo?.geometry?.type
          });
          
          // Create folder for this vehicle route with plate
          kml += `    <Folder>
      <name>${vehiclePlate} - Solución ${solutionIndex + 1}</name>
      <description>Ruta del vehículo ${vehiclePlate} (ID: ${vehicle.id || vehicleIndex + 1})</description>
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
        <name>Ruta ${vehiclePlate}</name>
        <description>Ruta completa del vehículo ${vehiclePlate} (generada por Mapbox - ${geoJsonCoords.length} puntos)</description>
        <styleUrl>#${styleId}</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>${kmlCoordinates}</coordinates>
        </LineString>
      </Placemark>
`;
          } else {
            console.warn(`No Mapbox geometry for vehicle ${vehicle.id || vehicleIndex}, routeInfo:`, routeInfo);
            if (route.length > 0) {
              // Fallback: use stop coordinates if Mapbox route not available
              const coordinates: string[] = [];
              route.forEach((routeStop: any) => {
                const location = routeStop.stop?.location;
                if (location && location.lat && location.lon) {
                  coordinates.push(`${location.lon},${location.lat},0`);
                }
              });

              if (coordinates.length > 0) {
                kml += `      <Placemark>
        <name>Ruta ${vehiclePlate}</name>
        <description>Ruta completa del vehículo ${vehiclePlate} (línea recta - Mapbox no disponible)</description>
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
          if (route && route.length > 0) {
            console.log(`Creating ${route.length} stop placemarks for vehicle ${vehicle.id || vehicleIndex}`);
            route.forEach((routeStop: any, stopIndex: number) => {
              const stop = routeStop.stop || {};
              const location = stop.location;
              
              if (location && location.lat && location.lon) {
                // Extract all person_ids from the original point (not just the one in stop ID)
                // Stop ID only contains the first person_id, but the original point may have multiple (comma-separated)
                let personIds = "";
                const originalPointId = extractOriginalPointId(stop.id || '');
                const originalPoint = pickupPoints.find(p => p.id === originalPointId);
                
                if (originalPoint?.person_id) {
                  // Use all person_ids from the original point (may be comma-separated)
                  personIds = originalPoint.person_id;
                } else {
                  // Fallback: try to extract from stop ID (only the first one)
                  const personIdFromStopId = extractPersonIdFromStopId(stop.id || '');
                  if (personIdFromStopId) {
                    personIds = personIdFromStopId;
                  } else {
                    // Final fallback: check the map
                    const personIdFromMap = pointIdToPersonMapForKML.get(originalPointId);
                    if (personIdFromMap) {
                      personIds = personIdFromMap;
                    }
                  }
                }
                
                const stopType = stop.type || (stopIndex === 0 ? "Inicio" : stopIndex === route.length - 1 ? "Fin" : "Parada");
                const stopName = `${vehiclePlate} - ${stopIndex + 1}`;
                let stopDescription = `Tipo: ${stopType}\nOrden en ruta: ${stopIndex + 1}\nVehículo: ${vehiclePlate}`;
                if (personIds) {
                  // Show all person IDs (comma-separated if multiple)
                  stopDescription += `\nID Persona(s): ${personIds}`;
                }
                
                // Use different icons for start/end/stops
                let iconUrl = "http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png";
                if (stopIndex === 0) {
                  iconUrl = "http://maps.google.com/mapfiles/kml/shapes/arrow.png"; // Start
                } else if (stopIndex === route.length - 1) {
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
      const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `optimizacion_${selectedRunId || timestamp}_${timestamp}.kml`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportación exitosa",
        description: `Archivo KML ${filename} descargado correctamente`,
      });
    } catch (error) {
      console.error("Error exporting to KML:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo exportar el archivo KML",
        variant: "destructive",
      });
    }
  };

  const handleExportToExcel = () => {
    if (!selectedRunData) {
      toast({
        title: "Error",
        description: "No hay datos de optimización para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      const solutions = selectedRunData.output?.solutions || selectedRunData.solutions || [];
      
      if (solutions.length === 0) {
        toast({
          title: "Error",
          description: "No hay soluciones disponibles para exportar",
          variant: "destructive",
        });
        return;
      }

      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // ===== SUMMARY SHEET =====
      let totalVehicles = 0;
      let totalDistance = 0;
      let totalDuration = 0;
      let totalStops = 0;

      const summaryData: any[] = [
        ["Resumen de Optimización"],
        [],
        ["ID de Ejecución", selectedRunId || "N/A"],
        ["Fecha", selectedRunData.metadata?.created_at || selectedRunData.created_at 
          ? new Date(selectedRunData.metadata?.created_at || selectedRunData.created_at).toLocaleString('es-ES')
          : "N/A"],
        ["Estado", selectedRunData.metadata?.status || selectedRunData.status || "N/A"],
        [],
        ["Estadísticas"],
      ];

      // Process all solutions
      solutions.forEach((solution: any, solutionIndex: number) => {
        const vehicles = solution.vehicles || [];
        totalVehicles += vehicles.length;

        vehicles.forEach((vehicle: any) => {
          const distance = vehicle.route_travel_distance || vehicle.route_distance || 0;
          const duration = vehicle.route_travel_duration || vehicle.route_duration || 0;
          const stops = vehicle.route || [];
          
          totalDistance += typeof distance === 'string' ? parseFloat(distance) : distance;
          totalDuration += typeof duration === 'string' ? parseFloat(duration) : duration;
          totalStops += stops.length;
        });
      });

      summaryData.push(
        ["Total de Soluciones", solutions.length],
        ["Total de Vehículos", totalVehicles],
        ["Total de Paradas", totalStops],
        ["Distancia Total (km)", (totalDistance / 1000).toFixed(2)],
        ["Duración Total (minutos)", (totalDuration / 60).toFixed(2)],
      );

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

      // Helper function to extract person_id from encoded stop ID (same as used elsewhere)
      const extractPersonIdFromStopId = (stopId: string): string | undefined => {
        if (!stopId) return undefined;
        const match = stopId.match(/__person_(.+)$/);
        return match ? match[1] : undefined;
      };
      
      // Create mapping of original point IDs to person_ids for fallback
      const MapConstructor = globalThis.Map || window.Map;
      const pointIdToPersonMap = new MapConstructor<string, string>();
      pickupPoints.forEach((point) => {
        if (point.person_id) {
          pointIdToPersonMap.set(point.id, point.person_id);
        }
      });
      
      // Helper function to extract original point ID from encoded stop ID
      const extractOriginalPointId = (stopId: string): string => {
        if (!stopId) return stopId;
        const index = stopId.indexOf('__person_');
        return index > -1 ? stopId.substring(0, index) : stopId;
      };

      // Helper function to calculate arrival time
      const calculateArrivalTime = (startTime: string, durationMinutes: number): string => {
        try {
          const [hours, minutes] = startTime.split(':').map(Number);
          const startDate = new Date();
          startDate.setHours(hours, minutes, 0, 0);
          
          // Add duration in minutes
          const arrivalDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
          
          // Format as HH:MM
          const arrivalHours = arrivalDate.getHours().toString().padStart(2, '0');
          const arrivalMinutes = arrivalDate.getMinutes().toString().padStart(2, '0');
          return `${arrivalHours}:${arrivalMinutes}`;
        } catch (error) {
          console.error("Error calculating arrival time:", error);
          return "";
        }
      };

      // ===== ROUTES SHEET =====
      const routesData: any[] = [
        ["Solución", "Vehículo ID", "Placa", "Orden en Ruta", "Stop ID", "ID Persona", "Tipo", "Latitud", "Longitud", 
         "Distancia Acumulada (km)", "Duración Acumulada (min)", "Hora de Llegada", "Distancia al Siguiente (km)", "Duración al Siguiente (min)"]
      ];

      solutions.forEach((solution: any, solutionIndex: number) => {
        const solutionVehicles = solution.vehicles || [];
        
        solutionVehicles.forEach((vehicle: any) => {
          // Find the vehicle in the vehicles array to get the plate (name)
          const vehicleInfo = vehicles.find(v => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
          const vehiclePlate = vehicleInfo?.name || vehicle.id || "N/A";
          
          const route = vehicle.route || [];
          let accumulatedDistance = 0;
          let accumulatedDuration = 0;

          route.forEach((routeStop: any, stopIndex: number) => {
            const stop = routeStop.stop || {};
            const location = stop.location || {};
            
            // Extract all person_ids from the original point
            // Stop ID only contains the first person_id, but the original point may have multiple (comma-separated)
            let personIds = "";
            const originalPointId = extractOriginalPointId(stop.id || '');
            const originalPoint = pickupPoints.find(p => p.id === originalPointId);
            
            if (originalPoint?.person_id) {
              // Use all person_ids from the original point (may be comma-separated)
              personIds = originalPoint.person_id;
            } else {
              // Fallback: try to extract from stop ID (only the first one)
              const personIdFromStopId = extractPersonIdFromStopId(stop.id || '');
              if (personIdFromStopId) {
                personIds = personIdFromStopId;
              } else {
                // Final fallback: check the map
                const personIdFromMap = pointIdToPersonMap.get(originalPointId);
                if (personIdFromMap) {
                  personIds = personIdFromMap;
                }
              }
            }
            
            // Calculate distances/durations for the leg to this stop
            const distance = routeStop.distance || routeStop.travel_distance || 0;
            const duration = routeStop.duration || routeStop.travel_duration || 0;
            const nextDistance = route[stopIndex + 1]?.distance || route[stopIndex + 1]?.travel_distance || 0;
            const nextDuration = route[stopIndex + 1]?.duration || route[stopIndex + 1]?.travel_duration || 0;

            const distanceNum = typeof distance === 'string' ? parseFloat(distance) || 0 : (distance || 0);
            const durationNum = typeof duration === 'string' ? parseFloat(duration) || 0 : (duration || 0);
            
            // Accumulate distance/duration to show total traveled to reach this stop
            accumulatedDistance += isNaN(distanceNum) ? 0 : distanceNum;
            accumulatedDuration += isNaN(durationNum) ? 0 : durationNum;

            const stopType = stop.type || (stopIndex === 0 ? "Inicio" : stopIndex === route.length - 1 ? "Fin" : "Parada");
            
            const nextDistanceNum = typeof nextDistance === 'string' ? (parseFloat(nextDistance) || 0) : (nextDistance || 0);
            const nextDurationNum = typeof nextDuration === 'string' ? (parseFloat(nextDuration) || 0) : (nextDuration || 0);
            
            // Calculate arrival time based on general start time and accumulated duration
            const arrivalTime = calculateArrivalTime(generalStartTime, accumulatedDuration / 60);
            
            routesData.push([
              solutionIndex + 1,
              vehicle.id || "N/A",
              vehiclePlate,
              stopIndex + 1,
              stop.id || "N/A",
              personIds || "", // All person IDs (comma-separated if multiple)
              stopType,
              location.lat || "",
              location.lon || "",
              (accumulatedDistance / 1000).toFixed(3),
              (accumulatedDuration / 60).toFixed(2),
              arrivalTime,
              nextDistanceNum > 0 ? (nextDistanceNum / 1000).toFixed(3) : "",
              nextDurationNum > 0 ? (nextDurationNum / 60).toFixed(2) : "",
            ]);
          });

          // Add vehicle summary row
          const vehicleDistance = vehicle.route_travel_distance || vehicle.route_distance || 0;
          const vehicleDuration = vehicle.route_travel_duration || vehicle.route_duration || 0;
          routesData.push([
            solutionIndex + 1,
            vehicle.id || "N/A",
            vehiclePlate,
            "TOTAL",
            "",
            "",
            `Total Vehículo: ${vehiclePlate}`,
            "",
            "",
            ((typeof vehicleDistance === 'string' ? parseFloat(vehicleDistance) : vehicleDistance) / 1000).toFixed(3),
            ((typeof vehicleDuration === 'string' ? parseFloat(vehicleDuration) : vehicleDuration) / 60).toFixed(2),
            "", // Empty arrival time for summary row
            "",
            "",
          ]);
          routesData.push([]); // Empty row for separation
        });
      });

      const routesSheet = XLSX.utils.aoa_to_sheet(routesData);
      XLSX.utils.book_append_sheet(workbook, routesSheet, "Rutas Detalladas");

      // ===== VEHICLES SUMMARY SHEET =====
      const vehiclesData: any[] = [
        ["Solución", "Vehículo ID", "Placa", "Número de Paradas", "Distancia Total (km)", "Duración Total (min)", 
         "Distancia Promedio por Parada (km)", "Duración Promedio por Parada (min)"]
      ];

      solutions.forEach((solution: any, solutionIndex: number) => {
        const solutionVehicles = solution.vehicles || [];
        
        solutionVehicles.forEach((vehicle: any) => {
          // Find the vehicle in the vehicles array to get the plate (name)
          const vehicleInfo = vehicles.find(v => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
          const vehiclePlate = vehicleInfo?.name || vehicle.id || "N/A";
          
          const route = vehicle.route || [];
          const numStops = route.length;
          const distance = vehicle.route_travel_distance || vehicle.route_distance || 0;
          const duration = vehicle.route_travel_duration || vehicle.route_duration || 0;
          
          const distanceNum = typeof distance === 'string' ? parseFloat(distance) : distance;
          const durationNum = typeof duration === 'string' ? parseFloat(duration) : duration;
          
          vehiclesData.push([
            solutionIndex + 1,
            vehicle.id || "N/A",
            vehiclePlate,
            numStops,
            (distanceNum / 1000).toFixed(3),
            (durationNum / 60).toFixed(2),
            numStops > 0 ? (distanceNum / 1000 / numStops).toFixed(3) : 0,
            numStops > 0 ? (durationNum / 60 / numStops).toFixed(2) : 0,
          ]);
        });
      });

      const vehiclesSheet = XLSX.utils.aoa_to_sheet(vehiclesData);
      XLSX.utils.book_append_sheet(workbook, vehiclesSheet, "Resumen Vehículos");

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `optimizacion_${selectedRunId || timestamp}_${timestamp}.xlsx`;

      // Write the file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Exportación exitosa",
        description: `Archivo ${filename} descargado correctamente`,
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo exportar el archivo Excel",
        variant: "destructive",
      });
    }
  };

  const loadPickupPoints = async () => {
    // Try localStorage first (works without Supabase)
    try {
      const stored = localStorage.getItem('pickup_points');
      if (stored) {
        const data = JSON.parse(stored);
        const normalizedData = (data || []).map((point: any) => ({
          ...point,
          quantity: point.quantity != null && !isNaN(point.quantity) ? Number(point.quantity) : 1,
        }));
        console.log("=== PUNTOS CARGADOS DESDE LOCALSTORAGE ===");
        console.log(`Total puntos cargados: ${normalizedData.length}`);
        const pointsWithQty = normalizedData.filter(p => p.quantity > 1);
        console.log(`Puntos con cantidad > 1: ${pointsWithQty.length}`);
        
        if (pointsWithQty.length > 0) {
          console.log("Ejemplos de puntos con cantidad > 1:", pointsWithQty.slice(0, 5).map(p => ({
            name: p.name,
            lat: p.latitude,
            lon: p.longitude,
            quantity: p.quantity
          })));
        }
        
        setPickupPoints(normalizedData);
        return;
      }
    } catch (error) {
      console.warn("Error loading from localStorage, trying Supabase:", error);
    }

    // Fallback to Supabase if available
    try {
    const { data, error } = await supabase.from("pickup_points").select("*");
    if (error) {
      console.error("Error loading pickup points:", error);
      return;
    }
      
      // Check if quantity column exists by checking if any point has the quantity property
      const hasQuantityColumn = data && data.length > 0 && data.some((p: any) => 'quantity' in p);
      
      if (!hasQuantityColumn && data && data.length > 0) {
        console.warn("⚠️ ADVERTENCIA: La columna 'quantity' no existe en la base de datos");
        console.warn("Los puntos se mostrarán con cantidad = 1 por defecto");
        console.warn("Ejecuta este SQL en Supabase para agregar la columna:");
        console.warn(`
ALTER TABLE public.pickup_points
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
        `);
      }
      
      // Normalize quantity field - preserve the actual quantity value from database
      // Only default to 1 if truly null/undefined, but keep the actual consolidated count
    const normalizedData = (data || []).map((point: any) => ({
      ...point,
        quantity: point.quantity != null && !isNaN(point.quantity) ? Number(point.quantity) : 1,
      }));
      
      console.log("=== PUNTOS CARGADOS DESDE BD ===");
      console.log(`Total puntos cargados: ${normalizedData.length}`);
      const pointsWithQty = normalizedData.filter(p => p.quantity > 1);
      console.log(`Puntos con cantidad > 1: ${pointsWithQty.length}`);
      
      // Check specifically for the point the user mentioned
      const userPoint = normalizedData.find(p => 
        String(p.latitude) === '4.723551' && String(p.longitude) === '-74.092143'
      );
      if (userPoint) {
        console.log("🔍 PUNTO ESPECÍFICO DEL USUARIO EN CARGADOS:", {
          id: userPoint.id,
          name: userPoint.name,
          lat: userPoint.latitude,
          lon: userPoint.longitude,
          quantity: userPoint.quantity,
          quantityType: typeof userPoint.quantity
        });
      } else {
        console.warn("⚠️ PUNTO ESPECÍFICO DEL USUARIO NO ENCONTRADO EN CARGADOS");
      }
      
      if (pointsWithQty.length > 0) {
        console.log("Ejemplos de puntos con cantidad > 1:", pointsWithQty.slice(0, 5).map(p => ({
          name: p.name,
          lat: p.latitude,
          lon: p.longitude,
          quantity: p.quantity
        })));
      } else {
        console.warn("⚠️ ADVERTENCIA: Ningún punto cargado tiene cantidad > 1");
        console.log("Muestra de primeros 5 puntos:", normalizedData.slice(0, 5).map(p => ({
          name: p.name,
          quantity: p.quantity
        })));
      }
      
    setPickupPoints(normalizedData);
    } catch (supabaseError) {
      console.warn("Supabase not available, using localStorage only:", supabaseError);
    }
  };

  const loadVehicles = async () => {
    const { data, error } = await supabase.from("vehicles").select("*");
    if (error) {
      console.error("Error loading vehicles:", error);
      return;
    }
    setVehicles(data || []);
  };

  // Helper function to save points to localStorage
  const savePointsToLocalStorage = (points: PickupPoint[]) => {
    try {
      localStorage.setItem('pickup_points', JSON.stringify(points));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  };

  const handleAddPickupPoint = async (point: Omit<PickupPoint, "id"> & { id?: string }) => {
    if (editingPickupPoint) {
      // Update existing point
      const { id, ...updateData } = point;
      const quantity = updateData.quantity != null && !isNaN(updateData.quantity) 
        ? Math.max(1, Math.floor(updateData.quantity)) 
        : 1;
      
      const updatedPoint: PickupPoint = {
        ...editingPickupPoint,
        name: updateData.name,
        address: updateData.address,
        latitude: updateData.latitude,
        longitude: updateData.longitude,
        quantity: quantity,
        person_id: updateData.person_id,
      };

      // Update in localStorage
      const updatedPoints = pickupPoints.map((p) => (p.id === editingPickupPoint.id ? updatedPoint : p));
      setPickupPoints(updatedPoints);
      savePointsToLocalStorage(updatedPoints);
      
      // Try Supabase if available (optional)
      try {
        await supabase
          .from("pickup_points")
          .update({
            name: updateData.name,
            address: updateData.address,
            latitude: updateData.latitude,
            longitude: updateData.longitude,
            quantity: quantity,
            person_id: updateData.person_id,
          })
          .eq("id", editingPickupPoint.id);
      } catch (error) {
        console.warn("Supabase update failed (using localStorage):", error);
      }

        setEditingPickupPoint(null);
        setIsPickupPointDialogOpen(false);
    } else {
      // Insert new point
      const { id, ...insertData } = point;
      const quantity = insertData.quantity !== undefined && insertData.quantity !== null 
        ? Math.max(1, Math.floor(insertData.quantity)) 
        : 1;
      
      const newPoint: PickupPoint = {
        id: `local-${Date.now()}-${Math.random()}`,
        name: insertData.name,
        address: insertData.address || `${insertData.latitude}, ${insertData.longitude}`,
        latitude: insertData.latitude,
        longitude: insertData.longitude,
        quantity: quantity,
        person_id: insertData.person_id,
      };

      // Add to localStorage
      const updatedPoints = [...pickupPoints, newPoint];
      setPickupPoints(updatedPoints);
      savePointsToLocalStorage(updatedPoints);
      
      // Try Supabase if available (optional)
      try {
        await supabase
          .from("pickup_points")
          .insert([{
            name: insertData.name,
            address: insertData.address || `${insertData.latitude}, ${insertData.longitude}`,
            latitude: insertData.latitude,
            longitude: insertData.longitude,
            quantity: quantity,
            person_id: insertData.person_id,
          }]);
      } catch (error) {
        console.warn("Supabase insert failed (using localStorage):", error);
      }

        setIsPickupPointDialogOpen(false);
    }
  };

  const handleEditPickupPoint = (point: PickupPoint) => {
    setEditingPickupPoint(point);
    setIsPickupPointDialogOpen(true);
  };

  const handleCancelEditPickupPoint = () => {
    setEditingPickupPoint(null);
    setIsPickupPointDialogOpen(false);
  };

  const handleDeleteAllPickupPoints = async () => {
    if (pickupPoints.length === 0) {
      toast({
        title: "Info",
        description: "No hay puntos para eliminar",
      });
      setIsDeleteAllPointsDialogOpen(false);
      return;
    }

    try {
      // Delete from localStorage first
      localStorage.removeItem('pickup_points');
      
      // Try Supabase if available
      try {
        const { error } = await supabase
          .from("pickup_points")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

        if (error) {
          console.warn("Error deleting from Supabase (may not be available):", error);
        }

        // Also clear routes since they depend on pickup points
        await supabase
          .from("routes")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (supabaseError) {
        console.warn("Supabase not available, using localStorage only:", supabaseError);
      }

      // Clear the state
      setPickupPoints([]);
      setRoutes([]);
      setVisibleRoutes(new Set());
      setIsDeleteAllPointsDialogOpen(false);

      toast({
        title: "Puntos eliminados",
        description: `Se eliminaron ${pickupPoints.length} puntos de recogida exitosamente`,
      });
    } catch (error) {
      console.error("Error deleting all pickup points:", error);
      setIsDeleteAllPointsDialogOpen(false);
      toast({
        title: "Error",
        description: `No se pudieron eliminar los puntos: ${error instanceof Error ? error.message : "Error desconocido"}`,
        variant: "destructive",
      });
    }
  };

  const handleExcelUpload = async (file: File) => {
    try {
      // First, delete all existing pickup points
      const { error: deleteError } = await supabase
        .from("pickup_points")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all (using a condition that always matches)
      
      if (deleteError) {
        console.error("Error deleting existing points:", deleteError);
        // Continue anyway, might be empty table
      } else {
        console.log("Puntos existentes eliminados");
        // Clear the state
        setPickupPoints([]);
      }

      // Dynamically import xlsx library
      // @ts-ignore - xlsx types may not be available until package is installed
      const XLSX = await import("xlsx").catch(() => {
        throw new Error("xlsx module not found. Please install it: npm install xlsx");
      });
      
      // Read the file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        toast({
          title: "Error",
          description: "El archivo Excel está vacío o no tiene formato válido",
          variant: "destructive",
        });
        return;
      }

      // Group points by latitude and longitude, summing quantities
      interface PointData {
        latitude: number;
        longitude: number;
        quantity: number;
        person_id?: string; // Store person_id(s) - comma-separated if multiple
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pointMap: any = {};
      
      // First, try to detect column names from the first row
      const firstRow = jsonData[0] as Record<string, any>;
      const allKeys = Object.keys(firstRow);
      
      // More flexible column name detection (case-insensitive, handles variations and Spanish)
      const latitudeKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "latitude" || normalized === "lat" || 
                 normalized === "latitud" || normalized.includes("lat");
        }
      );
      const longitudeKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "longitude" || normalized === "lon" || 
                 normalized === "lng" || normalized === "longitud" || 
                 normalized.includes("lon") || normalized.includes("lng");
        }
      );
      const quantityKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "quantity" || normalized === "cantidad" || 
                 normalized === "qty" || normalized === "q" ||
                 normalized.includes("cantidad") || normalized.includes("quantity");
        }
      );
      const personIdKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "persona id" || normalized === "persona_id" || 
                 normalized === "person id" || normalized === "person_id" ||
                 normalized === "id persona" || normalized === "id_persona" ||
                 normalized.includes("persona") && normalized.includes("id");
        }
      );
        
        if (!latitudeKey || !longitudeKey) {
        toast({
          title: "Error",
          description: `No se encontraron columnas de coordenadas. Buscando: "latitud/latitude" y "longitud/longitude". Columnas encontradas: ${allKeys.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      console.log("Columnas detectadas:", { latitudeKey, longitudeKey, quantityKey: quantityKey || "no encontrada", personIdKey: personIdKey || "no encontrada" });
      console.log(`Total de filas en Excel: ${jsonData.length}`);

      // STEP 1: Read and process ALL rows first, counting occurrences
      let processedRows = 0;
      let skippedRows = 0;
      
      // Map to track occurrences: key -> { lat, lon, count, occurrences, person_ids }
      const occurrenceMap: Record<string, {
        latitude: number;
        longitude: number;
        count: number; // Number of times this coordinate appears
        occurrences: number[]; // Track each occurrence for debugging
        person_ids: string[]; // Track person IDs at this location
      }> = {};
      
      for (const row of jsonData) {
        const rowData = row as Record<string, any>;
        
        const lat = parseFloat(rowData[latitudeKey]);
        const lon = parseFloat(rowData[longitudeKey]);
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lon)) {
          console.warn("Invalid coordinates in row:", rowData);
          skippedRows++;
          continue;
        }
        
        // Validate latitude range (-90 to 90)
        if (lat < -90 || lat > 90) {
          console.warn(`Latitude out of range: ${lat}, skipping row:`, rowData);
          skippedRows++;
          continue;
        }
        
        // Validate longitude range (-180 to 180)
        if (lon < -180 || lon > 180) {
          console.warn(`Longitude out of range: ${lon}, skipping row:`, rowData);
          skippedRows++;
          continue;
        }
        
        // Filter points outside Colombia
        // Colombia coordinates: Latitude: ~4°N to ~12°N, Longitude: ~-79°W to ~-66°W
        const COLOMBIA_LAT_MIN = 4.0;
        const COLOMBIA_LAT_MAX = 12.5;
        const COLOMBIA_LON_MIN = -79.0;
        const COLOMBIA_LON_MAX = -66.0;
        
        if (lat < COLOMBIA_LAT_MIN || lat > COLOMBIA_LAT_MAX || 
            lon < COLOMBIA_LON_MIN || lon > COLOMBIA_LON_MAX) {
          console.warn(`Punto fuera de Colombia (lat: ${lat}, lon: ${lon}), omitiendo fila:`, rowData);
          skippedRows++;
          continue;
        }
        
        // Use coordinates as key for grouping - use EXACT coordinates as string
        // Convert to string with full precision to match exact duplicates
        const key = `${lat},${lon}`;
        
        // Extract person_id if available
        const personId = personIdKey ? String(rowData[personIdKey] || "").trim() : undefined;
        
        if (occurrenceMap[key]) {
          // Increment count for duplicate coordinates
          const oldCount = occurrenceMap[key].count;
          occurrenceMap[key].count += 1;
          occurrenceMap[key].occurrences.push(occurrenceMap[key].count);
          // Add person_id if available and not already in the list
          if (personId && !occurrenceMap[key].person_ids.includes(personId)) {
            occurrenceMap[key].person_ids.push(personId);
          }
          processedRows++;
          console.log(`[DUPLICADO ENCONTRADO] Clave: ${key}, Cantidad anterior: ${oldCount}, Cantidad nueva: ${occurrenceMap[key].count}`);
        } else {
          // First time seeing these coordinates
          occurrenceMap[key] = {
            latitude: lat, // Store original value
            longitude: lon, // Store original value
            count: 1, // Start with 1 occurrence
            occurrences: [1], // Track first occurrence
            person_ids: personId ? [personId] : [], // Store person_id if available
          };
          processedRows++;
          if (processedRows <= 5 || processedRows % 100 === 0) {
            console.log(`[NUEVO PUNTO ${processedRows}] Clave: ${key}, Cantidad inicial: 1`);
          }
        }
      }
      
      console.log(`Resumen de procesamiento de filas: ${processedRows} procesadas, ${skippedRows} omitidas`);
      if (skippedRows > 0) {
        console.log(`⚠️ ${skippedRows} filas fueron omitidas (coordenadas inválidas o fuera de Colombia)`);
      }
      console.log(`Total de coordenadas únicas encontradas (solo Colombia): ${Object.keys(occurrenceMap).length}`);
      
      // Check for points with count > 1 BEFORE converting
      const pointsWithCountGreaterThanOne = Object.entries(occurrenceMap).filter(([key, item]) => item.count > 1);
      console.log(`=== PUNTOS CON MÚLTIPLES APARICIONES: ${pointsWithCountGreaterThanOne.length} ===`);
      if (pointsWithCountGreaterThanOne.length > 0) {
        console.log("Primeros 10 puntos con cantidad > 1:");
        pointsWithCountGreaterThanOne.slice(0, 10).forEach(([key, item]) => {
          console.log(`  - ${key}: cantidad=${item.count}`);
        });
      } else {
        console.warn("⚠️ NO SE ENCONTRARON PUNTOS DUPLICADOS - Todas las coordenadas son únicas");
        console.log("Muestra de primeras 10 coordenadas procesadas:");
        Object.entries(occurrenceMap).slice(0, 10).forEach(([key, item]) => {
          console.log(`  - ${key}: cantidad=${item.count}`);
        });
      }
      
      // STEP 2: Convert occurrence map to consolidated points with quantities
      const uniquePoints: PointData[] = Object.values(occurrenceMap).map((item) => ({
        latitude: item.latitude,
        longitude: item.longitude,
        quantity: item.count, // Quantity = number of times this coordinate appeared
        person_id: item.person_ids.length > 0 
          ? (item.person_ids.length === 1 ? item.person_ids[0] : item.person_ids.join(", "))
          : undefined, // Store single person_id or comma-separated if multiple
      }));
      
      // Verify quantities are being set correctly
      const pointsWithQtyGreaterThanOne = uniquePoints.filter(p => p.quantity > 1);
      console.log(`Puntos únicos con quantity > 1: ${pointsWithQtyGreaterThanOne.length}`);
      if (pointsWithQtyGreaterThanOne.length > 0) {
        console.log("Ejemplos de puntos con quantity > 1:", pointsWithQtyGreaterThanOne.slice(0, 5).map(p => ({
          lat: p.latitude,
          lon: p.longitude,
          quantity: p.quantity
        })));
      }
      
      // Log detailed consolidation info
      console.log("=== CONSOLIDACIÓN DE PUNTOS ===");
      const consolidatedPointsList: Array<{key: string, item: any}> = [];
      Object.entries(occurrenceMap).forEach(([key, item]) => {
        if (item.count > 1) {
          consolidatedPointsList.push({key, item});
          console.log(`✓ Coordenadas ${key}:`);
          console.log(`  - Lat: ${item.latitude}, Lon: ${item.longitude}`);
          console.log(`  - Apariciones: ${item.count}`);
          console.log(`  - Cantidad consolidada: ${item.count}`);
        }
      });
      
      if (consolidatedPointsList.length === 0) {
        console.warn("⚠️ ADVERTENCIA: No se encontraron puntos duplicados. Verificando todas las coordenadas...");
        console.log("Todas las coordenadas procesadas:", Object.entries(occurrenceMap).map(([key, item]) => ({
          key,
          lat: item.latitude,
          lon: item.longitude,
          count: item.count
        })));
      }
      
      console.log("=== RESUMEN FINAL ===");
      console.log(`Total filas en Excel: ${jsonData.length}`);
      console.log(`Puntos únicos después de consolidar: ${uniquePoints.length}`);
      console.log(`Puntos consolidados (con cantidad > 1): ${uniquePoints.filter(p => p.quantity > 1).length}`);
      console.log(`Detalle de TODAS las cantidades:`, uniquePoints.map(p => ({
        coords: `${p.latitude}, ${p.longitude}`,
        quantity: p.quantity
      })));
      
      // Show sample of first few points to verify
      console.log("=== MUESTRA DE PRIMEROS PUNTOS ===");
      uniquePoints.slice(0, 10).forEach((p, idx) => {
        console.log(`Punto ${idx + 1}: Lat=${p.latitude}, Lon=${p.longitude}, Cantidad=${p.quantity}`);
      });
      
      if (uniquePoints.length === 0) {
        toast({
          title: "Error",
          description: "No se encontraron coordenadas válidas en el archivo",
          variant: "destructive",
        });
        return;
      }

      // STEP 3: Convert consolidated points to insert format
      const pointsToInsert = uniquePoints.map((point, index) => {
        // Quantity is the number of times this coordinate appeared (already consolidated)
        const quantity = Math.max(1, Math.floor(point.quantity || 1));
        
        // Keep original coordinates without rounding
        const lat = point.latitude;
        const lon = point.longitude;
        
        return {
          name: `Punto ${index + 1}`,
          address: `${lat}, ${lon}`,
          latitude: lat,
          longitude: lon,
          quantity: quantity, // This is the consolidated count
          person_id: point.person_id, // Include person_id if available
        };
      });

      // Calculate consolidation stats
      const totalRows = jsonData.length;
      const uniquePointsCount = uniquePoints.length;
      const consolidatedCount = totalRows - uniquePointsCount;
      const pointsWithMultipleOccurrences = uniquePoints.filter(p => p.quantity > 1).length;
      
      // Show detailed summary in console
      console.log("=== PUNTOS A INSERTAR ===");
      pointsToInsert.forEach((p, idx) => {
        if (p.quantity > 1) {
          console.log(`Punto ${idx + 1}: ${p.latitude}, ${p.longitude} - Cantidad: ${p.quantity} (consolidado)`);
        }
      });
      
      console.log("=== ESTADÍSTICAS FINALES ===");
      console.log(`Total filas procesadas: ${processedRows}`);
      console.log(`Puntos únicos: ${uniquePointsCount}`);
      console.log(`Puntos con múltiples apariciones: ${pointsWithMultipleOccurrences}`);
      console.log(`Total consolidaciones: ${consolidatedCount}`);

      // Batch insert ALL points at once
      if (pointsToInsert.length === 0) {
        toast({
          title: "Error",
          description: "No se encontraron puntos válidos para insertar",
          variant: "destructive",
        });
        return;
      }

      // Prepare all data for batch insert
      // ALWAYS include quantity - it's the consolidated count from occurrences
      const allDataToInsert = pointsToInsert.map((pointData) => {
        // Keep original coordinates without modification
        const lat = pointData.latitude;
        const lon = pointData.longitude;
        
        // Validate final values are within range
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          console.error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
          throw new Error(`Coordenadas inválidas: latitud ${lat}, longitud ${lon}`);
        }
        
        // Quantity is the consolidated count (number of times this coordinate appeared)
          const quantity = Math.max(1, Math.floor(pointData.quantity || 1));
        
        const baseData: any = {
            name: pointData.name,
            address: pointData.address,
          latitude: lat,
          longitude: lon,
          quantity: quantity, // ALWAYS include quantity - it's the consolidated count
          person_id: pointData.person_id, // Include person_id if available
        };
        
        if (quantity > 1) {
          console.log(`🔵 PUNTO CON CANTIDAD > 1: ${pointData.name} - Lat: ${lat}, Lon: ${lon}, Cantidad: ${quantity}`);
        }
        
        return baseData;
      });

      // Log what we're about to insert
      console.log("=== ANTES DE INSERTAR ===");
      console.log(`Total puntos a insertar: ${allDataToInsert.length}`);
      const pointsWithQty = allDataToInsert.filter(p => p.quantity > 1);
      console.log(`Puntos con cantidad > 1: ${pointsWithQty.length}`);
      if (pointsWithQty.length > 0) {
        console.log("Ejemplos de puntos con cantidad > 1:", pointsWithQty.slice(0, 5).map(p => ({
          name: p.name,
          lat: p.latitude,
          lon: p.longitude,
          quantity: p.quantity
        })));
      } else {
        console.warn("⚠️ ADVERTENCIA: No hay puntos con cantidad > 1 para insertar");
      }
      
      // Save to localStorage (works without Supabase)
      const pointsWithIds = allDataToInsert.map((point, index) => ({
        ...point,
        id: `local-${Date.now()}-${index}`, // Generate unique ID
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      
      // Save to localStorage
      localStorage.setItem('pickup_points', JSON.stringify(pointsWithIds));
      console.log("=== PUNTOS GUARDADOS EN LOCALSTORAGE ===");
      console.log(`Total puntos guardados: ${pointsWithIds.length}`);
      const pointsWithQtySaved = pointsWithIds.filter(p => p.quantity > 1);
      console.log(`Puntos con cantidad > 1: ${pointsWithQtySaved.length}`);
      
      if (pointsWithQtySaved.length > 0) {
        console.log("✅ Puntos guardados con cantidad > 1:", pointsWithQtySaved.slice(0, 5).map(p => ({
          name: p.name,
          quantity: p.quantity
        })));
      }
      
      // Try Supabase if available (optional)
      let insertedData: any[] | null = null;
      let insertError: any = null;
      
      try {
        const firstAttempt = await supabase
          .from("pickup_points")
          .insert(allDataToInsert)
          .select();
        
        insertedData = firstAttempt.data;
        insertError = firstAttempt.error;
        
        if (insertedData) {
          console.log("=== TAMBIÉN GUARDADO EN SUPABASE ===");
          console.log(`Total insertados en Supabase: ${insertedData.length}`);
        }
      } catch (error) {
        console.warn("Supabase no disponible, usando solo localStorage:", error);
      }

      // If error about quantity column in Supabase, that's OK - we have it in localStorage
      if (insertError && (insertError.code === "PGRST204" || insertError.message?.includes("quantity"))) {
        console.warn("⚠️ Supabase no tiene columna 'quantity', pero los datos están guardados en localStorage con cantidad");
      } else if (insertError) {
        console.warn("Error en Supabase (pero datos guardados en localStorage):", insertError);
      }

      const insertedCount = pointsWithIds.length;

      // Verify what was actually saved to localStorage
      console.log("=== VERIFICACIÓN FINAL DE INSERCIÓN ===");
      const sampleInserted = pointsWithIds.slice(0, 10);
      console.log("Muestra de puntos guardados (primeros 10):", sampleInserted.map((p: any) => ({
        id: p.id,
        name: p.name,
        lat: p.latitude,
        lon: p.longitude,
        quantity: p.quantity,
        quantityType: typeof p.quantity,
        hasQuantity: 'quantity' in p
      })));
      
      // Check specifically for the point the user mentioned
      const userPoint = pointsWithIds.find((p: any) => 
        String(p.latitude) === '4.723551' && String(p.longitude) === '-74.092143'
      );
      if (userPoint) {
        console.log("🔍 PUNTO ESPECÍFICO DEL USUARIO ENCONTRADO:", {
          id: userPoint.id,
          name: userPoint.name,
          lat: userPoint.latitude,
          lon: userPoint.longitude,
          quantity: userPoint.quantity,
          quantityType: typeof userPoint.quantity
        });
      } else {
        console.warn("⚠️ PUNTO ESPECÍFICO DEL USUARIO NO ENCONTRADO EN INSERTADOS");
      }

      // Reload pickup points to get updated list (from localStorage)
      await loadPickupPoints();
      
      // Verify points were saved correctly
      const savedPoints = JSON.parse(localStorage.getItem('pickup_points') || '[]');
      const savedWithQty = savedPoints.filter((p: any) => p.quantity > 1);
      console.log(`✅ Puntos guardados en localStorage: ${savedPoints.length}, con cantidad > 1: ${savedWithQty.length}`);

      // Show success message with detailed consolidation info
      const consolidationDetails = [];
      if (pointsWithMultipleOccurrences > 0) {
        consolidationDetails.push(`${pointsWithMultipleOccurrences} puntos con cantidad > 1`);
      }
      if (consolidatedCount > 0) {
        consolidationDetails.push(`${consolidatedCount} duplicados consolidados`);
      }
      
      const consolidationMessage = consolidationDetails.length > 0
        ? ` (${totalRows} filas → ${insertedCount} puntos únicos. ${consolidationDetails.join(", ")})`
        : ` (${totalRows} filas procesadas)`;
      
        toast({
          title: "Archivo cargado exitosamente",
        description: `Se agregaron ${insertedCount} puntos de recogida${consolidationMessage}`,
      });
      
      // Log final summary
      console.log("=== INSERCIÓN COMPLETADA ===");
      console.log(`Puntos insertados: ${insertedCount}`);
      const pointsWithQuantity = pointsToInsert.filter(p => p.quantity > 1);
      if (pointsWithQuantity.length > 0) {
        console.log(`Puntos con cantidad consolidada (quantity > 1):`, pointsWithQuantity.map(p => ({
          coords: `${p.latitude}, ${p.longitude}`,
          quantity: p.quantity
        })));
      } else {
        console.log("No se encontraron puntos con cantidad > 1 (todos los puntos aparecieron solo una vez)");
      }
    } catch (error) {
      console.error("Error processing Excel file:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      
      if (errorMessage.includes("xlsx") || errorMessage.includes("Cannot find module")) {
        toast({
          title: "Error",
          description: "La librería xlsx no está instalada. Por favor ejecuta: npm install xlsx",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: `No se pudo procesar el archivo Excel: ${errorMessage}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if it's an Excel file
      const validExtensions = [".xlsx", ".xls", ".xlsm"];
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        toast({
          title: "Error",
          description: "Por favor selecciona un archivo Excel (.xlsx, .xls, .xlsm)",
          variant: "destructive",
        });
        return;
      }
      
      handleExcelUpload(file);
      // Reset input
      e.target.value = "";
    }
  };

  const handleVehicleExcelUpload = async (file: File) => {
    try {
      // Dynamically import xlsx library
      // @ts-ignore - xlsx types may not be available until package is installed
      const XLSX = await import("xlsx").catch(() => {
        throw new Error("xlsx module not found. Please install it: npm install xlsx");
      });
      
      // Read the file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (!Array.isArray(jsonData) || jsonData.length === 0) {
        toast({
          title: "Error",
          description: "El archivo Excel está vacío o no tiene formato válido",
          variant: "destructive",
        });
        return;
      }

      // Detect column names (case-insensitive, handles variations)
      const firstRow = jsonData[0] as Record<string, any>;
      const allKeys = Object.keys(firstRow);
      
      const placaKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "placa" || normalized.includes("placa");
        }
      );
      const capacidadKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "capacidad" || normalized.includes("capacidad");
        }
      );
      const distanciaKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "distancia máxima (km)" || 
                 normalized === "distancia maxima (km)" ||
                 normalized === "distancia máxima" ||
                 normalized === "distancia maxima" ||
                 normalized.includes("distancia") && normalized.includes("max");
        }
      );
      
      if (!placaKey || !capacidadKey || !distanciaKey) {
        toast({
          title: "Error",
          description: `No se encontraron todas las columnas requeridas. Buscando: "Placa", "Capacidad", "Distancia máxima (km)". Columnas encontradas: ${allKeys.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      // Process vehicles
      const vehiclesToInsert: Vehicle[] = [];
      let processedCount = 0;
      let skippedCount = 0;

      for (const row of jsonData) {
        const rowData = row as Record<string, any>;
        
        const placa = String(rowData[placaKey] || "").trim();
        const capacidad = parseFloat(rowData[capacidadKey]);
        const distanciaMax = parseFloat(rowData[distanciaKey]);
        
        // Validate data
        if (!placa || isNaN(capacidad) || isNaN(distanciaMax)) {
          console.warn("Invalid vehicle data in row:", rowData);
          skippedCount++;
          continue;
        }
        
        if (capacidad <= 0 || distanciaMax <= 0) {
          console.warn("Invalid vehicle values (must be > 0):", { placa, capacidad, distanciaMax });
          skippedCount++;
          continue;
        }

        vehiclesToInsert.push({
          name: placa,
          capacity: Math.floor(capacidad),
          max_distance: distanciaMax,
        });
        processedCount++;
      }

      if (vehiclesToInsert.length === 0) {
        toast({
          title: "Error",
          description: "No se encontraron vehículos válidos en el archivo",
          variant: "destructive",
        });
        return;
      }

      // Delete all existing vehicles first
      try {
        const { error: deleteError } = await supabase
          .from("vehicles")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        
        if (deleteError) {
          console.warn("Error deleting existing vehicles:", deleteError);
        }
      } catch (error) {
        console.warn("Error deleting vehicles (may not be available):", error);
      }

      // Insert new vehicles
      try {
        const { data: insertedData, error: insertError } = await supabase
          .from("vehicles")
          .insert(vehiclesToInsert)
          .select();

        if (insertError) {
          console.error("Error inserting vehicles:", insertError);
          // Still update state even if Supabase fails
        } else {
          console.log("Vehicles inserted into Supabase:", insertedData);
        }
      } catch (error) {
        console.warn("Supabase not available, using state only:", error);
      }

      // Update state
      setVehicles(vehiclesToInsert);

      toast({
        title: "Archivo cargado exitosamente",
        description: `Se agregaron ${processedCount} vehículos${skippedCount > 0 ? ` (${skippedCount} filas omitidas)` : ""}`,
      });
    } catch (error) {
      console.error("Error processing vehicle Excel file:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      
      if (errorMessage.includes("xlsx") || errorMessage.includes("Cannot find module")) {
        toast({
          title: "Error",
          description: "La librería xlsx no está instalada. Por favor ejecuta: npm install xlsx",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: `No se pudo procesar el archivo Excel: ${errorMessage}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleVehicleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if it's an Excel file
      const validExtensions = [".xlsx", ".xls", ".xlsm"];
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        toast({
          title: "Error",
          description: "Por favor selecciona un archivo Excel (.xlsx, .xls, .xlsm)",
          variant: "destructive",
        });
        return;
      }
      
      handleVehicleExcelUpload(file);
      // Reset input
      e.target.value = "";
    }
  };

  const handleMapClick = async (lng: number, lat: number) => {
    // Handle vehicle location selection
    if (vehicleLocationMode && vehicleLocationCallback) {
      vehicleLocationCallback(lng, lat);
      setVehicleLocationMode(null);
      setVehicleLocationCallback(null);
      return;
    }

    // Handle pickup point addition
    if (!clickMode) return;

    try {
      // Generate a temporary name based on coordinates
      const pointName = `Point ${pickupPoints.length + 1}`;
      const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      await handleAddPickupPoint({
        name: pointName,
        address: address,
        latitude: lat,
        longitude: lng,
        quantity: 1,
      });

      toast({
        title: "Point added",
        description: `Added pickup point at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
    } catch (error) {
      console.error("Error adding point from map click:", error);
      // Error toast is already shown in handleAddPickupPoint
    }
  };

  const handleVehicleLocationMapClick = (mode: "start" | "end" | "start-selected" | "end-selected" | null, callback: (lon: number, lat: number) => void) => {
    // Ignore selected modes - they're just notifications
    if (mode === "start-selected" || mode === "end-selected") {
      return;
    }
    
    setVehicleLocationMode(mode);
    setVehicleLocationCallback(() => callback);
    if (mode) {
      toast({
        title: "Modo de selección activado",
        description: `Haz clic en el mapa para seleccionar la ubicación ${mode === "start" ? "de inicio" : "de fin"}`,
      });
    } else {
      setVehicleLocationMode(null);
      setVehicleLocationCallback(null);
    }
  };

  const handleVehicleLocationUpdate = (type: "start" | "end", location: { lon: number; lat: number } | null) => {
    if (type === "start") {
      setCurrentVehicleStartLocation(location);
    } else {
      setCurrentVehicleEndLocation(location);
    }
  };

  const handleRemovePickupPoint = async (pointId: string) => {
    try {
      // Remove from localStorage
      const updatedPoints = pickupPoints.filter((p) => p.id !== pointId);
      setPickupPoints(updatedPoints);
      savePointsToLocalStorage(updatedPoints);
      
      // Try Supabase if available (optional)
      try {
        await supabase
      .from("pickup_points")
      .delete()
      .eq("id", pointId);
      } catch (error) {
        console.warn("Supabase delete failed (using localStorage):", error);
      }

      toast({
        title: "Punto eliminado",
        description: "El punto de recogida ha sido eliminado exitosamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el punto de recogida",
        variant: "destructive",
      });
    }
  };

  const handleAddVehicle = async (vehicle: Vehicle) => {
    const { data, error } = await supabase
      .from("vehicles")
      .insert([vehicle])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el vehículo",
        variant: "destructive",
      });
      return;
    }

    setVehicles([...vehicles, data]);
    setIsVehicleDialogOpen(false);
    
    // Update markers if vehicle has locations
    if (vehicle.start_location) {
      setCurrentVehicleStartLocation(vehicle.start_location);
    }
    if (vehicle.end_location) {
      setCurrentVehicleEndLocation(vehicle.end_location);
    }
  };

  const handleUpdateVehicle = async (vehicleId: string, vehicle: Vehicle) => {
    const { error } = await supabase
      .from("vehicles")
      .update(vehicle)
      .eq("id", vehicleId);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el vehículo",
        variant: "destructive",
      });
      return;
    }

    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", vehicleId)
      .single();

    if (data) {
      setVehicles(vehicles.map((v) => (v.id === vehicleId ? data : v)));
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", vehicleId);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el vehículo",
        variant: "destructive",
      });
      return;
    }

    setVehicles(vehicles.filter((v) => v.id !== vehicleId));
    toast({
      title: "Vehículo eliminado",
      description: "El vehículo ha sido eliminado exitosamente",
    });
  };

  const handleDeleteAllVehicles = async () => {
    if (vehicles.length === 0) {
      toast({
        title: "Info",
        description: "No hay vehículos para eliminar",
      });
      return;
    }

    try {
      // Delete all vehicles from Supabase
      const { error } = await supabase
        .from("vehicles")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) {
        toast({
          title: "Error",
          description: "No se pudieron eliminar los vehículos",
          variant: "destructive",
        });
        return;
      }

      // Clear the state
      setVehicles([]);
      setRoutes([]);
      setVisibleRoutes(new Set());

      toast({
        title: "Vehículos eliminados",
        description: `Se eliminaron ${vehicles.length} vehículos exitosamente`,
      });
    } catch (error) {
      console.error("Error deleting all vehicles:", error);
      toast({
        title: "Error",
        description: `No se pudieron eliminar los vehículos: ${error instanceof Error ? error.message : "Error desconocido"}`,
        variant: "destructive",
      });
    }
  };

  const handleOptimizeRoutes = async () => {
    if (pickupPoints.length < 2) {
      toast({
        title: "Error",
        description: "Necesitas al menos 2 puntos de recogida",
        variant: "destructive",
      });
      return;
    }

    if (vehicles.length === 0) {
      toast({
        title: "Error",
        description: "Necesitas configurar al menos 1 vehículo",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);
    setIsNewRunMode(true);
    setSelectedRunId(null);
    setSelectedRunData(null);
    try {
      // Build the JSON payload that will be sent to Nextmv
      // Ensure all numeric values are explicitly numbers
      const nextmvRequest = {
        defaults: {
          vehicles: {
            speed: Number(10), // Speed in m/s (10 m/s = 36 km/h)
            capacity: Number(50),
            max_distance: Number(100000), // 100 km in meters
            start_time: "2025-01-01T06:00:00Z",
            end_time: "2025-01-01T22:00:00Z"
          }
        },
        stops: pickupPoints.map((point, index) => {
          // Ensure coordinates are numbers, not strings
          const lon = Number(parseFloat(String(point.longitude)));
          const lat = Number(parseFloat(String(point.latitude)));
          
          if (isNaN(lon) || isNaN(lat) || !isFinite(lon) || !isFinite(lat)) {
            throw new Error(`Invalid coordinates for point ${point.name || point.id}: longitude=${point.longitude}, latitude=${point.latitude}`);
          }
          
          // Convert positive quantity from frontend to negative for Nextmv API
          const frontendQuantity = point.quantity !== undefined ? point.quantity : 1;
          const nextmvQuantity = -Math.abs(Number(frontendQuantity)); // Always negative for Nextmv
          
          // Encode person_id in the stop ID if available
          // Format: {point.id}__person_{person_id} or just {point.id} if no person_id
          // If multiple person_ids (comma-separated), use the first one
          let stopId = String(point.id || `stop-${index}`);
          if (point.person_id) {
            // If comma-separated, take the first person_id
            const firstPersonId = point.person_id.split(',')[0].trim();
            stopId = `${stopId}__person_${firstPersonId}`;
          }
          
          return {
            id: stopId,
            location: {
              lon: Number(lon),
              lat: Number(lat)
            },
            quantity: nextmvQuantity // Negative value for Nextmv API
          };
        }),
        vehicles: vehicles.map((vehicle, index) => {
          // Get start location from vehicle config, first pickup point, or default
          let startLocation: { lon: number; lat: number };
          if (vehicle.start_location) {
            startLocation = vehicle.start_location;
          } else if (pickupPoints[0] && pickupPoints[0].longitude && pickupPoints[0].latitude) {
            startLocation = {
              lon: Number(parseFloat(String(pickupPoints[0].longitude))),
              lat: Number(parseFloat(String(pickupPoints[0].latitude)))
            };
          } else {
            throw new Error("No valid start location available for vehicles");
          }
          
          // Get end location from vehicle config or null
          let endLocation: { lon: number; lat: number } | undefined;
          if (vehicle.end_location) {
            endLocation = vehicle.end_location;
          }
          
          // Ensure capacity and max_distance are proper numbers
          // max_distance is stored in km in the UI, convert to meters for Nextmv API
          const capacity = Number(parseInt(String(vehicle.capacity), 10)) || 100;
          const maxDistanceKm = Number(parseFloat(String(vehicle.max_distance))) || 100;
          const maxDistance = maxDistanceKm * 1000; // Convert km to meters
          
          if (isNaN(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
            throw new Error(`Invalid capacity for vehicle ${vehicle.name || vehicle.id}: ${vehicle.capacity}`);
          }
          
          if (isNaN(maxDistance) || maxDistance <= 0 || !isFinite(maxDistance)) {
            throw new Error(`Invalid max_distance for vehicle ${vehicle.name || vehicle.id}: ${vehicle.max_distance}`);
          }
          
          const vehiclePayload: any = {
            id: String(vehicle.id || `vehicle-${index}`),
            start_location: {
              lon: Number(startLocation.lon),
              lat: Number(startLocation.lat)
            },
            capacity: Number(capacity), // Capacity should be an integer
            max_distance: Number(maxDistance),
            speed: Number(10) // Speed in m/s (10 m/s = 36 km/h)
          };
          
          // Add end location if specified
          if (endLocation) {
            vehiclePayload.end_location = {
              lon: Number(endLocation.lon),
              lat: Number(endLocation.lat)
            };
          }
          
          return vehiclePayload;
        })
      };

      // Note: application_id is in the URL path, not in the payload
      const nextmvPayload = {
        input: nextmvRequest,
        options: {
          "solve.duration": "10s"
        }
      };

      // Deep validation: Ensure all numeric values are actually numbers (not strings)
      // This is critical for Nextmv API which is strict about types
      const validateAndFixTypes = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) {
          return obj.map(validateAndFixTypes).filter(v => v !== undefined && v !== null);
        }
        if (typeof obj === 'object') {
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            // Skip undefined values
            if (value === undefined) continue;
            
            // Check if this should be a number based on common numeric field names
            if (['lon', 'lat', 'speed', 'max_distance', 'duration'].includes(key)) {
              const numValue = typeof value === 'string' ? Number(value) : (typeof value === 'number' ? value : Number(value));
              if (!isNaN(numValue) && isFinite(numValue)) {
                result[key] = numValue;
              }
            } else if (key === 'quantity') {
              // Quantity should be an integer, preserve negative values (for Nextmv API)
              if (Array.isArray(value)) {
                // If it's an array, take the first value
                const firstValue = value[0];
                const numValue = typeof firstValue === 'string' ? parseInt(firstValue, 10) : (typeof firstValue === 'number' ? firstValue : parseInt(String(firstValue), 10));
                // Preserve the sign of the value (should be negative for Nextmv)
                result[key] = !isNaN(numValue) && isFinite(numValue) && Number.isInteger(numValue) ? Number(numValue) : -1;
              } else {
                const numValue = typeof value === 'string' ? parseInt(value, 10) : (typeof value === 'number' ? value : parseInt(String(value), 10));
                // Preserve the sign of the value (should be negative for Nextmv)
                result[key] = !isNaN(numValue) && isFinite(numValue) && Number.isInteger(numValue) ? Number(numValue) : -1;
              }
            } else if (key === 'capacity') {
              // Capacity should be an integer
              if (Array.isArray(value)) {
                // If it's an array, take the first value
                const firstValue = value[0];
                const numValue = typeof firstValue === 'string' ? parseInt(firstValue, 10) : (typeof firstValue === 'number' ? firstValue : parseInt(String(firstValue), 10));
                result[key] = !isNaN(numValue) && isFinite(numValue) && Number.isInteger(numValue) ? Number(numValue) : 20;
              } else {
                const numValue = typeof value === 'string' ? parseInt(value, 10) : (typeof value === 'number' ? value : parseInt(String(value), 10));
                result[key] = !isNaN(numValue) && isFinite(numValue) && Number.isInteger(numValue) ? Number(numValue) : 20;
              }
            } else if (key === 'start_location' || key === 'location') {
              result[key] = validateAndFixTypes(value);
            } else {
              result[key] = validateAndFixTypes(value);
            }
          }
          return result;
        }
        return obj;
      };

      // Apply type validation and fixing
      const validatedPayload = validateAndFixTypes(nextmvPayload);

      // Validate the payload structure
      console.log("Nextmv payload structure (before validation):", JSON.stringify(nextmvPayload, null, 2));
      console.log("Nextmv payload structure (after validation):", JSON.stringify(validatedPayload, null, 2));
      console.log("Payload validation:", {
        hasInput: !!validatedPayload.input,
        hasStops: !!validatedPayload.input.stops,
        stopsCount: validatedPayload.input.stops?.length,
        hasVehicles: !!validatedPayload.input.vehicles,
        vehiclesCount: validatedPayload.input.vehicles?.length,
        hasDefaults: !!validatedPayload.input.defaults,
      });

      // Final validation: Ensure JSON is valid and doesn't contain undefined/null values
      const cleanPayload = JSON.parse(JSON.stringify(validatedPayload, (key, value) => {
        // Remove undefined values
        if (value === undefined) return undefined;
        // Keep null values as they might be intentional
        return value;
      }));

      // Verify the cleaned payload
      console.log("Cleaned payload (no undefined values):", JSON.stringify(cleanPayload, null, 2));

      // Store the JSON and endpoint to display (use cleaned version)
      setNextmvJson(cleanPayload);
      const nextmvPath = "/v1/applications/workspace-dgxjzzgctd/runs";
      const nextmvEndpoint = "/api/nextmv" + nextmvPath; // Use proxy in development
      const nextmvFullUrl = "https://api.cloud.nextmv.io" + nextmvPath; // Full URL for display
      setNextmvEndpoint(nextmvFullUrl);
      
      console.log("Calling Nextmv API:", {
        endpoint: nextmvEndpoint,
        fullUrl: nextmvFullUrl,
        pickupPointsCount: pickupPoints.length,
        vehiclesCount: vehicles.length,
      });
      
      // Get Nextmv API key from environment or use fallback
      const NEXTMV_API_KEY = import.meta.env.VITE_NEXTMV_API_KEY || "nxmvv1_lhcoj3zDR:f5d1c365105ef511b4c47d67c6c13a729c2faecd36231d37dcdd2fcfffd03a6813235230";
      
      if (!NEXTMV_API_KEY) {
        throw new Error("VITE_NEXTMV_API_KEY no está configurado. Por favor, configura tu API key de Nextmv.");
      }
      
      // Call Nextmv API through proxy (to avoid CORS issues)
      let response: Response;
      let responseData: any;
      
      try {
        // Add timeout to prevent hanging (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 30000);
        
        try {
          // Use proxy endpoint in development, direct URL in production (if CORS allows)
          const apiUrl = import.meta.env.DEV ? nextmvEndpoint : nextmvFullUrl;
          
          // Convert to JSON string for the request
          const requestBodyString = JSON.stringify(cleanPayload);
          
          // Verify JSON is valid
          try {
            JSON.parse(requestBodyString);
          } catch (e) {
            throw new Error(`Invalid JSON payload: ${e}`);
          }
          
          console.log("Sending JSON request to Nextmv:", {
            url: apiUrl,
            method: "POST",
            contentType: "application/json",
            bodyLength: requestBodyString.length,
            bodyPreview: requestBodyString.substring(0, 500),
            fullBody: requestBodyString
          });
          
          response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${NEXTMV_API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: requestBodyString,
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }
        
        // Try to parse response body regardless of status
        const responseText = await response.text();
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          // If parsing fails, use the raw text
          responseData = { raw: responseText };
        }
        
        console.log("Nextmv API response:", {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          ok: response.ok
        });
        
        // If response is not ok, treat it as an error
        if (!response.ok) {
          // Special handling for 400 Bad Request - show detailed error information
          if (response.status === 400) {
            let errorMessage = "Error de validación en la solicitud";
            let errorDetails: any = null;
            const errorParts: string[] = [];
            
            if (responseData) {
              // Extract error message from various possible formats
              if (typeof responseData === 'string') {
                errorMessage = responseData;
                errorParts.push(`Mensaje: ${responseData}`);
              } else if (responseData.error) {
                const errorObj = responseData.error;
                if (typeof errorObj === 'string') {
                  errorMessage = errorObj;
                  errorParts.push(`Error: ${errorObj}`);
                } else {
                  errorMessage = errorObj.message || errorObj.error || JSON.stringify(errorObj);
                  errorParts.push(`Error: ${errorMessage}`);
                  
                  // Add all error object properties
                  Object.keys(errorObj).forEach(key => {
                    if (key !== 'message' && key !== 'error') {
                      const value = errorObj[key];
                      if (value !== null && value !== undefined) {
                        errorParts.push(`${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`);
                      }
                    }
                  });
                }
                errorDetails = errorObj;
              } else if (responseData.message) {
                errorMessage = responseData.message;
                errorParts.push(`Mensaje: ${responseData.message}`);
                errorDetails = responseData;
              } else if (responseData.status && responseData.error) {
                errorMessage = responseData.error;
                errorParts.push(`Error: ${responseData.error}`);
                errorDetails = responseData;
              } else {
                // If it's an object, extract all meaningful fields
                errorMessage = "Error en la solicitud";
                errorDetails = responseData;
                
                Object.keys(responseData).forEach(key => {
                  const value = responseData[key];
                  if (value !== null && value !== undefined && value !== '') {
                    if (typeof value === 'object' && !Array.isArray(value)) {
                      errorParts.push(`${key}:\n${JSON.stringify(value, null, 2)}`);
                    } else if (Array.isArray(value) && value.length > 0) {
                      errorParts.push(`${key}:\n${JSON.stringify(value, null, 2)}`);
                    } else {
                      errorParts.push(`${key}: ${value}`);
                    }
                  }
                });
              }
              
              // Add specific error details if available
              if (responseData.details) {
                const details = typeof responseData.details === 'string' 
                  ? responseData.details 
                  : JSON.stringify(responseData.details, null, 2);
                errorParts.push(`\nDetalles:\n${details}`);
              }
              
              if (responseData.validation_errors) {
                const validationErrors = typeof responseData.validation_errors === 'string'
                  ? responseData.validation_errors
                  : JSON.stringify(responseData.validation_errors, null, 2);
                errorParts.push(`\nErrores de validación:\n${validationErrors}`);
              }
              
              if (responseData.field_errors) {
                const fieldErrors = typeof responseData.field_errors === 'string'
                  ? responseData.field_errors
                  : JSON.stringify(responseData.field_errors, null, 2);
                errorParts.push(`\nErrores de campos:\n${fieldErrors}`);
              }
              
              // Log full error details for debugging
              console.error("Nextmv API returned 400 Bad Request (FULL DETAILS):", {
                status: response.status,
                statusText: response.statusText,
                errorMessage,
                fullResponse: responseData,
                errorDetails: errorDetails,
                responseHeaders: Object.fromEntries(response.headers.entries()),
                parsedErrorParts: errorParts
              });
              
              // Build a detailed, user-friendly error message
              const detailedErrorMessage = errorParts.length > 0 
                ? errorParts.join('\n\n')
                : `Error 400: ${errorMessage}\n\nRespuesta completa:\n${JSON.stringify(responseData, null, 2)}`;
              
              throw new Error(detailedErrorMessage);
            } else {
              // No response data, use status text
              throw new Error(`Error 400: ${response.statusText || 'Bad Request'}\n\nNo se recibieron detalles adicionales del servidor.`);
            }
          } else {
            // Handle other error status codes
            let errorMessage = "Error al llamar a la API de Nextmv";
            let errorDetails: any = null;
            
            // Try to extract detailed error information
            if (responseData?.error) {
              if (typeof responseData.error === 'string') {
                errorMessage = responseData.error;
              } else if (responseData.error.message) {
                errorMessage = responseData.error.message;
                errorDetails = responseData.error;
              } else {
                errorMessage = JSON.stringify(responseData.error);
                errorDetails = responseData.error;
              }
            } else if (responseData?.message) {
              errorMessage = typeof responseData.message === 'string' 
                ? responseData.message 
                : String(responseData.message);
              errorDetails = responseData;
            } else if (responseData?.raw) {
              errorMessage = responseData.raw;
            } else if (responseData) {
              // If we have any response data, show it
              errorMessage = JSON.stringify(responseData);
              errorDetails = responseData;
            } else if (response.statusText) {
              errorMessage = `${response.status} ${response.statusText}`;
            } else {
              errorMessage = `Error ${response.status}: La API de Nextmv retornó un código de error`;
            }
            
            // Log full error details for debugging
            console.error("Nextmv API returned error (FULL DETAILS):", {
              status: response.status,
              statusText: response.statusText,
              errorMessage,
              fullResponse: responseData,
              errorDetails: errorDetails,
              responseHeaders: Object.fromEntries(response.headers.entries())
            });
            
            // Build a detailed error message
            let detailedErrorMessage = `Error ${response.status}: ${errorMessage}`;
            
            if (errorDetails) {
              // Add specific error details if available
              if (errorDetails.details) {
                detailedErrorMessage += `\n\nDetalles: ${JSON.stringify(errorDetails.details, null, 2)}`;
              }
              if (errorDetails.validation_errors) {
                detailedErrorMessage += `\n\nErrores de validación: ${JSON.stringify(errorDetails.validation_errors, null, 2)}`;
              }
              if (errorDetails.field_errors) {
                detailedErrorMessage += `\n\nErrores de campos: ${JSON.stringify(errorDetails.field_errors, null, 2)}`;
              }
              // Show full error object if it has useful info
              if (Object.keys(errorDetails).length > 1) {
                detailedErrorMessage += `\n\nRespuesta completa: ${JSON.stringify(errorDetails, null, 2)}`;
              }
            }
            
            throw new Error(detailedErrorMessage);
          }
        }
        
        // Check if response data contains an error (even with 200 status)
        if (responseData && responseData.error) {
          console.error("Nextmv API returned error in data:", responseData.error);
          const errorMessage = typeof responseData.error === 'string' 
            ? responseData.error 
            : responseData.error.message || JSON.stringify(responseData.error);
          throw new Error(errorMessage);
        }
        
      } catch (fetchError: any) {
        // Handle abort/timeout
        if (fetchError.name === 'AbortError') {
          throw new Error("Timeout: La conexión con la API de Nextmv tardó demasiado. Intenta nuevamente.");
        }
        
        // If it's already an Error we threw, re-throw it
        if (fetchError instanceof Error) {
          throw fetchError;
        }
        
        // Otherwise, it's a network or other error
        console.error("Error calling Nextmv API:", fetchError);
        const errorMessage = fetchError?.message || String(fetchError);
        
        if (errorMessage.includes("dns error") || errorMessage.includes("failed to lookup")) {
          throw new Error("Error de red: No se puede conectar a la API de Nextmv. Verifica tu conexión a internet.");
        } else if (errorMessage.includes("CORS")) {
          throw new Error("Error CORS: La API de Nextmv no permite solicitudes desde el navegador. Contacta al soporte.");
        } else {
          throw new Error(`Error al conectar con Nextmv API: ${errorMessage}`);
        }
      }
      
      // Check if the response contains a run ID (async job pattern)
      let runId: string | null = null;
      if (responseData && responseData.id) {
        runId = responseData.id;
        console.log("Received run ID from Nextmv:", runId);
      } else if (responseData && responseData.run_id) {
        runId = responseData.run_id;
        console.log("Received run ID from Nextmv:", runId);
      }

      // If we have a run ID, fetch the run result
      let data: any = null;
      if (runId) {
        console.log("Fetching run result for ID:", runId);
        
        // Build the GET URL for the run
        const NEXTMV_APPLICATION_ID = "workspace-dgxjzzgctd";
        const runUrl = `https://api.cloud.nextmv.io/v1/applications/${NEXTMV_APPLICATION_ID}/runs/${runId}`;
        const runApiUrl = import.meta.env.DEV ? `/api/nextmv/v1/applications/${NEXTMV_APPLICATION_ID}/runs/${runId}` : runUrl;
        
        // Poll for the result every 10 seconds until solution is available
        const pollInterval = 10000; // Poll every 10 seconds
        const maxAttempts = 60; // Maximum 10 minutes (60 attempts * 10 seconds)
        let attempts = 0;
        let solutionAvailable = false;
        
        while (!solutionAvailable && attempts < maxAttempts) {
          attempts++;
          
          try {
            const runResponse = await fetch(runApiUrl, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${NEXTMV_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
            });
            
            if (!runResponse.ok) {
              const errorText = await runResponse.text();
              throw new Error(`Error fetching run: ${runResponse.status} ${runResponse.statusText} - ${errorText}`);
            }
            
            const runData = await runResponse.json();
            console.log(`Run status (attempt ${attempts}):`, runData);
            
            // Check metadata.status to determine if run is complete
            const status = runData.metadata?.status || runData.status;
            
            if (status === "succeeded") {
              data = runData;
              solutionAvailable = true;
              console.log("Run succeeded, proceeding to display routes");
            } else if (status === "failed" || status === "error") {
              throw new Error(`Run failed: ${runData.error || runData.message || runData.metadata?.error || "Unknown error"}`);
            } else {
              // Still processing, wait 10 seconds and try again
              console.log(`Run still processing (status: ${status || "unknown"}), waiting 10 seconds...`);
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
          } catch (pollError: any) {
            if (attempts >= maxAttempts) {
              throw new Error(`Timeout waiting for solution: ${pollError.message || "Maximum polling attempts reached"}`);
            }
            // Wait 10 seconds before retrying
            console.log(`Error polling run, retrying in 10 seconds... (attempt ${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }
        
        if (!solutionAvailable) {
          throw new Error("Timeout: El proceso de optimización tardó demasiado. Intenta nuevamente.");
        }
      } else {
        // No run ID, assume direct response with solution
        data = responseData;
      }

      // Check if we got a valid solution
      // Solutions are in output.solutions, not directly in data.solutions
      const solutions = data.output?.solutions || data.solutions;
      if (!solutions || solutions.length === 0) {
        throw new Error("No se encontraron soluciones para las rutas");
      }

      // Get the first solution (defined outside try block so it's accessible later)
      const solution = solutions[0];
      
      if (!solution || !solution.vehicles) {
        throw new Error("La solución no contiene vehículos válidos");
      }

      // Save routes to Supabase database
      try {
        
        // Clear old routes before inserting new ones
        await supabase
          .from("routes")
          .delete()
          .gte("created_at", "1970-01-01");
        
        // Helper function to extract person_id from encoded stop ID
        // Format: {point.id}__person_{person_id} or just {point.id}
        const extractPersonIdFromStopId = (stopId: string): string | undefined => {
          if (!stopId) return undefined;
          const match = stopId.match(/__person_(.+)$/);
          return match ? match[1] : undefined;
        };

        // Helper function to extract original point ID from encoded stop ID
        const extractOriginalPointId = (stopId: string): string => {
          if (!stopId) return stopId;
          const index = stopId.indexOf('__person_');
          return index > -1 ? stopId.substring(0, index) : stopId;
        };

        // Create mapping of original point IDs to person_ids for fallback
        // Use global Map constructor explicitly to avoid conflict with Map component import
        const MapConstructor = globalThis.Map || window.Map;
        const pointIdToPersonMap = new MapConstructor<string, string>();
        pickupPoints.forEach((point) => {
          if (point.person_id) {
            pointIdToPersonMap.set(point.id, point.person_id);
          }
        });

        // Insert new routes
        const routeInserts = [];
        // Filter to one route per vehicle before inserting
        const seenVehiclesForDb = new Set<string>();
        for (const vehicle of solution.vehicles || []) {
          // Find the original vehicle to get its ID - this ensures we use the database vehicle_id
          const originalVehicle = vehicles.find((v) => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
          // Use the database vehicle_id or create a unique identifier from vehicle.id or index
          const vehicleIdentifier = originalVehicle?.id || vehicle.id || `vehicle-${solution.vehicles.indexOf(vehicle)}`;
          
          // Skip if we've already processed a route for this vehicle
          if (seenVehiclesForDb.has(vehicleIdentifier)) {
            console.log(`Skipping duplicate vehicle ${vehicleIdentifier} for database insert`);
            continue;
          }
          
          // Mark this vehicle as seen
          seenVehiclesForDb.add(vehicleIdentifier);
          
          // originalVehicle is already declared above, reuse it
          // Extract person assignments from route stops
          const personAssignments: string[] = [];
          if (vehicle.route) {
            vehicle.route.forEach((routeStop: any) => {
              const stopId = routeStop.stop?.id;
              if (!stopId) return;
              
              // Extract person_id from encoded stop ID
              let personId = extractPersonIdFromStopId(stopId);
              
              // Fallback: try to get from original point ID mapping
              if (!personId) {
                const originalPointId = extractOriginalPointId(stopId);
                personId = pointIdToPersonMap.get(originalPointId);
              }
              
              if (personId) {
                personAssignments.push(personId);
              }
            });
          }
          
          // Extract route information from the vehicle object
          const routeData = {
            vehicle_id: originalVehicle?.id || null,
            route_data: vehicle,
            total_distance: vehicle.route_travel_distance || 0,
            total_duration: vehicle.route_travel_duration || vehicle.route_duration || 0,
            // Note: person_assignments column doesn't exist in the routes table
            // If needed, this data can be stored in route_data JSON field
          };

          routeInserts.push(
            supabase.from("routes").insert(routeData).select()
          );
        }

        console.log(`Attempting to insert ${routeInserts.length} routes...`);
        const insertResults = await Promise.all(routeInserts);
        const insertErrors = insertResults.filter((r: any) => r.error);
        const successfulInserts = insertResults.filter((r: any) => !r.error && r.data);
        
        if (insertErrors.length > 0) {
          console.error(`Error inserting ${insertErrors.length} routes:`, insertErrors);
        }
        
        console.log(`Insert results: ${successfulInserts.length} successful, ${insertErrors.length} failed out of ${routeInserts.length} total`);
        
        // Log details of first few inserts for debugging
        insertResults.slice(0, 5).forEach((result: any, index: number) => {
          if (result.error) {
            console.error(`Route ${index} insert failed:`, result.error);
          } else if (result.data) {
            console.log(`Route ${index} inserted successfully, got ${result.data.length} record(s)`);
          }
        });
      } catch (dbError) {
        console.error("Error saving routes to database:", dbError);
        // Don't throw - we still want to show the results even if saving fails
      }

      // Immediately render routes from the solution data instead of waiting for database
      // Filter to one route per vehicle (same logic as handleRunSelect)
      const seenVehicles = new Set<string | null>();
      const routesFromSolution = (solution.vehicles || [])
        .filter((vehicle: any, index: number) => {
          const vehicleId = vehicle.id || `vehicle-${index}`;
          if (seenVehicles.has(vehicleId)) {
            console.log(`Skipping duplicate vehicle ${vehicleId} in immediate render`);
            return false;
          }
          seenVehicles.add(vehicleId);
          return true;
        })
        .map((vehicle: any, filteredIndex: number) => {
          // Find the original vehicle by matching the id
          const originalVehicle = vehicles.find((v) => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
          
          return {
            id: `temp-${filteredIndex}-${Date.now()}`,
            vehicle_id: originalVehicle?.id || null,
            route_data: vehicle,
            total_distance: vehicle.route_travel_distance || 0,
            total_duration: vehicle.route_travel_duration || vehicle.route_duration || 0,
            created_at: new Date().toISOString()
          };
        });

      console.log(`Setting ${routesFromSolution.length} filtered routes from solution immediately (one per vehicle)`);
      setRoutes(routesFromSolution);
      // Initialize all routes as visible
      setVisibleRoutes(new Set(routesFromSolution.map((_, index) => index)));

      toast({
        title: "Rutas optimizadas",
        description: "Las rutas han sido calculadas exitosamente",
      });

      // In the background, wait for database to commit, then reload routes from database
      // This ensures we have the proper IDs and database records
      setTimeout(async () => {
        const expectedRoutes = (solution.vehicles || []).length;
        const routesToLoad = Math.max(expectedRoutes * 2, vehicles.length * 2, 200);
        
        let { data: routesData, error: routesError } = await supabase
          .from("routes")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(routesToLoad);
        
        console.log(`Loading routes from database: Expected ${expectedRoutes}, Got ${routesData?.length || 0}`);
        
        if (!routesError && routesData && routesData.length > 0) {
          console.log(`Updating routes with database records. Route data:`, routesData.map(r => ({ id: r.id, vehicle_id: r.vehicle_id, has_route_data: !!r.route_data })));
          setRoutes(routesData);
          setVisibleRoutes(new Set(routesData.map((_, index) => index)));
        }
      }, 1000);
      
      // Reload runs list to include the new run
      await loadRuns();
    } catch (error) {
      console.error("Error optimizing routes:", error);
      console.error("Error details:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      const errorMessage = error instanceof Error ? error.message : "No se pudieron optimizar las rutas";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="container mx-auto flex items-center gap-2">
          <img src="https://ontrack-global.s3.us-west-2.amazonaws.com/images/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm opacity-90">Puntos de Recogida</p>
                  <p className="text-4xl font-bold">{pickupPoints.length}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                <MapPin className="w-12 h-12 opacity-80" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-secondary text-secondary-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Vehículos</p>
                  <p className="text-4xl font-bold">{vehicles.length}</p>
                </div>
                <Truck className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-accent text-accent-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Rutas Generadas</p>
                  <p className="text-4xl font-bold">
                    {(() => {
                      // Filter routes: only count routes with duration > 0 and one route per vehicle
                      const validRoutes = routes.filter(route => {
                        const duration = route.route_data?.route_travel_duration || route.route_data?.route_duration || route.total_duration || 0;
                        return duration > 0;
                      });
                      
                      // Group by vehicle_id and keep only one route per vehicle
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
                    })()}
                  </p>
                </div>
                <Route className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Optimization Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Optimización de Rutas</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsPreviousRunsDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  disabled={isLoadingRuns}
                >
                  <History className="w-4 h-4 mr-2" />
                  Ejecuciones Anteriores
                </Button>
                <Button
                  onClick={handleOptimizeRoutes}
                  disabled={isOptimizing || pickupPoints.length < 2 || vehicles.length === 0}
                  className="bg-primary hover:bg-primary/90"
                  size="sm"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Optimizando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Optimizar Rutas
                    </>
                  )}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(pickupPoints.length < 2 || vehicles.length === 0) && (
              <p className="text-sm text-muted-foreground text-center">
                {pickupPoints.length < 2 && "Necesitas al menos 2 puntos de recogida. "}
                {vehicles.length === 0 && "Necesitas configurar al menos 1 vehículo."}
              </p>
            )}
            {(pickupPoints.length >= 2 && vehicles.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="start-time" className="text-sm font-medium whitespace-nowrap">
                    Hora de Inicio General:
                  </Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={generalStartTime}
                    onChange={(e) => setGeneralStartTime(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-xs text-muted-foreground">
                    (Se usará para calcular las horas de llegada en el Excel)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Temporarily hidden - Nextmv JSON Section */}
        {/* {nextmvJson && (
          <Card className="mb-6">
            <CardHeader 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setShowNextmvJson(!showNextmvJson)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5" />
                  JSON enviado a Nextmv
                </CardTitle>
                {showNextmvJson ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </div>
            </CardHeader>
            {showNextmvJson && (
              <CardContent className="space-y-4">
                {nextmvEndpoint && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Endpoint:</p>
                    <div className="bg-muted p-3 rounded-lg">
                      <code className="text-sm text-primary font-mono break-all">
                        {nextmvEndpoint}
                      </code>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold mb-2">Payload JSON:</p>
                  <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm max-h-96">
                    <code>{JSON.stringify(nextmvJson, null, 2)}</code>
                  </pre>
                </div>
              </CardContent>
            )}
          </Card>
        )} */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Tabs defaultValue="pickup-points" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="pickup-points" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Puntos de Recogida
                </TabsTrigger>
                <TabsTrigger value="vehicles" className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Vehículos
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pickup-points" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Puntos de Recogida
                    </CardTitle>
                    <div className="flex flex-col gap-2 overflow-hidden" style={{ marginTop: '32px' }}>
                      <div className="flex gap-2 flex-wrap">
                        <label htmlFor="excel-upload" className="cursor-pointer flex-shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer px-3 whitespace-nowrap"
                            onClick={() => document.getElementById("excel-upload")?.click()}
                          >
                            <Upload className="w-4 h-4 mr-1.5" />
                            Subir Excel
                          </Button>
                          <input
                            id="excel-upload"
                            type="file"
                            accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            onChange={handleFileInputChange}
                            className="hidden"
                          />
                        </label>
                        <Button
                          onClick={() => {
                            setEditingPickupPoint(null);
                            setIsPickupPointDialogOpen(true);
                          }}
                          size="sm"
                          className="px-3 whitespace-nowrap flex-shrink-0"
                        >
                          <Plus className="w-4 h-4 mr-1.5" />
                          Agregar Punto
                        </Button>
                      </div>
                      {pickupPoints.length > 0 && (
                        <AlertDialog open={isDeleteAllPointsDialogOpen} onOpenChange={setIsDeleteAllPointsDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="px-3 whitespace-nowrap flex-shrink-0 w-fit"
                            >
                              <Trash2 className="w-4 h-4 mr-1.5" />
                              Eliminar Todos
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar todos los puntos?</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Estás seguro de que deseas eliminar todos los {pickupPoints.length} puntos de recogida? Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDeleteAllPickupPoints}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar Todos
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <PickupPointsList 
                      points={pickupPoints} 
                      onRemove={handleRemovePickupPoint}
                      onPointClick={(point) => setFocusedPoint(point)}
                      onEdit={handleEditPickupPoint}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="vehicles" className="mt-0">
                <VehicleConfig 
                  onAdd={handleAddVehicle}
                  onUpdate={handleUpdateVehicle}
                  onDelete={handleDeleteVehicle}
                  onDeleteAll={handleDeleteAllVehicles}
                  vehicles={vehicles}
                  onMapClickMode={handleVehicleLocationMapClick}
                  onLocationUpdate={handleVehicleLocationUpdate}
                  isDialogOpen={isVehicleDialogOpen}
                  setIsDialogOpen={setIsVehicleDialogOpen}
                  onVehicleExcelUpload={handleVehicleExcelUpload}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-2 relative">
            <Card className="h-[calc(100vh-240px)]">
              <CardContent className="p-0 h-full">
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
                  onMapClick={handleMapClick}
                  clickMode={clickMode || vehicleLocationMode !== null}
                  focusedPoint={focusedPoint}
                  vehicleLocationMode={vehicleLocationMode}
                  vehicleStartLocation={currentVehicleStartLocation}
                  vehicleEndLocation={currentVehicleEndLocation}
                />
              </CardContent>
            </Card>
            
            {/* Selected Optimization Info Overlay */}
            {selectedRunId && selectedRunData && (
              <Card className="absolute top-4 left-4 z-20 shadow-lg max-w-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Optimización Seleccionada
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setSelectedRunId(null);
                        setSelectedRunData(null);
                        setRoutes([]);
                        setVisibleRoutes(new Set());
                        supabase
                          .from("routes")
                          .delete()
                          .gte("created_at", "1970-01-01");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">ID de Ejecución</p>
                    <p className="font-mono text-xs">{selectedRunId}</p>
                  </div>
                  {(selectedRunData.metadata?.created_at || selectedRunData.created_at) && (
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
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <p className="text-muted-foreground text-xs">Vehículos</p>
                      <p className="text-lg font-bold">
                        {selectedRunData.output?.solutions?.[0]?.vehicles?.length || 
                         selectedRunData.solutions?.[0]?.vehicles?.length || 
                         routes.length || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Rutas</p>
                      <p className="text-lg font-bold">{getValidRouteCount}</p>
                    </div>
                  </div>
                  {(selectedRunData.metadata?.status || selectedRunData.status) && (
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
            )}
            
            <Button
              onClick={() => setClickMode(!clickMode)}
              variant={clickMode ? "default" : "outline"}
              className="absolute top-4 right-4 z-20 shadow-lg"
              size="lg"
            >
              <MousePointerClick className="w-4 h-4 mr-2" />
              {clickMode ? "Exit Click Mode" : "Click to Add Points"}
            </Button>
          </div>
        </div>
      </main>

      {/* Pickup Point Form Dialog */}
      <Dialog open={isPickupPointDialogOpen} onOpenChange={setIsPickupPointDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPickupPoint ? "Editar Punto de Recogida" : "Agregar Punto de Recogida"}
            </DialogTitle>
          </DialogHeader>
          <PickupPointForm 
            onAdd={handleAddPickupPoint} 
            editingPoint={editingPickupPoint}
            onCancelEdit={handleCancelEditPickupPoint}
          />
        </DialogContent>
      </Dialog>

      {/* Previous Optimizations Dialog */}
      <Dialog open={isPreviousRunsDialogOpen} onOpenChange={setIsPreviousRunsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Ejecuciones Anteriores
              </span>
              <div className="flex gap-2">
                <Button
                  onClick={loadRuns}
                  variant="outline"
                  size="sm"
                  disabled={isLoadingRuns}
                >
                  {isLoadingRuns ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Actualizar"
                  )}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingRuns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay ejecuciones disponibles
              </p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {runs.map((run) => {
                  const runId = run.id || run.run_id;
                  const status = run.metadata?.status || run.status || "unknown";
                  const createdAt = run.metadata?.created_at || run.created_at || "";
                  const isSelected = selectedRunId === runId;
                  
                  // Format status for display
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
                      onClick={() => {
                        handleRunSelect(runId);
                        setIsPreviousRunsDialogOpen(false);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">ID: {runId}</p>
                            <p className="text-xs opacity-80 mt-1">
                              {statusDisplay} | {createdAt ? new Date(createdAt).toLocaleString('es-ES', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : "Fecha desconocida"}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
