import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getVehicleByPlate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Trash2, Edit, X, Plus, Upload, Download, Zap, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Vehicle {
  id?: string;
  name: string;
  capacity: number;
  max_distance?: number;
  isQuickConfig?: boolean;
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

interface QuickGroup {
  id: string;
  quantity: number;
  capacity: number;
  maxDistance?: number;
}

interface VehicleConfigProps {
  onAdd: (vehicle: Vehicle) => void;
  onAddMultiple?: (vehicles: Vehicle[]) => void;
  onUpdate?: (vehicleId: string, vehicle: Vehicle) => void;
  onDelete: (vehicleId: string) => void;
  onDeleteAll?: () => void;
  vehicles: Vehicle[];
  onMapClickMode?: (mode: "start" | "end" | "start-selected" | "end-selected" | null, callback: (lon: number, lat: number) => void) => void;
  onLocationUpdate?: (type: "start" | "end", location: { lon: number; lat: number } | null) => void;
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
  onVehicleExcelUpload?: (file: File) => void;
  routes?: any[];
  pickupPoints?: PickupPoint[];
  className?: string;
}

const VehicleConfig = ({ onAdd, onAddMultiple, onUpdate, onDelete, onDeleteAll, vehicles, onMapClickMode, onLocationUpdate, isDialogOpen, setIsDialogOpen, onVehicleExcelUpload, routes = [], pickupPoints = [], className }: VehicleConfigProps) => {
  const [configMode, setConfigMode] = useState<"select" | "registered" | "quick">(
    vehicles.length > 0 ? "registered" : "select"
  );

  // Quick config states
  const [quickGroups, setQuickGroups] = useState<QuickGroup[]>([]);
  const [quickQuantity, setQuickQuantity] = useState("1");
  const [quickCapacity, setQuickCapacity] = useState("30");
  const [quickMaxDistance, setQuickMaxDistance] = useState("100");

  // Registered mode states
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("100");
  const [maxDistance, setMaxDistance] = useState("");
  const [plateStatus, setPlateStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [plateData, setPlateData] = useState<any>(null);
  const [startLocationMode, setStartLocationMode] = useState<"manual" | "pickup" | "map">("pickup");
  const [endLocationMode, setEndLocationMode] = useState<"manual" | "pickup" | "none" | "map">("none");
  const [startLon, setStartLon] = useState("");
  const [startLat, setStartLat] = useState("");
  const [endLon, setEndLon] = useState("");
  const [endLat, setEndLat] = useState("");
  const { toast } = useToast();

  // Update form when editing vehicle changes
  useEffect(() => {
    if (editingVehicle) {
      setName(editingVehicle.name);
      setCapacity(editingVehicle.capacity.toString());
      setMaxDistance(editingVehicle.max_distance != null ? editingVehicle.max_distance.toString() : "");
      
      if (editingVehicle.start_location) {
        setStartLocationMode("manual");
        setStartLon(editingVehicle.start_location.lon.toString());
        setStartLat(editingVehicle.start_location.lat.toString());
      } else {
        setStartLocationMode("pickup");
        setStartLon("");
        setStartLat("");
      }
      
      if (editingVehicle.end_location) {
        setEndLocationMode("manual");
        setEndLon(editingVehicle.end_location.lon.toString());
        setEndLat(editingVehicle.end_location.lat.toString());
      } else {
        setEndLocationMode("none");
        setEndLon("");
        setEndLat("");
      }
    } else {
      setName("");
      setCapacity("100");
      setMaxDistance("");
      setStartLocationMode("pickup");
      setEndLocationMode("none");
      setStartLon("");
      setStartLat("");
      setEndLon("");
      setEndLat("");
    }
    // Use editingVehicle.id for stable comparison instead of the whole object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingVehicle?.id]);

  // Update markers when manual coordinates are entered
  useEffect(() => {
    if (!onLocationUpdate) return;
    
    if (startLocationMode === "manual" && startLon && startLat) {
      const lon = parseFloat(startLon);
      const lat = parseFloat(startLat);
      if (!isNaN(lon) && !isNaN(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
        onLocationUpdate("start", { lon, lat });
      } else {
        onLocationUpdate("start", null);
      }
    } else if (startLocationMode !== "manual") {
      onLocationUpdate("start", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLon, startLat, startLocationMode]);

  useEffect(() => {
    if (!onLocationUpdate) return;
    
    if (endLocationMode === "manual" && endLon && endLat) {
      const lon = parseFloat(endLon);
      const lat = parseFloat(endLat);
      if (!isNaN(lon) && !isNaN(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
        onLocationUpdate("end", { lon, lat });
      } else {
        onLocationUpdate("end", null);
      }
    } else if (endLocationMode !== "manual") {
      onLocationUpdate("end", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endLon, endLat, endLocationMode]);

  const handleAddQuickGroup = () => {
    const qty = parseInt(quickQuantity);
    const cap = parseInt(quickCapacity);
    const dist = parseFloat(quickMaxDistance);
    if (!qty || qty < 1 || !cap || cap < 1) {
      toast({ title: "Error", description: "Cantidad y capacidad deben ser mayores a 0", variant: "destructive" });
      return;
    }
    const maxDist = parseFloat(quickMaxDistance);
    setQuickGroups(prev => [...prev, { id: `qg-${Date.now()}`, quantity: qty, capacity: cap, maxDistance: (!isNaN(maxDist) && maxDist > 0) ? maxDist : undefined }]);
    setQuickQuantity("1");
  };

  const handleRemoveQuickGroup = (id: string) => {
    setQuickGroups(prev => prev.filter(g => g.id !== id));
  };

  const handleApplyQuickConfig = () => {
    if (quickGroups.length === 0) return;
    const cap = quickGroups.reduce((sum, g) => sum + g.quantity * g.capacity, 0);
    const pax = pickupPoints.reduce((sum, p) => sum + (p.quantity || 1), 0);
    if (pickupPoints.length > 0 && cap < pax) {
      toast({
        title: "Capacidad insuficiente",
        description: `La capacidad total (${cap} puestos) no cubre los ${pax} pasajeros. Agrega más vehículos o aumenta la capacidad.`,
        variant: "destructive",
      });
      return;
    }
    const newVehicles: Vehicle[] = [];
    let counter = vehicles.length + 1;
    quickGroups.forEach(group => {
      for (let i = 0; i < group.quantity; i++) {
        newVehicles.push({ name: `Vehículo ${counter++}`, capacity: group.capacity, isQuickConfig: true, ...(group.maxDistance != null ? { max_distance: group.maxDistance } : {}) });
      }
    });
    if (onAddMultiple) {
      onAddMultiple(newVehicles);
    } else {
      newVehicles.forEach(v => onAdd(v));
    }
    setQuickGroups([]);
    toast({ title: "Vehículos generados", description: `Se agregaron ${newVehicles.length} vehículos a la optimización` });
  };

  const handlePlateBlur = async () => {
    if (!name.trim()) {
      setPlateStatus("idle");
      setPlateData(null);
      return;
    }
    setPlateStatus("checking");
    try {
      const vehicle = await getVehicleByPlate(name.trim());
      setPlateData(vehicle);
      setPlateStatus("valid");
    } catch {
      setPlateData(null);
      setPlateStatus("invalid");
    }
  };

  const handleStartLocationMapClick = (lon: number, lat: number) => {
    setStartLon(lon.toFixed(6));
    setStartLat(lat.toFixed(6));
    setStartLocationMode("manual");
    toast({
      title: "Ubicación de inicio seleccionada",
      description: `Coordenadas: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    });
  };

  const handleEndLocationMapClick = (lon: number, lat: number) => {
    setEndLon(lon.toFixed(6));
    setEndLat(lat.toFixed(6));
    setEndLocationMode("manual");
    toast({
      title: "Ubicación de fin seleccionada",
      description: `Coordenadas: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    });
  };

  const handleStartLocationModeChange = (mode: "manual" | "pickup" | "map") => {
    setStartLocationMode(mode);
    if (mode === "map" && onMapClickMode) {
      onMapClickMode("start", handleStartLocationMapClick);
    } else if (mode === "manual" && startLon && startLat && onMapClickMode) {
      // Update marker when switching to manual with existing coordinates
      onMapClickMode("start-selected", () => {});
    } else if (onMapClickMode) {
      onMapClickMode(null, () => {});
    }
  };

  const handleEndLocationModeChange = (mode: "manual" | "pickup" | "none" | "map") => {
    setEndLocationMode(mode);
    if (mode === "map" && onMapClickMode) {
      onMapClickMode("end", handleEndLocationMapClick);
    } else if (mode === "manual" && endLon && endLat && onMapClickMode) {
      // Update marker when switching to manual with existing coordinates
      onMapClickMode("end-selected", () => {});
    } else if (onMapClickMode) {
      onMapClickMode(null, () => {});
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !capacity) {
      toast({
        title: "Error",
        description: "Por favor completa la placa y la capacidad",
        variant: "destructive",
      });
      return;
    }

    if (plateStatus === "invalid") {
      toast({
        title: "Error",
        description: "La placa no existe en el sistema",
        variant: "destructive",
      });
      return;
    }

    if (plateStatus !== "valid" && !editingVehicle) {
      toast({
        title: "Error",
        description: "Por favor verifica la placa antes de continuar",
        variant: "destructive",
      });
      return;
    }

    // Validate manual location coordinates if provided
    if (startLocationMode === "manual") {
      const startLonNum = parseFloat(startLon);
      const startLatNum = parseFloat(startLat);
      if (isNaN(startLonNum) || isNaN(startLatNum) || startLonNum < -180 || startLonNum > 180 || startLatNum < -90 || startLatNum > 90) {
        toast({
          title: "Error",
          description: "Las coordenadas de inicio no son válidas (longitud: -180 a 180, latitud: -90 a 90)",
          variant: "destructive",
        });
        return;
      }
    }

    if (endLocationMode === "manual") {
      const endLonNum = parseFloat(endLon);
      const endLatNum = parseFloat(endLat);
      if (isNaN(endLonNum) || isNaN(endLatNum) || endLonNum < -180 || endLonNum > 180 || endLatNum < -90 || endLatNum > 90) {
        toast({
          title: "Error",
          description: "Las coordenadas de fin no son válidas (longitud: -180 a 180, latitud: -90 a 90)",
          variant: "destructive",
        });
        return;
      }
    }

    const parsedMaxDistance = maxDistance.trim() ? parseFloat(maxDistance) : undefined;
    const vehicle: Vehicle = {
      name,
      capacity: parseInt(capacity),
      ...(parsedMaxDistance != null && !isNaN(parsedMaxDistance) && parsedMaxDistance > 0
        ? { max_distance: parsedMaxDistance }
        : {}),
    };

    // Add start location if manual mode
    if (startLocationMode === "manual") {
      vehicle.start_location = {
        lon: parseFloat(startLon),
        lat: parseFloat(startLat),
      };
    }

    // Add end location if manual mode (pickup mode will be handled in Index.tsx)
    if (endLocationMode === "manual") {
      vehicle.end_location = {
        lon: parseFloat(endLon),
        lat: parseFloat(endLat),
      };
    } else if (endLocationMode === "pickup") {
      // Mark that we want to use pickup point (will be handled in Index.tsx)
      // We don't set end_location here, so Index.tsx can use last pickup point
    }

    if (editingVehicle && editingVehicle.id && onUpdate) {
      onUpdate(editingVehicle.id, vehicle);
      setEditingVehicle(null);
      setIsDialogOpen?.(false);
      toast({
        title: "Vehículo actualizado",
        description: "El vehículo ha sido actualizado exitosamente",
      });
    } else {
      onAdd(vehicle);
      toast({
        title: "Vehículo agregado",
        description: "El vehículo ha sido configurado exitosamente",
      });
    }

    // Reset form only if not editing
    if (!editingVehicle) {
      setName("");
      setCapacity("100");
      setMaxDistance("");
      setStartLocationMode("pickup");
      setEndLocationMode("none");
      setStartLon("");
      setStartLat("");
      setEndLon("");
      setEndLat("");
      setPlateStatus("idle");
      setPlateData(null);
    }
  };

  const handleEditClick = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsDialogOpen?.(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen?.(open);
    if (!open) {
      setEditingVehicle(null);
    }
  };

  const handleDownloadVehicleTemplate = () => {
    const data = [
      ["placa", "capacidad", "distancia_maxima", "inicio_latitud", "inicio_longitud", "fin_latitud", "fin_longitud", "grupo"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehículos");
    XLSX.writeFile(wb, "plantilla_vehiculos.xlsx");
  };

  const totalQuickVehicles = quickGroups.reduce((sum, g) => sum + g.quantity, 0);
  const totalQuickCapacity = quickGroups.reduce((sum, g) => sum + g.quantity * g.capacity, 0);
  const totalPassengers = pickupPoints.reduce((sum, p) => sum + (p.quantity || 1), 0);
  const hasPassengerData = pickupPoints.length > 0;
  const capacityShortfall = hasPassengerData ? totalPassengers - totalQuickCapacity : 0;
  const capacitySufficient = !hasPassengerData || totalQuickCapacity >= totalPassengers;

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Vehículos ({vehicles.length})
            </span>
            {configMode !== "select" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 px-2 font-normal"
                onClick={() => setConfigMode("select")}
              >
                Cambiar método
              </Button>
            )}
          </CardTitle>

          {/* Active mode badge + action buttons */}
          {configMode === "registered" && (
            <div className="space-y-3 mt-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                  <Truck className="w-3 h-3" />
                  Vehículos Registrados
                </span>
              </div>
              <div className="flex gap-2 flex-wrap overflow-hidden">
                {onVehicleExcelUpload && (
                  <label htmlFor="vehicle-excel-upload" className="cursor-pointer flex-shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer px-3 whitespace-nowrap"
                      onClick={() => document.getElementById("vehicle-excel-upload")?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1.5" />
                      Subir Excel
                    </Button>
                    <input
                      id="vehicle-excel-upload"
                      type="file"
                      accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onVehicleExcelUpload) onVehicleExcelUpload(file);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                )}
                <Button type="button" variant="outline" size="sm" className="px-3 whitespace-nowrap flex-shrink-0" onClick={handleDownloadVehicleTemplate}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Plantilla
                </Button>
                <Button onClick={() => { setEditingVehicle(null); setIsDialogOpen?.(true); }} size="sm" className="px-3 whitespace-nowrap flex-shrink-0">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar Vehículo
                </Button>
                {onDeleteAll && vehicles.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" size="sm" className="px-3 whitespace-nowrap flex-shrink-0">
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Eliminar Todos
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar todos los vehículos?</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Estás seguro de que deseas eliminar todos los {vehicles.length} vehículos? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={onDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar Todos
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )}

          {configMode === "quick" && (
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-medium">
                <Zap className="w-3 h-3" />
                Configuración Rápida
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── SELECTION SCREEN ── */}
          {configMode === "select" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">¿Cómo quieres configurar los vehículos para esta optimización?</p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setConfigMode("registered")}
                  className="group w-full text-left p-4 rounded-xl border-2 border-border hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-150"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Truck className="w-4 h-4 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Mis vehículos ya están registrados</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Los vehículos están dados de alta en la plataforma. Los identifico por placa y el sistema valida su existencia.
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2 group-hover:text-blue-600 transition-colors" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfigMode("quick")}
                  className="group w-full text-left p-4 rounded-xl border-2 border-border hover:border-orange-400 hover:bg-orange-50/50 transition-all duration-150"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                      <Zap className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Configuración rápida sin registro</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Solo indico cuántos vehículos necesito y su capacidad. Ideal cuando no importa la identificación del vehículo.
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-2 group-hover:text-orange-600 transition-colors" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── QUICK CONFIG UI ── */}
          {configMode === "quick" && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
                <p className="text-sm font-medium">Agregar grupo de vehículos</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Cantidad</Label>
                    <Input type="number" min="1" value={quickQuantity} onChange={(e) => setQuickQuantity(e.target.value)} placeholder="Ej: 5" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Capacidad</Label>
                    <Input type="number" min="1" value={quickCapacity} onChange={(e) => setQuickCapacity(e.target.value)} placeholder="Ej: 30" className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dist. máx <span className="text-muted-foreground">(opc.)</span></Label>
                    <Input type="number" min="1" value={quickMaxDistance} onChange={(e) => setQuickMaxDistance(e.target.value)} placeholder="Sin límite" className="h-8" />
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleAddQuickGroup}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar grupo
                </Button>
              </div>

              {quickGroups.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Grupos configurados</p>
                  {quickGroups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">
                          {group.quantity}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{group.quantity} {group.quantity === 1 ? "vehículo" : "vehículos"}</p>
                          <p className="text-xs text-muted-foreground">Capacidad {group.capacity}{group.maxDistance != null ? ` · Dist. máx ${group.maxDistance} km` : " · Sin límite de distancia"}</p>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveQuickGroup(group.id)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {/* Capacity vs passengers indicator */}
                  {hasPassengerData && (
                    <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${capacitySufficient ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                      <span className={`text-base leading-none mt-0.5 flex-shrink-0 ${capacitySufficient ? "text-green-600" : "text-red-500"}`}>
                        {capacitySufficient ? "✓" : "✗"}
                      </span>
                      <div>
                        <p className={`font-medium ${capacitySufficient ? "text-green-700" : "text-red-700"}`}>
                          {capacitySufficient
                            ? `Capacidad suficiente (${totalQuickCapacity} puestos para ${totalPassengers} pasajeros)`
                            : `Capacidad insuficiente — faltan ${capacityShortfall} puestos`}
                        </p>
                        {!capacitySufficient && (
                          <p className="text-xs text-red-600 mt-0.5">
                            Tienes {totalQuickCapacity} puestos en total y {totalPassengers} pasajeros a repartir.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Total: <span className="font-semibold text-foreground">{totalQuickVehicles} vehículos</span>
                      {hasPassengerData && (
                        <span className="ml-2 text-xs">· {totalQuickCapacity} puestos</span>
                      )}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyQuickConfig}
                      disabled={!capacitySufficient}
                      title={!capacitySufficient ? `Faltan ${capacityShortfall} puestos para cubrir los ${totalPassengers} pasajeros` : undefined}
                    >
                      <Truck className="w-4 h-4 mr-1.5" />
                      Generar {totalQuickVehicles} vehículos
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-1">Agrega al menos un grupo para generar vehículos.</p>
              )}
            </div>
          )}

          {configMode !== "select" && vehicles.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {vehicles.map((vehicle, idx) => {
                // Extract grupos for this vehicle from routes
                const extractGruposForVehicle = (vehicle: Vehicle, vehicleIndex: number): string[] => {
                  const grupos = new Set<string>();
                  
                  if (!routes || routes.length === 0) {
                    return [];
                  }
                  
                  if (!pickupPoints || pickupPoints.length === 0) {
                    return [];
                  }
                  
                  routes.forEach((route: any, routeIndex: number) => {
                    // Match vehicle using the same logic as getVehicleName in Index.tsx
                    let matchesVehicle = false;
                    
                    // 1. Match by vehicle_id from database
                    if (route.vehicle_id && vehicle.id && route.vehicle_id === vehicle.id) {
                      matchesVehicle = true;
                    }
                    
                    // 2. Match by route_data.id (the vehicle ID from Nextmv response)
                    if (!matchesVehicle && route.route_data?.id) {
                      // Try exact match first
                      if (vehicle.id && route.route_data.id === vehicle.id) {
                        matchesVehicle = true;
                      }
                      
                      // Try matching with vehicle-{index} format
                      if (!matchesVehicle) {
                        const vehiclesIndex = vehicles.indexOf(vehicle);
                        if (route.route_data.id === `vehicle-${vehiclesIndex}` || 
                            route.route_data.id === `vehicle-${vehicleIndex}`) {
                          matchesVehicle = true;
                        }
                      }
                      
                      // Try matching by string comparison
                      if (!matchesVehicle && vehicle.id && String(route.route_data.id) === String(vehicle.id)) {
                        matchesVehicle = true;
                      }
                    }
                    
                    // 3. Match by position in routes array (if both vehicle and route don't have IDs)
                    if (!matchesVehicle && !vehicle.id && !route.vehicle_id && !route.route_data?.id) {
                      matchesVehicle = routeIndex === vehicleIndex;
                    }
                    
                    if (matchesVehicle) {
                      const vehicleRoute = route.route_data?.route || [];
                      vehicleRoute.forEach((routeStop: any) => {
                        const stopId = routeStop.stop?.id;
                        if (!stopId || stopId.includes("-start") || stopId.includes("-end")) return;
                        
                        // Extract original point ID from encoded stop ID
                        const extractOriginalPointId = (stopId: string): string => {
                          if (!stopId) return stopId;
                          const idx = stopId.indexOf('__person_');
                          return idx > -1 ? stopId.substring(0, idx) : stopId;
                        };
                        
                        const originalPointId = extractOriginalPointId(stopId);
                        const point = pickupPoints.find(p => p.id === originalPointId);
                        
                        if (point?.grupo) {
                          grupos.add(point.grupo);
                        }
                      });
                    }
                  });
                  
                  return Array.from(grupos);
                };
                
                const vehicleGrupos = extractGruposForVehicle(vehicle, idx);
                
                // Combine vehicle's own grupo with grupos from routes
                const allGrupos = new Set<string>();
                if (vehicle.grupo) {
                  allGrupos.add(vehicle.grupo);
                }
                vehicleGrupos.forEach(g => allGrupos.add(g));
                const displayGrupos = Array.from(allGrupos);
                
                // Enhanced debug logging to diagnose the issue
                if (routes.length > 0) {
                  const matchingRoutes = routes.filter((route: any) => {
                    return (route.vehicle_id && route.vehicle_id === vehicle.id) ||
                           (vehicle.id && route.route_data?.id === vehicle.id) ||
                           (route.route_data?.id && route.route_data.id === `vehicle-${idx}`) ||
                           (route.route_data?.id && route.route_data.id === `vehicle-${vehicles.indexOf(vehicle)}`);
                  });
                  
                }
                
                return (
                  <div
                    key={vehicle.id || idx}
                    className="p-3 bg-muted rounded-lg text-sm flex items-start justify-between gap-2"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{vehicle.name}</p>
                        {displayGrupos.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {displayGrupos.map((grupo, gIdx) => (
                              <span 
                                key={gIdx}
                                className="px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-md border border-purple-300"
                              >
                                {grupo}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        Capacidad: {vehicle.capacity}{vehicle.max_distance != null ? ` | Dist. máx: ${vehicle.max_distance} km` : ""}
                      </p>
                    </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditClick(vehicle)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Estás seguro de que deseas eliminar el vehículo "{vehicle.name}"? 
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (vehicle.id) {
                                onDelete(vehicle.id);
                              } else {
                                toast({
                                  title: "Error",
                                  description: "No se puede eliminar un vehículo sin ID",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            configMode !== "select" && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {configMode === "registered"
                  ? "No hay vehículos. Haz clic en \"Agregar Vehículo\" para comenzar."
                  : "No hay vehículos. Agrega grupos arriba y haz clic en \"Generar\"."}
              </p>
            )
          )}
        </CardContent>
      </Card>

      {/* Vehicle Form Dialog */}
      <Dialog open={isDialogOpen || false} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                {editingVehicle ? "Editar Vehículo" : "Agregar Vehículo"}
              </span>
              {editingVehicle && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingVehicle(null);
                    setIsDialogOpen?.(false);
                  }}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="vehicle-name">Placa del Vehículo</Label>
              <Input
                id="vehicle-name"
                value={name}
                onChange={(e) => { setName(e.target.value); setPlateStatus("idle"); setPlateData(null); }}
                onBlur={handlePlateBlur}
                placeholder="Ej: ABC123"
              />
              {plateStatus === "checking" && (
                <p className="text-xs text-muted-foreground mt-1">Verificando placa...</p>
              )}
              {plateStatus === "valid" && plateData && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Vehículo encontrado: {plateData.alias || plateData.plate}
                </p>
              )}
              {plateStatus === "invalid" && (
                <p className="text-xs text-red-500 mt-1">✗ Placa no encontrada en el sistema</p>
              )}
            </div>
            <div>
              <Label htmlFor="capacity">Capacidad</Label>
              <Input
                id="capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="100"
              />
            </div>
            <div>
              <Label htmlFor="max-distance" className="flex items-center gap-1">
                Distancia Máxima (km)
                <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="max-distance"
                type="number"
                value={maxDistance}
                onChange={(e) => setMaxDistance(e.target.value)}
                placeholder="Sin límite"
              />
            </div>

            {/* Start Location Configuration */}
            <div className="space-y-2 pt-2 border-t">
              <Label>Ubicación de Inicio</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={startLocationMode === "pickup" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStartLocationModeChange("pickup")}
                  className="flex-1"
                >
                  Primer Punto
                </Button>
                <Button
                  type="button"
                  variant={startLocationMode === "map" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStartLocationModeChange("map")}
                  className="flex-1"
                >
                  📍 Mapa
                </Button>
                <Button
                  type="button"
                  variant={startLocationMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStartLocationModeChange("manual")}
                  className="flex-1"
                >
                  Manual
                </Button>
              </div>
              {startLocationMode === "map" && (
                <p className="text-xs text-muted-foreground">
                  Haz clic en el mapa para seleccionar la ubicación de inicio
                </p>
              )}
              {startLocationMode === "manual" && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label htmlFor="start-lon" className="text-xs">Longitud</Label>
                    <Input
                      id="start-lon"
                      type="number"
                      step="any"
                      value={startLon}
                      onChange={(e) => {
                        setStartLon(e.target.value);
                      }}
                      placeholder="-74.0994"
                    />
                  </div>
                  <div>
                    <Label htmlFor="start-lat" className="text-xs">Latitud</Label>
                    <Input
                      id="start-lat"
                      type="number"
                      step="any"
                      value={startLat}
                      onChange={(e) => {
                        setStartLat(e.target.value);
                      }}
                      placeholder="4.6921"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* End Location Configuration */}
            <div className="space-y-2 pt-2 border-t">
              <Label>Ubicación de Fin</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={endLocationMode === "none" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleEndLocationModeChange("none")}
                  className="flex-1"
                >
                  Ninguna
                </Button>
                <Button
                  type="button"
                  variant={endLocationMode === "pickup" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleEndLocationModeChange("pickup")}
                  className="flex-1"
                >
                  Último Punto
                </Button>
                <Button
                  type="button"
                  variant={endLocationMode === "map" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleEndLocationModeChange("map")}
                  className="flex-1"
                >
                  📍 Mapa
                </Button>
                <Button
                  type="button"
                  variant={endLocationMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleEndLocationModeChange("manual")}
                  className="flex-1"
                >
                  Manual
                </Button>
              </div>
              {endLocationMode === "map" && (
                <p className="text-xs text-muted-foreground">
                  Haz clic en el mapa para seleccionar la ubicación de fin
                </p>
              )}
              {endLocationMode === "manual" && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label htmlFor="end-lon" className="text-xs">Longitud</Label>
                    <Input
                      id="end-lon"
                      type="number"
                      step="any"
                      value={endLon}
                      onChange={(e) => setEndLon(e.target.value)}
                      placeholder="-74.0994"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-lat" className="text-xs">Latitud</Label>
                    <Input
                      id="end-lat"
                      type="number"
                      step="any"
                      value={endLat}
                      onChange={(e) => setEndLat(e.target.value)}
                      placeholder="4.6921"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {editingVehicle && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingVehicle(null);
                    setIsDialogOpen?.(false);
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" className={editingVehicle ? "flex-1" : "w-full"} variant="secondary">
                <Truck className="w-4 h-4 mr-2" />
                {editingVehicle ? "Actualizar Vehículo" : "Agregar Vehículo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VehicleConfig;
