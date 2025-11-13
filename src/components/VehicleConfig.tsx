import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id?: string;
  name: string;
  capacity: number;
  max_distance: number;
}

interface VehicleConfigProps {
  onAdd: (vehicle: Vehicle) => void;
  vehicles: Vehicle[];
}

const VehicleConfig = ({ onAdd, vehicles }: VehicleConfigProps) => {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("100");
  const [maxDistance, setMaxDistance] = useState("1000");
  const { toast } = useToast();

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

    onAdd({
      name,
      capacity: parseInt(capacity),
      max_distance: parseFloat(maxDistance),
    });

    setName("");
    setCapacity("100");
    setMaxDistance("1000");

    toast({
      title: "Vehículo agregado",
      description: "El vehículo ha sido configurado exitosamente",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="w-5 h-5" />
          Configurar Vehículos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
              placeholder="1000"
            />
          </div>
          <Button type="submit" className="w-full" variant="secondary">
            <Truck className="w-4 h-4 mr-2" />
            Agregar Vehículo
          </Button>
        </form>

        {vehicles.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="font-semibold text-sm">Vehículos Configurados ({vehicles.length})</h3>
            <div className="space-y-2">
              {vehicles.map((vehicle, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-muted rounded-lg text-sm"
                >
                  <p className="font-semibold">{vehicle.name}</p>
                  <p className="text-muted-foreground">
                    Capacidad: {vehicle.capacity} | Dist. máx: {vehicle.max_distance} km
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VehicleConfig;
