import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Map from "@/components/Map";
import PickupPointForm from "@/components/PickupPointForm";
import VehicleConfig from "@/components/VehicleConfig";
import PickupPointsList from "@/components/PickupPointsList";
import { Play, MapPin, Truck, Route, MousePointerClick, ChevronDown, ChevronUp, Code, ArrowLeft, Plus, History, X, Upload } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  quantity?: number;
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
  const [visibleRoutes, setVisibleRoutes] = useState<Set<number>>(new Set());
  const { toast } = useToast();

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
      
      // Process and save routes to database
      const solution = solutions[0];
      
      // Clear old routes
      await supabase
        .from("routes")
        .delete()
        .gte("created_at", "1970-01-01");
      
      // Insert new routes
      const routeInserts = [];
      for (const vehicle of solution.vehicles || []) {
        const originalVehicle = vehicles.find((v) => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
        
        const routeData = {
          vehicle_id: originalVehicle?.id || null,
          route_data: vehicle,
          total_distance: vehicle.route_travel_distance || 0,
          total_duration: vehicle.route_travel_duration || vehicle.route_duration || 0
        };

        routeInserts.push(
          supabase.from("routes").insert(routeData)
        );
      }

      await Promise.all(routeInserts);
      
      // Reload routes from database
      const { data: routesData, error: routesError } = await supabase
        .from("routes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(vehicles.length || 10);

      if (routesError) {
        console.error("Error loading routes:", routesError);
      } else {
        const loadedRoutes = routesData || [];
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

  const loadPickupPoints = async () => {
    const { data, error } = await supabase.from("pickup_points").select("*");
    if (error) {
      console.error("Error loading pickup points:", error);
      return;
    }
    // Normalize quantity field - ensure it's always a number (default to 1 if null/undefined)
    const normalizedData = (data || []).map((point: any) => ({
      ...point,
      quantity: point.quantity != null && !isNaN(point.quantity) ? point.quantity : 1,
    }));
    setPickupPoints(normalizedData);
  };

  const loadVehicles = async () => {
    const { data, error } = await supabase.from("vehicles").select("*");
    if (error) {
      console.error("Error loading vehicles:", error);
      return;
    }
    setVehicles(data || []);
  };

  const handleAddPickupPoint = async (point: Omit<PickupPoint, "id"> & { id?: string }) => {
    if (editingPickupPoint) {
      // Update existing point
      const { id, ...updateData } = point;
      // Build update object explicitly to ensure quantity is always included
      // Quantity should always be set (form defaults to 1 if not provided)
      const quantity = updateData.quantity != null && !isNaN(updateData.quantity) 
        ? Math.max(1, Math.floor(updateData.quantity)) 
        : 1;
      const dataToUpdate: any = {
        name: updateData.name,
        address: updateData.address,
        latitude: updateData.latitude,
        longitude: updateData.longitude,
        quantity: quantity, // Always include quantity
      };
      
      let { data, error } = await supabase
        .from("pickup_points")
        .update(dataToUpdate)
        .eq("id", editingPickupPoint.id)
        .select()
        .single();

      // If error is about missing quantity column, retry without quantity
      if (error && error.code === "PGRST204" && error.message?.includes("quantity")) {
        console.warn("Quantity column not found, updating without quantity field");
        const { quantity, ...dataWithoutQuantity } = dataToUpdate;
        const retryResult = await supabase
          .from("pickup_points")
          .update(dataWithoutQuantity)
          .eq("id", editingPickupPoint.id)
          .select()
          .single();
        
        if (retryResult.error) {
          console.error("Database error:", retryResult.error);
          toast({
            title: "Error",
            description: `No se pudo actualizar el punto de recogida: ${retryResult.error.message}`,
            variant: "destructive",
          });
          return;
        }
        
        data = retryResult.data;
        error = null;
      } else if (error) {
        console.error("Database error:", error);
        toast({
          title: "Error",
          description: `No se pudo actualizar el punto de recogida: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setPickupPoints(pickupPoints.map((p) => (p.id === editingPickupPoint.id ? data : p)));
        setEditingPickupPoint(null);
        setIsPickupPointDialogOpen(false);
      }
    } else {
      // Insert new point - remove id if present since it's auto-generated
      const { id, ...insertData } = point;
      // Only include quantity if it's defined and not null
      const dataToInsert: any = {
        name: insertData.name,
        address: insertData.address,
        latitude: insertData.latitude,
        longitude: insertData.longitude,
      };
      if (insertData.quantity !== undefined && insertData.quantity !== null) {
        dataToInsert.quantity = insertData.quantity;
      }
      
      let { data, error } = await supabase
        .from("pickup_points")
        .insert([dataToInsert])
        .select()
        .single();

      // If error is about missing quantity column, retry without quantity
      if (error && error.code === "PGRST204" && error.message?.includes("quantity")) {
        console.warn("Quantity column not found, inserting without quantity field");
        const { quantity, ...dataWithoutQuantity } = dataToInsert;
        const retryResult = await supabase
          .from("pickup_points")
          .insert([dataWithoutQuantity])
          .select()
          .single();
        
        if (retryResult.error) {
          console.error("Database error:", retryResult.error);
          toast({
            title: "Error",
            description: `No se pudo agregar el punto de recogida: ${retryResult.error.message}`,
            variant: "destructive",
          });
          return;
        }
        
        data = retryResult.data;
        error = null;
      } else if (error) {
        console.error("Database error:", error);
        toast({
          title: "Error",
          description: `No se pudo agregar el punto de recogida: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setPickupPoints((prevPoints) => [...prevPoints, data]);
        setIsPickupPointDialogOpen(false);
      }
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

  const handleExcelUpload = async (file: File) => {
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

      // Group points by latitude and longitude, summing quantities
      interface PointData {
        latitude: number;
        longitude: number;
        quantity: number;
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pointMap: any = {};
      
      for (const row of jsonData) {
        const rowData = row as Record<string, any>;
        
        // Normalize column names (case-insensitive, handle variations)
        const latitudeKey = Object.keys(rowData).find(
          key => key.toLowerCase().trim() === "latitude" || key.toLowerCase().trim() === "lat"
        );
        const longitudeKey = Object.keys(rowData).find(
          key => key.toLowerCase().trim() === "longitude" || key.toLowerCase().trim() === "lon" || key.toLowerCase().trim() === "lng"
        );
        const quantityKey = Object.keys(rowData).find(
          key => key.toLowerCase().trim() === "quantity" || key.toLowerCase().trim() === "cantidad"
        );
        
        if (!latitudeKey || !longitudeKey) {
          console.warn("Row missing latitude or longitude:", rowData);
          continue;
        }
        
        const lat = parseFloat(rowData[latitudeKey]);
        const lon = parseFloat(rowData[longitudeKey]);
        // Parse quantity, default to 1 if missing or invalid
        let qty = 1;
        if (quantityKey) {
          const parsedQty = parseFloat(rowData[quantityKey]);
          if (!isNaN(parsedQty) && parsedQty > 0) {
            qty = Math.floor(parsedQty); // Ensure integer
          }
        }
        
        if (isNaN(lat) || isNaN(lon)) {
          console.warn("Invalid coordinates in row:", rowData);
          continue;
        }
        
        // Round coordinates to 7 decimal places for grouping (about 1.1cm precision)
        const latKey = lat.toFixed(7);
        const lonKey = lon.toFixed(7);
        const key = `${latKey},${lonKey}`;
        
        if (pointMap[key]) {
          // Sum quantities for duplicate coordinates
          pointMap[key].quantity += qty;
          console.log(`Combining duplicate coordinates ${key}: adding quantity ${qty}, total now: ${pointMap[key].quantity}`);
        } else {
          pointMap[key] = {
            latitude: lat,
            longitude: lon,
            quantity: qty,
          };
        }
      }
      
      const uniquePoints: PointData[] = Object.values(pointMap);
      
      if (uniquePoints.length === 0) {
        toast({
          title: "Error",
          description: "No se encontraron coordenadas válidas en el archivo",
          variant: "destructive",
        });
        return;
      }

      // Convert map to array of points
      const pointsToInsert = uniquePoints.map((point, index) => {
        // Ensure quantity is always a valid integer >= 1
        const quantity = Math.max(1, Math.floor(point.quantity || 1));
        return {
          name: `Punto ${pickupPoints.length + index + 1}`,
          address: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
          latitude: point.latitude,
          longitude: point.longitude,
          quantity: quantity, // Always set quantity
        };
      });

      // Log combined points for debugging
      console.log("Combined points with quantities:", pointsToInsert.map(p => ({
        coords: `${p.latitude}, ${p.longitude}`,
        quantity: p.quantity
      })));

      // Batch insert points
      let insertedCount = 0;
      const errors: string[] = [];

      for (const pointData of pointsToInsert) {
        try {
          // Always include quantity - it's always calculated and should be >= 1
          const quantity = Math.max(1, Math.floor(pointData.quantity || 1));
          const dataToInsert: any = {
            name: pointData.name,
            address: pointData.address,
            latitude: pointData.latitude,
            longitude: pointData.longitude,
            quantity: quantity, // Always include quantity in insert
          };

          let { data, error } = await supabase
            .from("pickup_points")
            .insert([dataToInsert])
            .select()
            .single();

          // If error is about missing quantity column, retry without quantity
          if (error && error.code === "PGRST204" && error.message?.includes("quantity")) {
            const { quantity, ...dataWithoutQuantity } = dataToInsert;
            const retryResult = await supabase
              .from("pickup_points")
              .insert([dataWithoutQuantity])
              .select()
              .single();
            
            if (retryResult.error) {
              errors.push(`Error en ${pointData.name}: ${retryResult.error.message}`);
              continue;
            }
            
            data = retryResult.data;
            error = null;
          } else if (error) {
            errors.push(`Error en ${pointData.name}: ${error.message}`);
            continue;
          }

          if (data) {
            setPickupPoints((prevPoints) => [...prevPoints, data]);
            insertedCount++;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Error desconocido";
          errors.push(`Error procesando ${pointData.name}: ${errorMessage}`);
        }
      }

      // Show results
      if (errors.length > 0) {
        toast({
          title: "Carga parcialmente completada",
          description: `Se agregaron ${insertedCount} puntos. ${errors.length} errores encontrados.`,
          variant: "default",
        });
        console.error("Errors during Excel upload:", errors);
      } else {
        toast({
          title: "Archivo cargado exitosamente",
          description: `Se agregaron ${insertedCount} puntos de recogida (${pointMap.size} únicos después de combinar duplicados)`,
        });
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
    const { error } = await supabase
      .from("pickup_points")
      .delete()
      .eq("id", pointId);

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el punto de recogida",
        variant: "destructive",
      });
      return;
    }

    setPickupPoints(pickupPoints.filter((p) => p.id !== pointId));
    toast({
      title: "Point removed",
      description: "El punto de recogida ha sido eliminado exitosamente",
    });
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
            capacity: Number(20),
            start_time: "2025-01-01T08:00:00Z",
            end_time: "2025-01-01T18:00:00Z"
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
          
          return {
            id: String(point.id || `stop-${index}`),
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

      // Save routes to Supabase database
      try {
        const solution = solutions[0];
        
        // Clear old routes before inserting new ones
        await supabase
          .from("routes")
          .delete()
          .gte("created_at", "1970-01-01");
        
        // Insert new routes
        const routeInserts = [];
        for (const vehicle of solution.vehicles || []) {
          // Find the original vehicle by matching the id
          const originalVehicle = vehicles.find((v) => v.id === vehicle.id || `vehicle-${vehicles.indexOf(v)}` === vehicle.id);
          
          // Extract route information from the vehicle object
          const routeData = {
            vehicle_id: originalVehicle?.id || null,
            route_data: vehicle,
            total_distance: vehicle.route_travel_distance || 0,
            total_duration: vehicle.route_travel_duration || vehicle.route_duration || 0
          };

          routeInserts.push(
            supabase.from("routes").insert(routeData)
          );
        }

        const insertResults = await Promise.all(routeInserts);
        const insertErrors = insertResults.filter((r: any) => r.error);
        if (insertErrors.length > 0) {
          console.error("Error inserting routes:", insertErrors);
        } else {
          console.log("Routes saved to database successfully");
        }
      } catch (dbError) {
        console.error("Error saving routes to database:", dbError);
        // Don't throw - we still want to show the results even if saving fails
      }

      toast({
        title: "Rutas optimizadas",
        description: "Las rutas han sido calculadas exitosamente",
      });

      // Reload routes from database
      const { data: routesData, error: routesError } = await supabase
        .from("routes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(vehicles.length || 10);

      if (routesError) {
        console.error("Error loading routes:", routesError);
      } else {
        const loadedRoutes = routesData || [];
        setRoutes(loadedRoutes);
        // Initialize all routes as visible
        setVisibleRoutes(new Set(loadedRoutes.map((_, index) => index)));
      }
      
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
          <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Puntos de Recogida</p>
                  <p className="text-4xl font-bold">{pickupPoints.length}</p>
                </div>
                <MapPin className="w-12 h-12 opacity-80" />
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
                  <p className="text-4xl font-bold">{routes.length}</p>
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
          </CardContent>
        </Card>

        {/* Nextmv JSON Section */}
        {nextmvJson && (
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
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Tabs defaultValue="pickup-points" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="pickup-points" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Pickup Points
                </TabsTrigger>
                <TabsTrigger value="vehicles" className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Vehicles
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pickup-points" className="space-y-6 mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Pickup Points
                      </span>
                      <div className="flex gap-2">
                        <label htmlFor="excel-upload" className="cursor-pointer">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => document.getElementById("excel-upload")?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" />
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
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Agregar Punto
                        </Button>
                      </div>
                    </CardTitle>
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
                  vehicles={vehicles}
                  onMapClickMode={handleVehicleLocationMapClick}
                  onLocationUpdate={handleVehicleLocationUpdate}
                  isDialogOpen={isVehicleDialogOpen}
                  setIsDialogOpen={setIsVehicleDialogOpen}
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
                      <p className="text-lg font-bold">{routes.length}</p>
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
