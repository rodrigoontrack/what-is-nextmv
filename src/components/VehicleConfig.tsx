import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Trash2, Edit, X, Plus, Upload } from "lucide-react";
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

interface VehicleConfigProps {
  onAdd: (vehicle: Vehicle) => void;
  onUpdate?: (vehicleId: string, vehicle: Vehicle) => void;
  onDelete: (vehicleId: string) => void;
  onDeleteAll?: () => void;
  vehicles: Vehicle[];
  onMapClickMode?: (mode: "start" | "end" | "start-selected" | "end-selected" | null, callback: (lon: number, lat: number) => void) => void;
  onLocationUpdate?: (type: "start" | "end", location: { lon: number; lat: number } | null) => void;
  isDialogOpen?: boolean;
  setIsDialogOpen?: (open: boolean) => void;
  onVehicleExcelUpload?: (file: File) => void;
}

const VehicleConfig = ({ onAdd, onUpdate, onDelete, onDeleteAll, vehicles, onMapClickMode, onLocationUpdate, isDialogOpen, setIsDialogOpen, onVehicleExcelUpload }: VehicleConfigProps) => {
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("100");
  const [maxDistance, setMaxDistance] = useState("100");
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
      setMaxDistance(editingVehicle.max_distance.toString());
      
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
      setMaxDistance("100");
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

    if (!name || !capacity || !maxDistance) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
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

    const vehicle: Vehicle = {
      name,
      capacity: parseInt(capacity),
      max_distance: parseFloat(maxDistance),
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
      setMaxDistance("100");
      setStartLocationMode("pickup");
      setEndLocationMode("none");
      setStartLon("");
      setStartLat("");
      setEndLon("");
      setEndLat("");
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Vehículos ({vehicles.length})
            </span>
            <div className="flex gap-2">
              {onVehicleExcelUpload && (
                <label htmlFor="vehicle-excel-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => document.getElementById("vehicle-excel-upload")?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Subir Excel
                  </Button>
                  <input
                    id="vehicle-excel-upload"
                    type="file"
                    accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && onVehicleExcelUpload) {
                        onVehicleExcelUpload(file);
                      }
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              )}
              {onDeleteAll && vehicles.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
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
                      <AlertDialogTitle>¿Eliminar todos los vehículos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Estás seguro de que deseas eliminar todos los {vehicles.length} vehículos? Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDeleteAll}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar Todos
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                onClick={() => {
                  setEditingVehicle(null);
                  setIsDialogOpen?.(true);
                }}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Vehículo
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {vehicles.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {vehicles.map((vehicle, idx) => (
                <div
                  key={vehicle.id || idx}
                  className="p-3 bg-muted rounded-lg text-sm flex items-start justify-between gap-2"
                >
                  <div className="flex-1">
                    <p className="font-semibold">{vehicle.name}</p>
                    <p className="text-muted-foreground">
                      Capacidad: {vehicle.capacity} | Dist. máx: {vehicle.max_distance} km
                    </p>
                  </div>
                  {vehicle.id && (
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
                              onClick={() => onDelete(vehicle.id!)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay vehículos configurados. Haz clic en "Agregar Vehículo" para comenzar.
            </p>
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
              <Label htmlFor="vehicle-name">Nombre del Vehículo</Label>
              <Input
                id="vehicle-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Camión 1"
              />
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
              <Label htmlFor="max-distance">Distancia Máxima (km)</Label>
              <Input
                id="max-distance"
                type="number"
                value={maxDistance}
                onChange={(e) => setMaxDistance(e.target.value)}
                placeholder="100"
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
