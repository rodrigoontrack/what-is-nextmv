import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getPickupPoints, createPickupPoint, updatePickupPoint, deletePickupPoint, getOptimizations, getOptimization, createOptimization, getRoutesByOptimization, createRoute, createStop, createVehicleOptimization, createRouteRecord, createSchedule, createRouteSchedule, createRouteScheduleVehicle, createBusStop, getOrganization} from "@/lib/api";
import Map from "@/components/Map";
import PickupPointForm from "@/components/PickupPointForm";
import VehicleConfig from "@/components/VehicleConfig";
import PickupPointsList from "@/components/PickupPointsList";
import Layout from "@/components/Layout";
import { Play, MapPin, Truck, Route, MousePointerClick, ChevronDown, ChevronUp, Code, ArrowLeft, Plus, History, X, Upload, Trash2, Download, Settings, Menu, ZoomIn } from "lucide-react";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  grupo?: string;
  all_nombres?: string[]; // All passenger names when quantity >= 2
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

const SESSION_KEY = 'optimizador_session';

const Index = () => {
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const sessionSaved = useRef(false);
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
  const [previewJsonDialogOpen, setPreviewJsonDialogOpen] = useState(false);
  const [optimizationConfig, setOptimizationConfig] = useState({
    travelType: "distance" as "distance" | "time",
    solveDuration: "10s"
  });
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunData, setSelectedRunData] = useState<any | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isNewRunMode, setIsNewRunMode] = useState(false);
  const [isPickupPointDialogOpen, setIsPickupPointDialogOpen] = useState(false);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isDeleteAllPointsDialogOpen, setIsDeleteAllPointsDialogOpen] = useState(false);
  const [visibleRoutes, setVisibleRoutes] = useState<Set<number>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [focusLocation, setFocusLocation] = useState<{ lon: number; lat: number } | null>(null);
  const [zoomToRoute, setZoomToRoute] = useState<number | null>(null);
  const [orgCenter, setOrgCenter] = useState<[number, number]>([-74.0721, 4.7110]); // default Bogotá until org loads
  const [orgCenterReady, setOrgCenterReady] = useState(false);
  const [pendingRouteData, setPendingRouteData] = useState<{
    vehicleMap: Record<string, any>;
    optimizationId: number | null;
  } | null>(null);
  const [selectedVehicleForSave, setSelectedVehicleForSave] = useState<any>(null);
  const [isSaveRouteDialogOpen, setIsSaveRouteDialogOpen] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [routeFormName, setRouteFormName] = useState('');
  const [routeFormCode, setRouteFormCode] = useState('');
  const [routeFormType, setRouteFormType] = useState(0);
  const [routeFormCategory, setRouteFormCategory] = useState(0);
  const [scheduleFormName, setScheduleFormName] = useState('');
  const [scheduleFormDays, setScheduleFormDays] = useState({ monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false });
  const [scheduleFormStartTime, setScheduleFormStartTime] = useState('');
  const [scheduleFormEndTime, setScheduleFormEndTime] = useState('');
  const { toast } = useToast();

  // Calculate total passengers from pickup points
  // Use quantity if available (sum of all quantities), otherwise count unique person_ids
  const totalPassengers = useMemo(() => {
    // First, try to sum quantities (more accurate if available)
    const totalQuantity = pickupPoints.reduce((sum, point) => {
      const qty = point.quantity || 1; // Default to 1 if quantity is not set
      return sum + qty;
    }, 0);
    
    // If we have quantities, use that (more accurate)
    if (totalQuantity > 0) {
      return totalQuantity;
    }
    
    // Fallback: count unique person_ids if quantity is not available
    const personIds = new Set<string>();
    pickupPoints.forEach((point) => {
      if (point.person_id) {
        // person_id might be comma-separated
        const ids = point.person_id.split(',').map(id => id.trim()).filter(id => id);
        ids.forEach(id => personIds.add(id));
      }
    });
    
    // If we have person_ids, return count, otherwise return 0
    return personIds.size > 0 ? personIds.size : 0;
  }, [pickupPoints]);

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

  // City code → [lng, lat] fallback table
  const CITY_COORDS: Record<string, [number, number]> = {
    BOG: [-74.0721, 4.7110],   // Bogotá, Colombia
    MDE: [-75.5812, 6.2442],   // Medellín, Colombia
    CLO: [-76.5320, 3.4516],   // Cali, Colombia
    BAQ: [-74.7964, 10.9639],  // Barranquilla, Colombia
    MEX: [-99.1332, 19.4326],  // Mexico City
    GDL: [-103.3496, 20.6597], // Guadalajara
    MTY: [-100.3161, 25.6866], // Monterrey
    LIM: [-77.0428, -12.0464], // Lima, Peru
    SCL: [-70.6693, -33.4489], // Santiago, Chile
    BOE: [-58.3816, -34.6037], // Buenos Aires
    SAO: [-46.6333, -23.5505], // São Paulo
    RIO: [-43.1729, -22.9068], // Rio de Janeiro
    MAD: [-3.7038, 40.4168],   // Madrid
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.routes?.length > 0) {
          setRoutes(session.routes);
          setVisibleRoutes(new Set(session.visibleRoutes || []));
          setPickupPoints(session.pickupPoints || []);
          setVehicles(session.vehicles || []);
          if (session.pendingRouteData) setPendingRouteData(session.pendingRouteData);
          if (session.selectedRunData) setSelectedRunData(session.selectedRunData);
          if (session.selectedRunId) setSelectedRunId(session.selectedRunId);
        }
      }
    } catch {
      // ignore corrupt data
    }
    sessionSaved.current = true;
  }, []);

  // Save session to localStorage whenever key state changes (skip first render)
  useEffect(() => {
    if (!sessionSaved.current) return;
    if (routes.length === 0) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        routes,
        pickupPoints,
        vehicles,
        pendingRouteData,
        selectedRunData,
        selectedRunId,
        visibleRoutes: [...visibleRoutes],
      }));
    } catch {
      // quota exceeded or other storage error
    }
  }, [routes, pickupPoints, vehicles, pendingRouteData, selectedRunData, selectedRunId, visibleRoutes]);

  useEffect(() => {
    loadRuns();
    getOrganization(321)
      .then((org: any) => {
        if (org.longitude && org.latitude) {
          setOrgCenter([Number(org.longitude), Number(org.latitude)]);
        } else if (org.city && CITY_COORDS[org.city]) {
          setOrgCenter(CITY_COORDS[org.city]);
        }
      })
      .catch(() => { /* keep default Bogotá center */ })
      .finally(() => setOrgCenterReady(true));
  }, []);


  const loadRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const optimizationsData = await getOptimizations();
      const runsList = (optimizationsData || []).map((opt: any) => ({
        id: String(opt.id),
        optimization_id: opt.id,
        metadata: { created_at: opt.created_at, id: opt.id },
        created_at: opt.created_at,
        result_json: opt.optimization_result,
      }));
      setRuns(runsList);
      console.log(`Loaded ${runsList.length} optimizations from API`);
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
    setIsNewRunMode(false);
    setIsOptimizing(true);

    try {
      const selectedRun = runs.find(r => r.id === runId || r.optimization_id === runId);
      const optimizationId = selectedRun?.optimization_id;

      if (!optimizationId) throw new Error("No se encontró la optimización");

      const optimizationData = await getOptimization(optimizationId);
      setSelectedRunData(optimizationData?.optimization_result || optimizationData);

      const routesData = await getRoutesByOptimization(optimizationId);

      if (!routesData || routesData.length === 0) {
        throw new Error("No se encontraron rutas para esta optimización");
      }

      const transformedRoutes = routesData.map((route: any) => {
        const routeDistance = route.distance ? Number(route.distance) : 0;
        const routeTime = route.time ? Number(route.time) : 0;
        const routeData = {
          id: route.nextmv_id,
          route: [],
          route_travel_distance: routeDistance,
          route_travel_duration: routeTime,
        };
        return {
          id: route.id,
          vehicle_id: route.fk_vehicle_optimization || null,
          route_data: routeData,
          stops: [],
          total_distance: routeDistance,
          total_duration: routeTime,
          created_at: route.created_at,
          name: route.nextmv_id,
        };
      });

      console.log(`✅ Loaded ${transformedRoutes.length} routes from API`);
      setRoutes(transformedRoutes);
      setVisibleRoutes(new Set(transformedRoutes.map((_: any, index: number) => index)));

      toast({
        title: "Ejecución cargada",
        description: "Las rutas de la ejecución seleccionada se han cargado exitosamente",
      });
    } catch (error) {
      console.error("Error loading optimization:", error);
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
      const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

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
    console.log("=== EXCEL EXPORT STARTED ===");
    console.log("Routes count:", routes.length);
    console.log("Routes data:", routes);
    
    if (routes.length === 0) {
      toast({
        title: "Error",
        description: "No hay rutas disponibles para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      console.log("Workbook created");

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
      const filename = `optimizacion_${selectedRunId || timestamp}_${timestamp}.xlsx`;

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
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo exportar el archivo Excel",
        variant: "destructive",
      });
    }
  };

  const loadPickupPoints = async () => {
    try {
      const data = await getPickupPoints();
      const normalizedData = (data || []).map((point: any) => ({
        ...point,
        id: String(point.id),
        name: point.address || `${point.latitude}, ${point.longitude}`,
        quantity: point.quantity != null && !isNaN(point.quantity) ? Number(point.quantity) : 1,
      }));
      console.log(`=== PUNTOS CARGADOS DESDE API: ${normalizedData.length} ===`);
      setPickupPoints(normalizedData);
    } catch (error) {
      console.error("Error loading pickup points:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los puntos de recogida",
        variant: "destructive",
      });
    }
  };

  const loadVehicles = async () => {
    // Vehicles are configured per session by plate — no preload needed
  };


  const handleAddPickupPoint = async (point: Omit<PickupPoint, "id"> & { id?: string }) => {
    if (editingPickupPoint) {
      const { id, ...updateData } = point;
      const quantity = updateData.quantity != null && !isNaN(updateData.quantity)
        ? Math.max(1, Math.floor(updateData.quantity)) : 1;
      try {
        const updated = await updatePickupPoint(Number(editingPickupPoint.id), {
          latitude: updateData.latitude,
          longitude: updateData.longitude,
          address: updateData.address,
          quantity,
        });
        const updatedPoint: PickupPoint = {
          ...editingPickupPoint,
          ...updated,
          id: String(updated.id),
          name: updated.address || `${updated.latitude}, ${updated.longitude}`,
          quantity,
        };
        setPickupPoints(pickupPoints.map((p) => (p.id === editingPickupPoint.id ? updatedPoint : p)));
      } catch (error) {
        console.error("Error updating pickup point:", error);
        toast({ title: "Error", description: "No se pudo actualizar el punto", variant: "destructive" });
      }
      setEditingPickupPoint(null);
      setIsPickupPointDialogOpen(false);
    } else {
      const { id, ...insertData } = point;
      const quantity = insertData.quantity !== undefined && insertData.quantity !== null
        ? Math.max(1, Math.floor(insertData.quantity)) : 1;
      try {
        const created = await createPickupPoint({
          latitude: insertData.latitude,
          longitude: insertData.longitude,
          address: insertData.address || `${insertData.latitude}, ${insertData.longitude}`,
          quantity,
        });
        const newPoint: PickupPoint = {
          ...created,
          id: String(created.id),
          name: created.address || `${created.latitude}, ${created.longitude}`,
          quantity,
        };
        setPickupPoints([...pickupPoints, newPoint]);
      } catch (error) {
        console.error("Error creating pickup point:", error);
        toast({ title: "Error", description: "No se pudo crear el punto", variant: "destructive" });
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
      await Promise.all(pickupPoints.map((p) => deletePickupPoint(Number(p.id))));
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

  const handleDownloadPickupPointTemplate = () => {
    const data = [
      ["nombre", "direccion", "latitud", "longitud", "cedula", "grupo"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Puntos de Recogida");
    XLSX.writeFile(wb, "plantilla_puntos_recogida.xlsx");
  };

  const handleExcelUpload = async (file: File) => {
    try {
      // First, delete all existing pickup points
      await Promise.all(pickupPoints.map((p) => deletePickupPoint(Number(p.id)).catch(() => {})));
      setPickupPoints([]);
      console.log("Puntos existentes eliminados");

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
      
      // Read headers from the first row directly (independent of data rows)
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      if (!rawRows || rawRows.length === 0) {
        toast({
          title: "Error",
          description: "El archivo Excel está vacío o no tiene formato válido",
          variant: "destructive",
        });
        return;
      }

      // Convert data rows to objects with defVal so empty cells are included
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      // Group points by latitude and longitude, summing quantities
      interface PointData {
        latitude: number;
        longitude: number;
        quantity: number;
        person_id?: string; // Store person_id(s) - comma-separated if multiple
        grupo?: string; // Store grupo if available
        nombre?: string; // Store nombre if available
        direccion?: string; // Store direccion if available
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pointMap: any = {};
      
      // Detect column names from the header row (not data rows)
      const allKeys: string[] = (rawRows[0] || []).map((k: any) => String(k ?? "").trim()).filter((k: string) => k !== "");
      
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
          return normalized === "cedula" || normalized === "cédula" ||
                 normalized === "persona id" || normalized === "persona_id" ||
                 normalized === "person id" || normalized === "person_id" ||
                 normalized === "id persona" || normalized === "id_persona" ||
                 normalized.includes("cedula") || normalized.includes("cédula") ||
                 normalized.includes("persona") && normalized.includes("id");
        }
      );
      const grupoKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "grupo" || normalized === "group" ||
                 normalized.includes("grupo");
        }
      );
      const nombreKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "nombre" || normalized.includes("nombre");
        }
      );
      const direccionKey = allKeys.find(
        key => {
          const normalized = key.toLowerCase().trim();
          return normalized === "direccion" || normalized === "dirección" || 
                 normalized.includes("direccion") || normalized.includes("dirección");
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

      console.log("Columnas detectadas:", { latitudeKey, longitudeKey, quantityKey: quantityKey || "no encontrada", personIdKey: personIdKey || "no encontrada", grupoKey: grupoKey || "no encontrada", nombreKey: nombreKey || "no encontrada", direccionKey: direccionKey || "no encontrada" });
      console.log(`Total de filas en Excel: ${jsonData.length}`);

      // STEP 1: Read and process ALL rows first, counting occurrences
      let processedRows = 0;
      let skippedRows = 0;
      
      // Map to track occurrences: key -> { lat, lon, count, occurrences, person_ids, grupo, nombres, direccion }
      const occurrenceMap: Record<string, {
        latitude: number;
        longitude: number;
        count: number; // Number of times this coordinate appears
        occurrences: number[]; // Track each occurrence for debugging
        person_ids: string[]; // Track person IDs at this location
        grupo?: string; // Store grupo if available
        nombres: string[]; // Track all names (nombres) at this location
        direccion?: string; // Store direccion if available
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
        // Extract grupo if available
        const grupo = grupoKey ? String(rowData[grupoKey] || "").trim() : undefined;
        // Extract nombre if available
        const nombre = nombreKey ? String(rowData[nombreKey] || "").trim() : undefined;
        // Extract direccion if available
        const direccion = direccionKey ? String(rowData[direccionKey] || "").trim() : undefined;
        
        if (occurrenceMap[key]) {
          // Increment count for duplicate coordinates
          const oldCount = occurrenceMap[key].count;
          occurrenceMap[key].count += 1;
          occurrenceMap[key].occurrences.push(occurrenceMap[key].count);
          // Add person_id if available and not already in the list
          if (personId && !occurrenceMap[key].person_ids.includes(personId)) {
            occurrenceMap[key].person_ids.push(personId);
          }
          // Add nombre if available and not already in the list
          if (nombre && !occurrenceMap[key].nombres.includes(nombre)) {
            occurrenceMap[key].nombres.push(nombre);
          }
          // Update grupo if available (use first non-empty value found)
          if (grupo && !occurrenceMap[key].grupo) {
            occurrenceMap[key].grupo = grupo;
          }
          // Update direccion if available (use first non-empty value found)
          if (direccion && !occurrenceMap[key].direccion) {
            occurrenceMap[key].direccion = direccion;
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
            grupo: grupo || undefined, // Store grupo if available
            nombres: nombre ? [nombre] : [], // Store nombre if available
            direccion: direccion || undefined, // Store direccion if available
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
        grupo: item.grupo, // Store grupo if available
        nombre: item.nombres.length > 0 
          ? (item.nombres.length === 1 ? item.nombres[0] : item.nombres.join(", ")) 
          : undefined, // Store single nombre or comma-separated if multiple
        direccion: item.direccion, // Store direccion if available
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
        
        // Use first nombre for name if available, otherwise default
        // If multiple nombres, use first one as primary name
        // Split by comma and clean up - handle both ", " and "," separators
        const nombres = point.nombre 
          ? point.nombre.split(/,/).map(n => n.trim()).filter(n => n.length > 0)
          : [];
        const name = `Punto ${index + 1}`;
        // Use direccion for address if available, otherwise use coordinates
        const address = point.direccion || `${lat}, ${lon}`;
        
        // Log passenger data for debugging
        if (nombres.length > 0 || point.person_id) {
          console.log(`📋 Point ${index + 1} (${lat}, ${lon}):`, {
            quantity,
            nombres: nombres.length,
            nombres_list: nombres,
            person_id: point.person_id,
            has_all_nombres: nombres.length > 0
          });
        }
        
        return {
          name: name,
          address: address,
          latitude: lat,
          longitude: lon,
          quantity: quantity, // This is the consolidated count
          person_id: point.person_id, // Include person_id if available
          grupo: point.grupo, // Include grupo if available
          // Store all nombres - always set if we have nombres, regardless of quantity
          // This ensures passengers can be created even for quantity = 1
          all_nombres: nombres.length > 0 ? nombres : undefined,
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
        
        // New schema only has: latitude, longitude, address, quantity
        // BUT we need to preserve all_nombres and person_id for localStorage and passenger creation
        const baseData: any = {
          latitude: lat,
          longitude: lon,
          address: pointData.address || `${lat}, ${lon}`,
          quantity: quantity, // ALWAYS include quantity - it's the consolidated count
          // Preserve passenger data for localStorage (not for database insert)
          all_nombres: pointData.all_nombres, // Keep for localStorage
          person_id: pointData.person_id, // Keep for localStorage
          name: pointData.name, // Keep name for localStorage
          grupo: pointData.grupo, // Keep grupo for localStorage
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
      
      // Log passenger data being saved
      const pointsWithPassengers = pointsWithIds.filter(p => p.all_nombres && p.all_nombres.length > 0);
      console.log("=== VERIFICACIÓN DE DATOS DE PASAJEROS ===");
      console.log(`Puntos con all_nombres: ${pointsWithPassengers.length}`);
      if (pointsWithPassengers.length > 0) {
        console.log("Ejemplos de puntos con all_nombres guardados:", pointsWithPassengers.slice(0, 5).map(p => ({
          name: p.name,
          quantity: p.quantity,
          all_nombres: p.all_nombres,
          person_id: p.person_id
        })));
      } else {
        console.warn("⚠️ ADVERTENCIA: No se encontraron puntos con all_nombres para guardar");
        // Show first few points to debug
        console.log("Primeros 5 puntos guardados:", pointsWithIds.slice(0, 5).map(p => ({
          name: p.name,
          quantity: p.quantity,
          has_all_nombres: !!p.all_nombres,
          all_nombres: p.all_nombres
        })));
      }
      
      // Save to localStorage
      localStorage.setItem('pickup_points', JSON.stringify(pointsWithIds));
      console.log("=== PUNTOS GUARDADOS EN LOCALSTORAGE ===");
      console.log(`Total puntos guardados: ${pointsWithIds.length}`);
      const pointsWithQtySaved = pointsWithIds.filter(p => p.quantity > 1);
      console.log(`Puntos con cantidad > 1: ${pointsWithQtySaved.length}`);
      
      if (pointsWithQtySaved.length > 0) {
        console.log("✅ Puntos guardados con cantidad > 1:", pointsWithQtySaved.slice(0, 5).map(p => ({
          name: p.name,
          quantity: p.quantity,
          has_all_nombres: !!p.all_nombres,
          all_nombres_count: p.all_nombres?.length || 0
        })));
      }
      
      // Try Supabase if available (optional)
      let insertedData: any[] | null = null;
      let insertError: any = null;
      
      // Insert all points to API
      const insertedResults = await Promise.all(
        allDataToInsert.map((p: any) => createPickupPoint({
          latitude: p.latitude,
          longitude: p.longitude,
          address: p.address,
          quantity: p.quantity,
        }).catch((err: any) => { console.warn("Error inserting point:", err); return null; }))
      );
      insertedData = insertedResults.filter(Boolean);
      const insertedCount = insertedData?.length || 0;
      console.log(`✅ Insertados en MySQL: ${insertedCount}`);

      // Merge DB response with local passenger data (all_nombres, person_id, name)
      // DB doesn't store these fields, so we keep them from the local data
      const mergedPoints = (insertedData || []).map((dbPoint: any, index: number) => {
        const localData = allDataToInsert[index];
        return {
          id: String(dbPoint.id),
          name: localData?.name || dbPoint.address || `${dbPoint.latitude},${dbPoint.longitude}`,
          address: dbPoint.address || "",
          latitude: Number(dbPoint.latitude),
          longitude: Number(dbPoint.longitude),
          quantity: dbPoint.quantity || 1,
          person_id: localData?.person_id,
          grupo: localData?.grupo,
          all_nombres: localData?.all_nombres,
        };
      });
      setPickupPoints(mergedPoints);

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
      
      // Read everything as arrays of arrays (header: 1) to avoid key mismatch
      const allRawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

      console.log("=== VEHICLE EXCEL UPLOAD ===");
      console.log("Total raw rows (including header):", allRawRows.length);
      console.log("Raw row 0 (header):", allRawRows[0]);
      console.log("Raw row 1 (first data):", allRawRows[1]);
      console.log("All raw rows:", JSON.stringify(allRawRows));

      if (!allRawRows || allRawRows.length < 2) {
        console.error("Not enough rows. allRawRows.length:", allRawRows?.length);
        toast({
          title: "Error",
          description: `El archivo Excel solo tiene ${allRawRows?.length ?? 0} fila(s). Se necesita al menos la cabecera y una fila de datos.`,
          variant: "destructive",
        });
        return;
      }

      // Find column indices from header row
      const headers: string[] = allRawRows[0].map((h: any) => String(h ?? "").toLowerCase().trim());
      const dataRows = allRawRows.slice(1).filter(row => row.some((cell: any) => String(cell ?? "").trim() !== ""));

      console.log("Normalized headers:", headers);
      console.log("Data rows after filtering empty:", dataRows.length);
      dataRows.forEach((row, i) => console.log(`Data row ${i}:`, row));

      const findIdx = (matchers: string[]) => {
        const idx = headers.findIndex(h => matchers.some(m => h === m || h.includes(m)));
        console.log(`findIdx(${matchers}) => ${idx} (header: "${headers[idx]}")`);
        return idx;
      };

      const placaIdx      = findIdx(["placa"]);
      const capacidadIdx  = findIdx(["capacidad"]);
      const distanciaIdx  = findIdx(["distancia"]);
      const inicioLatIdx  = findIdx(["inicio_latitud", "inicio_lat"]);
      const inicioLonIdx  = findIdx(["inicio_longitud", "inicio_lon"]);
      const finLatIdx     = findIdx(["fin_latitud", "fin_lat"]);
      const finLonIdx     = findIdx(["fin_longitud", "fin_lon"]);
      const grupoIdx      = findIdx(["grupo"]);

      if (placaIdx === -1 || capacidadIdx === -1 || distanciaIdx === -1) {
        console.error("Missing required columns:", { placaIdx, capacidadIdx, distanciaIdx });
        toast({
          title: "Error",
          description: `No se encontraron todas las columnas requeridas. Buscando: "placa", "capacidad", "distancia_maxima". Columnas encontradas: ${headers.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      // Process vehicles
      const vehiclesToInsert: Vehicle[] = [];
      let processedCount = 0;
      let skippedCount = 0;

      for (const row of dataRows) {
        const placa = String(row[placaIdx] ?? "").trim();
        const capacidad = parseFloat(String(row[capacidadIdx] ?? ""));
        const distanciaRaw = parseFloat(String(row[distanciaIdx] ?? ""));
        const distanciaMax = isNaN(distanciaRaw) ? 0 : distanciaRaw; // 0 = sin límite
        const grupo = grupoIdx !== -1 ? String(row[grupoIdx] ?? "").trim() : undefined;

        console.log("Processing row:", { placa, capacidad, distanciaMax, grupo, rawRow: row });

        if (!placa || isNaN(capacidad)) {
          console.warn("SKIPPED - invalid data:", { placa, capacidad, isNaN_cap: isNaN(capacidad) });
          skippedCount++;
          continue;
        }

        if (capacidad <= 0) {
          console.warn("SKIPPED - non-positive capacity:", { placa, capacidad });
          skippedCount++;
          continue;
        }

        // Parse optional start location
        let startLocation: { lon: number; lat: number } | undefined = undefined;
        if (inicioLatIdx !== -1 && inicioLonIdx !== -1) {
          const inicioLat = parseFloat(String(row[inicioLatIdx] ?? ""));
          const inicioLon = parseFloat(String(row[inicioLonIdx] ?? ""));
          if (!isNaN(inicioLat) && !isNaN(inicioLon) &&
              inicioLat >= -90 && inicioLat <= 90 &&
              inicioLon >= -180 && inicioLon <= 180) {
            startLocation = { lat: inicioLat, lon: inicioLon };
          }
        }

        // Parse optional end location
        let endLocation: { lon: number; lat: number } | undefined = undefined;
        if (finLatIdx !== -1 && finLonIdx !== -1) {
          const finLat = parseFloat(String(row[finLatIdx] ?? ""));
          const finLon = parseFloat(String(row[finLonIdx] ?? ""));
          if (!isNaN(finLat) && !isNaN(finLon) &&
              finLat >= -90 && finLat <= 90 &&
              finLon >= -180 && finLon <= 180) {
            endLocation = { lat: finLat, lon: finLon };
          }
        }

        const vehicle: Vehicle = {
          name: placa,
          capacity: Math.floor(capacidad),
          max_distance: distanciaMax,
          grupo: grupo || undefined, // Include grupo if available
        };

        // Add locations if provided
        if (startLocation) {
          vehicle.start_location = startLocation;
        }
        if (endLocation) {
          vehicle.end_location = endLocation;
        }

        vehiclesToInsert.push(vehicle);
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

      // Vehicles from Excel are loaded into local state only (validated by plate against DB)
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
      await deletePickupPoint(Number(pointId));
      setPickupPoints(pickupPoints.filter((p) => p.id !== pointId));
      toast({ title: "Punto eliminado", description: "El punto de recogida ha sido eliminado exitosamente" });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el punto de recogida", variant: "destructive" });
    }
  };

  const handleAddVehicle = (vehicle: Vehicle) => {
    const newVehicle = { ...vehicle, id: `local-${Date.now()}` };
    setVehicles([...vehicles, newVehicle]);
    setIsVehicleDialogOpen(false);
    if (vehicle.start_location) setCurrentVehicleStartLocation(vehicle.start_location);
    if (vehicle.end_location) setCurrentVehicleEndLocation(vehicle.end_location);
  };

  const handleUpdateVehicle = (vehicleId: string, vehicle: Vehicle) => {
    setVehicles(vehicles.map((v) => (v.id === vehicleId ? { ...vehicle, id: vehicleId } : v)));
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    setVehicles(vehicles.filter((v) => v.id !== vehicleId));
    toast({ title: "Vehículo eliminado", description: "El vehículo ha sido eliminado exitosamente" });
  };

  const handleDeleteAllVehicles = () => {
    if (vehicles.length === 0) {
      toast({ title: "Info", description: "No hay vehículos para eliminar" });
      return;
    }
    const vehiclesCount = vehicles.length;
    setVehicles([]);
    toast({ title: "Vehículos eliminados", description: `Se eliminaron ${vehiclesCount} vehículos exitosamente` });
  };

  // Build the JSON payload that will be sent to Nextmv (extracted for preview)
  const buildNextmvPayload = (skipValidation = false) => {
    if (!skipValidation) {
      if (pickupPoints.length < 2) {
        throw new Error("Necesitas al menos 2 puntos de recogida");
      }

      if (vehicles.length === 0) {
        throw new Error("Necesitas configurar al menos 1 vehículo");
      }
    }

    // Build the JSON payload that will be sent to Nextmv
    // Ensure all numeric values are explicitly numbers
    const nextmvRequest: any = {
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
          
          if (!skipValidation && (isNaN(lon) || isNaN(lat) || !isFinite(lon) || !isFinite(lat))) {
            throw new Error(`Invalid coordinates for point ${point.name || point.id}: longitude=${point.longitude}, latitude=${point.latitude}`);
          }
          
          // For preview, use default coordinates if invalid
          const finalLon = (isNaN(lon) || !isFinite(lon)) ? 0 : lon;
          const finalLat = (isNaN(lat) || !isFinite(lat)) ? 0 : lat;
          
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
              lon: Number(finalLon),
              lat: Number(finalLat)
            },
            quantity: nextmvQuantity // Negative value for Nextmv API
          };
        }),
        vehicles: (vehicles.length > 0 ? vehicles : []).map((vehicle, index) => {
          // Get start location from vehicle config only (don't use fallbacks)
          // Only include start_location if it was explicitly set
          let startLocation: { lon: number; lat: number } | undefined;
          if (vehicle.start_location) {
            startLocation = vehicle.start_location;
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
          
          if (!skipValidation) {
            if (isNaN(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
              throw new Error(`Invalid capacity for vehicle ${vehicle.name || vehicle.id}: ${vehicle.capacity}`);
            }
            
            if (isNaN(maxDistance) || maxDistance <= 0 || !isFinite(maxDistance)) {
              throw new Error(`Invalid max_distance for vehicle ${vehicle.name || vehicle.id}: ${vehicle.max_distance}`);
            }
          }
          
          const vehiclePayload: any = {
            id: String(vehicle.id || `vehicle-${index}`),
            capacity: Number(capacity), // Capacity should be an integer
            max_distance: Number(maxDistance),
            speed: Number(10) // Speed in m/s (10 m/s = 36 km/h)
          };
          
          // Add start location only if explicitly specified
          if (startLocation) {
            vehiclePayload.start_location = {
              lon: Number(startLocation.lon),
              lat: Number(startLocation.lat)
            };
          }
          
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
      const nextmvPayload: any = {
        input: nextmvRequest,
        options: {
          "solve.duration": optimizationConfig.solveDuration
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
            } else if (key === 'start_location' || key === 'location' || key === 'config') {
              result[key] = validateAndFixTypes(value);
            } else if (key === 'travel_type') {
              // Preserve travel_type as string
              result[key] = value;
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
      console.log("Optimization config:", optimizationConfig);
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
    const nextmvPath = "/v1/applications/workspace-dgxjzzgctd/runs";
    const nextmvEndpoint = "/api/nextmv" + nextmvPath; // Use proxy in development
    const nextmvFullUrl = "https://api.cloud.nextmv.io" + nextmvPath; // Full URL for display

    return {
      payload: cleanPayload,
      endpoint: nextmvFullUrl,
    };
  };

  const handlePreviewJson = () => {
    try {
      // Skip validation for preview - allow preview even if data is incomplete
      const { payload, endpoint } = buildNextmvPayload(true);
      setNextmvJson(payload);
      setNextmvEndpoint(endpoint);
      setPreviewJsonDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo generar el JSON",
        variant: "destructive",
      });
    }
  };

  // Keyboard shortcut for preview (Ctrl+Shift+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        handlePreviewJson();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regenerate JSON whenever the preview dialog opens to ensure it shows current data
  useEffect(() => {
    if (previewJsonDialogOpen) {
      try {
        // Regenerate JSON with current data whenever dialog opens
        const { payload, endpoint } = buildNextmvPayload(true);
        setNextmvJson(payload);
        setNextmvEndpoint(endpoint);
      } catch (error) {
        console.error("Error regenerating JSON preview:", error);
        // Don't show error toast here - just log it, dialog will show existing data or empty
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewJsonDialogOpen, vehicles, pickupPoints, optimizationConfig]);

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
      // STEP 1: pickup_points already exist in MySQL — map local IDs to DB records
      console.log("=== MAPPING LOCAL PICKUP_POINTS TO DB ===");
      const MapConstructor = globalThis.Map || window.Map;
      const localPointToDbPickupPointMap = new MapConstructor<string, any>();
      const passengerMap = new MapConstructor<string, any>();
      for (const localPoint of pickupPoints) {
        localPointToDbPickupPointMap.set(localPoint.id, localPoint);
      }
      console.log(`✅ Mapped ${localPointToDbPickupPointMap.size} pickup_points`);
      
      // Build the JSON payload using the extracted function
      const { payload: cleanPayload, endpoint: nextmvFullUrl } = buildNextmvPayload();
      setNextmvJson(cleanPayload);
      setNextmvEndpoint(nextmvFullUrl);
      const nextmvPath = "/v1/applications/workspace-dgxjzzgctd/runs";
      const nextmvEndpoint = "/api/nextmv" + nextmvPath; // Use proxy in development
      
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

      // Get the Nextmv run ID
      const nextmvRunId = runId || data.id || data.metadata?.id || null;
      if (!nextmvRunId) {
        console.warn("No Nextmv run ID found, cannot save optimization to database");
      }

      // Store the optimization ID for loading routes later
      let savedOptimizationId: string | null = null;

      // Save to new database schema
      // NOTE: pickup_points and passengers were already created BEFORE calling Nextmv
      try {
        // Helper function to extract original point ID from encoded stop ID
        const extractOriginalPointId = (stopId: string): string => {
          if (!stopId) return stopId;
          const index = stopId.indexOf('__person_');
          return index > -1 ? stopId.substring(0, index) : stopId;
        };

        // Create mapping from stop IDs to already-created pickup_points
        // Use the localPointToDbPickupPointMap we created before Nextmv
        const stopIdToPickupPointMap = new MapConstructor<string, any>();
        const stopsFromPayload = cleanPayload.input.stops || [];
        
        console.log(`Linking ${stopsFromPayload.length} stops to already-created pickup_points...`);
        
        for (const stop of stopsFromPayload) {
          const stopId = stop.id;
          const originalPointId = extractOriginalPointId(stopId);
          const dbPickupPoint = localPointToDbPickupPointMap.get(originalPointId);
          
          if (dbPickupPoint) {
            stopIdToPickupPointMap.set(stopId, dbPickupPoint);
            console.log(`✅ Linked stop ${stopId} to pickup_point ${dbPickupPoint.id}`);
          } else {
            console.warn(`⚠️ No pickup_point found for stop ${stopId} (original: ${originalPointId})`);
          }
        }

        // STEP 2: Create vehicle_optimization records
        const vehicleMap = new MapConstructor<string, any>();
        console.log(`=== STEP 2: Creating ${vehicles.length} vehicle_optimization records ===`);
        console.log("Vehicles from state:", vehicles.map((v, i) => ({ index: i, id: v.id, name: v.name })));
        console.log("Solution vehicles from Nextmv:", (solution.vehicles || []).map((v: any) => ({ id: v.id })));
        for (let index = 0; index < vehicles.length; index++) {
          const localVehicle = vehicles[index];
          const plate = localVehicle.name || `vehicle-${index}`;
          const nextmvVehicleId = String(localVehicle.id || `vehicle-${index}`);
          console.log(`STEP 2 — Vehicle ${index}: plate="${plate}", nextmvVehicleId="${nextmvVehicleId}"`);
          try {
            const payload = {
              fk_vehicle: plate,
              max_distance: localVehicle.max_distance || null,
              start_latitude: localVehicle.start_location?.lat || null,
              start_longitude: localVehicle.start_location?.lon || null,
              end_latitude: localVehicle.end_location?.lat || null,
              end_longitude: localVehicle.end_location?.lon || null,
            };
            console.log(`STEP 2 — sending vehicle payload:`, payload);
            const vehicleData = await createVehicleOptimization(payload);
            vehicleMap.set(nextmvVehicleId, vehicleData);
            console.log(`✅ STEP 2 — Created vehicle_optimization id=${vehicleData.id} for plate="${plate}"`);
          } catch (err: any) {
            console.error(`❌ STEP 2 — Error creating vehicle_optimization for "${plate}":`, err?.message || err);
          }
        }
        console.log(`=== STEP 2 DONE: vehicleMap has ${vehicleMap.size} entries:`, Array.from(vehicleMap.keys()));

        // STEP 3: Create optimization record
        let optimizationRecord: any = null;
        try {
          console.log("=== STEP 3: Creating optimization record ===");
          optimizationRecord = await createOptimization({ optimization_result: data });
          savedOptimizationId = optimizationRecord.id;
          console.log(`✅ STEP 3 — Created optimization id=${optimizationRecord.id}`);
        } catch (err: any) {
          console.error("❌ STEP 3 — Error creating optimization:", err?.message || err);
        }

        // STEP 4: Store pending data for per-route save
        const vehicleMapObj: Record<string, any> = {};
        for (const [key, value] of vehicleMap) {
          vehicleMapObj[key] = value;
        }
        setPendingRouteData({
          vehicleMap: vehicleMapObj,
          optimizationId: optimizationRecord?.id ?? null,
        });
        console.log(`✅ Optimization ready to save. vehicleMap has ${vehicleMap.size} entries.`);
      } catch (dbError) {
        console.error("Error saving to MySQL:", dbError);
      }

      // Display routes from Nextmv solution directly
      const seenVehicles = new Set<string | null>();
      const routesFromSolution = (solution.vehicles || [])
        .filter((vehicle: any, index: number) => {
          const vehicleId = vehicle.id || `vehicle-${index}`;
          if (seenVehicles.has(vehicleId)) return false;
          seenVehicles.add(vehicleId);
          return true;
        })
        .map((vehicle: any, filteredIndex: number) => {
          const originalVehicle = vehicles.find((v) => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
          return {
            id: `temp-${filteredIndex}-${Date.now()}`,
            vehicle_id: originalVehicle?.id || null,
            route_data: vehicle,
            total_distance: vehicle.route_travel_distance || 0,
            total_duration: vehicle.route_travel_duration || vehicle.route_duration || 0,
            created_at: new Date().toISOString(),
          };
        });
      setRoutes(routesFromSolution);
      setVisibleRoutes(new Set(routesFromSolution.map((_: any, index: number) => index)));

      toast({
        title: "Rutas optimizadas",
        description: "Las rutas han sido calculadas exitosamente",
      });
      
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

  const handleSaveRoute = async () => {
    if (!pendingRouteData || !routeFormName.trim() || !selectedVehicleForSave) return;
    setIsSavingRoute(true);

    const extractOriginalPointId = (stopId: string): string => {
      const idx = stopId.indexOf('__person_');
      return idx > -1 ? stopId.substring(0, idx) : stopId;
    };

    try {
      // 1. Create route record
      const routeRecord = await createRouteRecord({
        name: routeFormName.trim(),
        code: routeFormCode.trim() || null,
        type: routeFormType,
        category: routeFormCategory,
        fk_organization: 321,
      });
      console.log(`✅ Created route id=${routeRecord.id}`);

      // 2. Create schedule record
      const scheduleRecord = await createSchedule({
        name: scheduleFormName.trim() || routeFormName.trim(),
        ...scheduleFormDays,
        start_time: scheduleFormStartTime || null,
        end_time: scheduleFormEndTime || null,
        fk_organization: 321,
      });
      console.log(`✅ Created schedule id=${scheduleRecord.id}`);

      // 3. Create route_schedule (links route + schedule)
      const routeScheduleRecord = await createRouteSchedule({
        fk_route: routeRecord.id,
        fk_schedule: scheduleRecord.id,
        firebase_trace_url: null,
      });
      console.log(`✅ Created route_schedule id=${routeScheduleRecord.id}`);

      // 4. Create route_schedule_vehicle using the plate directly as fk_vehicle
      const { vehicleMap, optimizationId } = pendingRouteData;
      const vehicleNextmvId = selectedVehicleForSave.id;
      const dbVehicle = vehicleMap[vehicleNextmvId];
      if (!dbVehicle) throw new Error(`No se encontró vehicle_optimization para "${vehicleNextmvId}"`);

      const vehiclePlate = dbVehicle.fk_vehicle; // plate stored from Excel's "placa" column
      await createRouteScheduleVehicle({
        fk_vehicle: vehiclePlate,
        fk_route_schedule: routeScheduleRecord.id,
      });
      console.log(`✅ Created route_schedule_vehicle fk_vehicle="${vehiclePlate}"`);

      // 5. Create route_optimization for this vehicle
      const routeData = await createRoute({
        nextmv_id: `${Date.now()}-route-${vehicleNextmvId}`,
        fk_optimization: optimizationId ?? null,
        fk_vehicle_optimization: dbVehicle.id,
        fk_route: routeRecord.id,
        distance: Number(selectedVehicleForSave.route_travel_distance || selectedVehicleForSave.route_distance || 0),
        time: Number(selectedVehicleForSave.route_travel_duration || selectedVehicleForSave.route_duration || 0),
      });
      console.log(`✅ Created route_optimization id=${routeData.id}`);

      // 3. Create bus_stop + stop_optimization for each stop of this vehicle
      let stopOrder = 0;
      for (const routeStop of selectedVehicleForSave.route || []) {
        const stopNextmvId = routeStop.stop?.id;
        if (!stopNextmvId || stopNextmvId.includes("-end")) continue;
        const originalStopId = extractOriginalPointId(stopNextmvId);
        const dbPickupPoint = pickupPoints.find(p => p.id === originalStopId);
        if (!dbPickupPoint) continue;
        try {
          // Create bus_stop record with coordinates from pickup_point
          const busStopRecord = await createBusStop({
            latitude: dbPickupPoint.latitude,
            longitude: dbPickupPoint.longitude,
            address: dbPickupPoint.address || null,
            next_stop: stopOrder,
            fk_route_schedule: routeScheduleRecord.id,
            special: 0,
          });
          // Create stop_optimization linking bus_stop + pickup_point
          await createStop({
            order: stopOrder++,
            fk_pickup_point: Number(dbPickupPoint.id),
            fk_route_optimization: routeData.id,
            fk_bus_stop: busStopRecord.id,
          });
        } catch (err: any) {
          console.error(`Error creating stop:`, err?.message);
        }
      }

      toast({ title: "Ruta guardada", description: `"${routeFormName.trim()}" guardada exitosamente.` });
      setIsSaveRouteDialogOpen(false);
      setRouteFormName('');
      setRouteFormCode('');
      setRouteFormType(0);
      setRouteFormCategory(0);
      setScheduleFormName('');
      setScheduleFormDays({ monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false });
      setScheduleFormStartTime('');
      setScheduleFormEndTime('');
      setSelectedVehicleForSave(null);
      // Keep pendingRouteData so other routes can still be saved
    } catch (err: any) {
      console.error("Error saving route:", err);
      toast({ title: "Error al guardar", description: err?.message || "No se pudo guardar la ruta.", variant: "destructive" });
    } finally {
      setIsSavingRoute(false);
    }
  };

  return (
    <Layout>
        {/* Optimization Section */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>Optimización de Rutas</span>
              </div>
              <Button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                variant="outline"
                size="sm"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configurar parámetros
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Summary Section */}
            <div className="grid grid-cols-3 gap-2 mb-2 pb-2 border-b">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Puntos de Recogida:</p>
                  <p className="text-base font-bold">{pickupPoints.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-secondary-foreground flex-shrink-0" />
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Pasajeros:</p>
                  <p className="text-base font-bold">{totalPassengers}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-accent-foreground flex-shrink-0" />
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <p className="text-xs text-muted-foreground whitespace-nowrap">Vehículos:</p>
                  <p className="text-base font-bold">{vehicles.length}</p>
                </div>
              </div>
            </div>
            {(pickupPoints.length < 2 || vehicles.length === 0) && (
              <p className="text-xs text-muted-foreground text-center mb-2">
                {pickupPoints.length < 2 && "Necesitas al menos 2 puntos de recogida. "}
                {vehicles.length === 0 && "Necesitas configurar al menos 1 vehículo."}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                onClick={handleOptimizeRoutes}
                disabled={isOptimizing || pickupPoints.length < 2 || vehicles.length === 0}
                className="bg-primary hover:bg-primary/90"
                size="default"
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
          </CardContent>
        </Card>

        {/* Main Content Area - Flex layout for settings, results and map */}
        <div className="flex gap-4 w-full">
          {/* Settings Section - Left Side */}
          {isSettingsOpen && (
            <div className="w-[600px] flex-shrink-0">
              <Card className="h-[calc(100vh-240px)] flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <span>Configurar Optimización</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setIsSettingsOpen(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 overflow-y-auto">
                  <Tabs defaultValue="pickup-points" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="pickup-points" className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Puntos de Recogida
                      </TabsTrigger>
                      <TabsTrigger value="vehicles" className="flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Vehículos
                      </TabsTrigger>
                      <TabsTrigger value="config" className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Criterios
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="pickup-points" className="space-y-6 mt-0">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            Puntos de Recogida
                          </CardTitle>
                          <div className="flex gap-2 flex-wrap overflow-hidden" style={{ marginTop: '32px' }}>
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
                              type="button"
                              variant="outline"
                              size="sm"
                              className="px-3 whitespace-nowrap flex-shrink-0"
                              onClick={handleDownloadPickupPointTemplate}
                            >
                              <Download className="w-4 h-4 mr-1.5" />
                              Plantilla
                            </Button>
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
                            {pickupPoints.length > 0 && (
                              <AlertDialog open={isDeleteAllPointsDialogOpen} onOpenChange={setIsDeleteAllPointsDialogOpen}>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="px-3 whitespace-nowrap flex-shrink-0"
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
                    <TabsContent value="config" className="mt-0 space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Criterios de Optimización
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="travel-type">Tipo de Viaje</Label>
                            <Select
                              value={optimizationConfig.travelType}
                              onValueChange={(value: "distance" | "time") => {
                                setOptimizationConfig(prev => ({ ...prev, travelType: value }));
                              }}
                            >
                              <SelectTrigger id="travel-type">
                                <SelectValue placeholder="Selecciona el tipo de viaje" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="distance">Distancia</SelectItem>
                                <SelectItem value="time">Tiempo</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Determina si la optimización se basa en distancia o tiempo de viaje.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="solve-duration">Duración de Resolución</Label>
                            <Input
                              id="solve-duration"
                              type="text"
                              value={optimizationConfig.solveDuration}
                              onChange={(e) => {
                                setOptimizationConfig(prev => ({ ...prev, solveDuration: e.target.value }));
                              }}
                              placeholder="10s"
                            />
                            <p className="text-xs text-muted-foreground">
                              Tiempo máximo para resolver la optimización (ej: "10s", "30s", "1m").
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Results Container - Left Side (only shown when routes exist) */}
          {routes.length > 0 && (() => {
          // Filter routes to match legend: only routes with valid polylines AND at least one actual stop (excluding start/end)
          const routesWithPolylines = routes.map((route: any, index: number) => {
            const vehicleRoute = route.route_data?.route || [];
            const hasValidCoordinates = vehicleRoute.some((routeStop: any) => 
              routeStop.stop?.location?.lon && routeStop.stop?.location?.lat
            );
            const actualStopCount = vehicleRoute.filter((routeStop: any) => {
              const stopId = routeStop.stop?.id;
              const hasLocation = routeStop.stop?.location?.lon && routeStop.stop?.location?.lat;
              const isActualStop = stopId && !stopId.includes("-start") && !stopId.includes("-end");
              return hasLocation && isActualStop;
            }).length;
            const hasActualStops = actualStopCount >= 1;
            return (hasValidCoordinates && hasActualStops) ? { route, index } : null;
          }).filter((item): item is { route: any; index: number } => item !== null);

          // Group by vehicle and keep only one route per vehicle
          const MapConstructor = globalThis.Map || window.Map;
          const vehicleRouteMap = new MapConstructor<string, { route: any; index: number }>();
          routesWithPolylines.forEach(({ route, index }) => {
            let vehicleId = route.vehicle_id || route.route_data?.id || null;
            if (!vehicleId && route.route_data?.route && route.route_data.route.length > 0) {
              const firstStopId = route.route_data.route[0]?.stop?.id;
              vehicleId = firstStopId || `route-${index}`;
            }
            const identifier = vehicleId || `null-route-${index}`;
            if (!vehicleRouteMap.has(identifier)) {
              vehicleRouteMap.set(identifier, { route, index });
            }
          });
          
          const uniqueVehicleRoutes = Array.from(vehicleRouteMap.values());
          const routeColors = [
            "#26bc30", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
          ];
          
          // Helper function to get vehicle object from route
          const getVehicleFromRoute = (routeIndex: number, route: any): Vehicle | undefined => {
            // First, try to match by vehicle_id from database
            if (route.vehicle_id && vehicles.length > 0) {
              const vehicle = vehicles.find(v => v.id === route.vehicle_id);
              if (vehicle) return vehicle;
            }
            
            // Second, try to match by route_data.id (the vehicle ID from Nextmv response)
            if (route.route_data?.id && vehicles.length > 0) {
              // Try exact match first
              let vehicle = vehicles.find(v => v.id === route.route_data.id);
              if (vehicle) return vehicle;
              
              // Try matching with vehicle-{index} format
              vehicle = vehicles.find((v, idx) => `vehicle-${idx}` === route.route_data.id);
              if (vehicle) return vehicle;
              
              // Try matching by the vehicle ID format from Nextmv (could be UUID or other format)
              vehicle = vehicles.find(v => String(v.id) === String(route.route_data.id));
              if (vehicle) return vehicle;
            }
            
            // Last resort: use route index in the unique routes array
            const uniqueRoutesArray = Array.from(vehicleRouteMap.values());
            const routePosition = uniqueRoutesArray.findIndex(r => r.index === routeIndex);
            if (routePosition >= 0 && routePosition < vehicles.length) {
              return vehicles[routePosition];
            }
            
            // Fallback: try by index directly
            if (routeIndex < vehicles.length) {
              return vehicles[routeIndex];
            }
            
            return undefined;
          };

          const getVehicleName = (routeIndex: number, route: any): string => {
            // First, try to get route name from Supabase (highest priority)
            if (route.name) {
              return route.name;
            }
            
            // Debug logging
            console.log(`[getVehicleName] Route ${routeIndex}:`, {
              vehicle_id: route.vehicle_id,
              route_data_id: route.route_data?.id,
              vehicles_count: vehicles.length,
              vehicle_ids: vehicles.map(v => v.id)
            });
            
            const vehicle = getVehicleFromRoute(routeIndex, route);
            if (vehicle) {
              console.log(`[getVehicleName] Matched vehicle: ${vehicle.name}`);
              return vehicle.name;
            }
            
            // Third, try to get vehicle name from route_data if it exists
            if (route.route_data?.name) {
              console.log(`[getVehicleName] Using route_data.name: ${route.route_data.name}`);
              return route.route_data.name;
            }
            
            // Final fallback
            console.warn(`[getVehicleName] Using fallback for route ${routeIndex}. vehicle_id: ${route.vehicle_id}, route_data.id: ${route.route_data?.id}`);
            return `Vehículo ${routeIndex + 1}`;
          };

          // Calculate route count
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
          const routeCount = uniqueRoutes.length;

          // Helper function to extract passengers from route stops
          const extractPassengersFromRoute = (route: any): string[] => {
            const vehicleRoute = route.route_data?.route || [];
            const passengers = new Set<string>();

            vehicleRoute.forEach((routeStop: any) => {
              const stopId = routeStop.stop?.id;
              if (!stopId || stopId.includes("-start") || stopId.includes("-end")) return;

              const originalPointId = stopId.split('__person_')[0];
              const point = pickupPoints.find(p => p.id === originalPointId);

              if (point) {
                // Use nombres (passenger names) if available
                const nombres = (point as any).all_nombres as string[] | undefined;
                if (nombres && nombres.length > 0) {
                  nombres.forEach(n => passengers.add(n));
                  return;
                }
                // Fallback: use person_id (cédula)
                if (point.person_id) {
                  const ids = point.person_id.split(',').map(id => id.trim()).filter(id => id);
                  ids.forEach(id => passengers.add(id));
                  return;
                }
                // Fallback: use quantity to count slots
                const qty = point.quantity ?? 1;
                for (let i = 0; i < qty; i++) passengers.add(`${originalPointId}_p${i}`);
              }
            });

            return Array.from(passengers);
          };

          return (
            <div className="w-[450px] flex-shrink-0 flex flex-col h-[calc(100vh-240px)] pr-2">
              <Tabs defaultValue="summary" className="w-full h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mb-2 flex-shrink-0 h-10">
                  <TabsTrigger value="summary">Resumen</TabsTrigger>
                  <TabsTrigger value="routes">Rutas</TabsTrigger>
                </TabsList>
                
                <TabsContent value="summary" className="!mt-0 h-[calc(100%-2.5rem)]">
                  <div className="h-full flex flex-col">
                  {/* Optimization Info - Show when routes exist (loaded or recently added) */}
                  {(selectedRunId || routes.length > 0) && (
                <Card className="flex-1 min-h-0 flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Optimización
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
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm flex-1 min-h-0 overflow-y-auto">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 pb-3 border-b flex-shrink-0">
                      <div className="flex flex-col items-center text-center">
                        <MapPin className="w-5 h-5 mb-1 text-primary" />
                        <p className="text-xs text-muted-foreground mb-1">Puntos</p>
                        <p className="text-lg font-bold">{pickupPoints.length}</p>
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

                    {/* Execution Info - Only show if loaded from history */}
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
                        variant="outline"
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
                  </div>
                </TabsContent>
                
                <TabsContent value="routes" className="!mt-0 h-[calc(100%-2.5rem)]">
                  <div className="h-full flex flex-col">
                    {/* Route List */}
                    {uniqueVehicleRoutes.length > 0 && (
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
                              // Show all routes on the map
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
                        {uniqueVehicleRoutes.map(({ route, index }) => {
                          const color = routeColors[index % routeColors.length];
                          const vehicleName = getVehicleName(index, route);
                          const vehicleRoute = route.route_data?.route || [];
                          
                          // Count actual stops (excluding start/end)
                          const actualStops = vehicleRoute.filter((routeStop: any) => {
                            const stopId = routeStop.stop?.id;
                            return stopId && !stopId.includes("-start") && !stopId.includes("-end");
                          }).length;
                          
                          // Count passengers by extracting from route stops
                          const passengers = extractPassengersFromRoute(route);
                          const passengerCount = passengers.length;
                          // Get vehicle capacity - use helper function for consistent lookup
                          const vehicle = getVehicleFromRoute(index, route);
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
                                  {pendingRouteData && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-2 w-full h-7 text-xs"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setSelectedVehicleForSave(route.route_data);
                                        setRouteFormName(vehicleName);
                                        setIsSaveRouteDialogOpen(true);
                                      }}
                                    >
                                      <Route className="w-3 h-3 mr-1" />
                                      Guardar ruta
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Route Detail View
                      (() => {
                        const selectedRoute = uniqueVehicleRoutes.find(({ index }) => index === selectedRouteIndex);
                        if (!selectedRoute) return null;
                        
                        const { route, index } = selectedRoute;
                        const color = routeColors[index % routeColors.length];
                        const vehicleName = getVehicleName(index, route);
                        const vehicleRoute = route.route_data?.route || [];
                        
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
                            const originalPointId = extractOriginalPointId(stopId);
                            const point = pickupPoints.find(p => p.id === originalPointId);
                            
                            // Extract person IDs from stop ID if encoded (start points have no passengers)
                            // Format can be: {point.id}__person_{person_id1}__person_{person_id2}...
                            // Use the same logic as extractPassengersFromRoute for consistency
                            const personIds = new Set<string>();
                            if (!isStartPoint && stopId.includes('__person_')) {
                              // Match all occurrences of __person_ followed by the person ID
                              // Person ID can contain letters, numbers, hyphens, etc. until next __person_ or end of string
                              const regex = /__person_([^_]+?)(?=__person_|$)/g;
                              let match;
                              while ((match = regex.exec(stopId)) !== null) {
                                const personId = match[1];
                                if (personId) {
                                  personIds.add(personId);
                                }
                              }
                            }
                            
                            // Always check if point has person_id (same as extractPassengersFromRoute)
                            // Start points have no passengers, so skip this for start points
                            if (!isStartPoint && point?.person_id) {
                              // person_id might be comma-separated
                              const ids = point.person_id.split(',').map(id => id.trim()).filter(id => id);
                              ids.forEach(id => personIds.add(id));
                            }
                            
                            // Get passengers from stop_passenger relation (if route was loaded from Supabase)
                            const stopPassengers: Array<{ id: string; name: string; code: string | null }> = [];
                            if (route.stops && Array.isArray(route.stops)) {
                              // Find the stop in the route's stops array
                              const dbStop = route.stops.find((s: any) => s.nextmv_id === stopId);
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
                            
                            // Build passenger list: DB passengers > all_nombres > person_id (cédula) > personIds from stopId
                            let finalPassengers: Array<{ id: string; name: string; code: string | null }> = [];
                            if (stopPassengers.length > 0) {
                              finalPassengers = stopPassengers;
                            } else if (!isStartPoint && point) {
                              const allNombres: string[] = (point as any).all_nombres || [];
                              if (allNombres.length > 0) {
                                finalPassengers = allNombres.map((n, i) => ({ id: String(i), name: n, code: null }));
                              } else if (personIds.size > 0) {
                                finalPassengers = Array.from(personIds).map(id => ({ id, name: id, code: null }));
                              }
                            }
                            
                            // Get point address from Supabase pickup_point (preferred) or fallback to name
                            let pointName: string;
                            if (isStartPoint) {
                              pointName = "Punto de inicio";
                            } else {
                              // Try to get address from Supabase stop's pickup_point
                              if (route.stops && Array.isArray(route.stops)) {
                                const dbStop = route.stops.find((s: any) => s.nextmv_id === stopId);
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
                              stopId: originalPointId,
                              pointName: pointName,
                              personIds: Array.from(personIds), // Keep for backwards compatibility
                              passengers: finalPassengers, // New field with passenger details
                              quantity: point?.quantity || 1, // Get quantity from point
                              location: routeStop.stop?.location,
                            };
                          })
                          .sort((a, b) => {
                            // Sort so start point (index 0) comes first, then others by index
                            if (a.isStartPoint) return -1;
                            if (b.isStartPoint) return 1;
                            return a.stopIndex - b.stopIndex;
                          });
                        
                        // Add end point if vehicle has one
                        const vehicle = getVehicleFromRoute(index, route);
                        let finalStopsWithDetails = [...stopsWithDetails];
                        
                        // Check for end location from vehicle (Supabase or local)
                        let endLocation: { lon: number; lat: number } | null = null;
                        if (vehicle) {
                          if (vehicle.end_location) {
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
                            quantity: 0,
                            location: endLocation,
                          });
                        }
                        
                        // Calculate route summary metrics
                        // Count actual stops (excluding start/end)
                        const actualStops = vehicleRoute.filter((routeStop: any) => {
                          const stopId = routeStop.stop?.id;
                          return stopId && !stopId.includes("-start") && !stopId.includes("-end");
                        }).length;
                        
                        // Count passengers by extracting from route stops
                        const passengers = extractPassengersFromRoute(route);
                        const passengerCount = passengers.length;
                        // Get vehicle capacity (vehicle already defined above)
                        const vehicleCapacity = vehicle?.capacity || 0;
                        
                        // Get distance and duration
                        const totalDistance = route.total_distance || route.route_data?.route_travel_distance || 0;
                        const totalDuration = route.total_duration || route.route_data?.route_travel_duration || 0;
                        
                        // Format distance (convert meters to km if needed)
                        const distanceKm = totalDistance > 1000 ? (totalDistance / 1000).toFixed(2) : totalDistance.toFixed(2);
                        const distanceUnit = totalDistance > 1000 ? "km" : "m";
                        
                        // Format duration (convert seconds to minutes if needed)
                        const durationMin = totalDuration > 60 ? (totalDuration / 60).toFixed(1) : totalDuration.toFixed(0);
                        const durationUnit = totalDuration > 60 ? "min" : "seg";
                        
                        return (
                          <div className="space-y-3 h-full overflow-y-auto px-3 pb-3">
                            {/* Route Summary Card - Same as route list view */}
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
                              {selectedRouteIndex !== null && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setZoomToRoute(selectedRouteIndex);
                                    // Reset after a short delay to allow re-triggering
                                    setTimeout(() => setZoomToRoute(null), 100);
                                  }}
                                >
                                  <ZoomIn className="w-3 h-3 mr-1" />
                                  Ver ruta completa
                                </Button>
                              )}
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
                                      // Reset after a short delay to allow re-triggering
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
                                  ) : (
                                    <div className="mt-1 ml-8 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-semibold text-muted-foreground">Cantidad:</p>
                                        <span className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground rounded font-semibold">
                                          {stop.quantity || 1}
                                        </span>
                                      </div>
                                      {stop.passengers && stop.passengers.length > 0 ? (
                                        <div>
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
                                        <div>
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
                                        <p className="text-xs text-muted-foreground italic">Sin pasajeros asignados</p>
                                      )}
                                    </div>
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
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          );
        })()}

          {/* Map Container - Full width or with results/settings container */}
          <div className={`relative min-w-0 ${routes.length > 0 || isSettingsOpen ? 'flex-1' : 'w-full'}`}>
            <Card className="h-[calc(100vh-240px)] w-full">
              <CardContent className="p-0 h-full w-full">
                {orgCenterReady && <Map
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
                  selectedRouteIndex={selectedRouteIndex}
                  focusLocation={focusLocation}
                  zoomToRoute={zoomToRoute}
                  initialCenter={orgCenter}
                />}
              </CardContent>
            </Card>
            
            
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

      {/* JSON Preview Dialog (Hidden - Ctrl+Shift+P) */}
      <Dialog open={previewJsonDialogOpen} onOpenChange={setPreviewJsonDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa del JSON para Optimizador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {nextmvEndpoint && (
              <div className="text-sm text-muted-foreground">
                <strong>Endpoint:</strong> {nextmvEndpoint}
              </div>
            )}
            {nextmvJson && (
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(nextmvJson, null, 2)}
                </pre>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (nextmvJson) {
                    navigator.clipboard.writeText(JSON.stringify(nextmvJson, null, 2));
                    toast({
                      title: "Copiado",
                      description: "JSON copiado al portapapeles",
                    });
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Copiar JSON
              </Button>
              <Button onClick={() => setPreviewJsonDialogOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Route Dialog */}
      <Dialog open={isSaveRouteDialogOpen} onOpenChange={setIsSaveRouteDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Guardar Ruta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Route fields */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ruta</p>
            <div className="space-y-1">
              <Label htmlFor="route-name">Nombre <span className="text-destructive">*</span></Label>
              <Input
                id="route-name"
                placeholder="Ej: Ruta Norte Mañana"
                value={routeFormName}
                onChange={e => setRouteFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="route-code">Código</Label>
              <Input
                id="route-code"
                placeholder="Ej: RT-001"
                value={routeFormCode}
                onChange={e => setRouteFormCode(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={String(routeFormType)} onValueChange={v => setRouteFormType(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Ida</SelectItem>
                    <SelectItem value="1">Regreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Select value={String(routeFormCategory)} onValueChange={v => setRouteFormCategory(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Ruta Normal</SelectItem>
                    <SelectItem value="1">Portería</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Schedule fields */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Horario</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="schedule-name">Nombre del horario</Label>
                  <Input
                    id="schedule-name"
                    placeholder="Ej: Horario Mañana"
                    value={scheduleFormName}
                    onChange={e => setScheduleFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Días</Label>
                  <div className="grid grid-cols-7 gap-1">
                    {([
                      { key: 'monday', label: 'L' },
                      { key: 'tuesday', label: 'M' },
                      { key: 'wednesday', label: 'X' },
                      { key: 'thursday', label: 'J' },
                      { key: 'friday', label: 'V' },
                      { key: 'saturday', label: 'S' },
                      { key: 'sunday', label: 'D' },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setScheduleFormDays(d => ({ ...d, [key]: !d[key] }))}
                        className={`h-8 w-full rounded text-xs font-medium border transition-colors ${
                          scheduleFormDays[key]
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-input hover:bg-muted'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="start-time">Hora inicio</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={scheduleFormStartTime}
                      onChange={e => setScheduleFormStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="end-time">Hora fin</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={scheduleFormEndTime}
                      onChange={e => setScheduleFormEndTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsSaveRouteDialogOpen(false)} disabled={isSavingRoute}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRoute} disabled={isSavingRoute || !routeFormName.trim()}>
              {isSavingRoute ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Route className="w-4 h-4 mr-2" />}
              {isSavingRoute ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Index;

