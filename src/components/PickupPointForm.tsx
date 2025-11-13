import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PickupPointFormProps {
  onAdd: (point: { name: string; address: string; latitude: number; longitude: number }) => void;
}

const PickupPointForm = ({ onAdd }: PickupPointFormProps) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !address || !latitude || !longitude) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    onAdd({
      name,
      address,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    });

    setName("");
    setAddress("");
    setLatitude("");
    setLongitude("");

    toast({
      title: "Punto agregado",
      description: "El punto de recogida ha sido agregado exitosamente",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Agregar Punto de Recogida
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Bodega Centro"
            />
          </div>
          <div>
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Reforma 123"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude">Latitud</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="19.4326"
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitud</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="-99.1332"
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Punto
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PickupPointForm;
