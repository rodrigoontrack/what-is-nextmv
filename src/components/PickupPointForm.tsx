import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PickupPointFormProps {
  onAdd: (point: { name: string; address: string; latitude: number; longitude: number; quantity?: number; person_id?: string; grupo?: string }) => Promise<void>;
  editingPoint?: { id: string; name: string; address: string; latitude: number; longitude: number; quantity?: number; person_id?: string; grupo?: string } | null;
  onCancelEdit?: () => void;
}

const PickupPointForm = ({ onAdd, editingPoint, onCancelEdit }: PickupPointFormProps) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [personId, setPersonId] = useState("");
  const [grupo, setGrupo] = useState("");
  const { toast } = useToast();

  // Update form when editing point changes
  useEffect(() => {
    if (editingPoint) {
      setName(editingPoint.name);
      setAddress(editingPoint.address);
      setLatitude(editingPoint.latitude.toString());
      setLongitude(editingPoint.longitude.toString());
      // Handle quantity: use the actual value if it exists (including 0), otherwise default to 1
      // Check for null, undefined, or NaN explicitly
      const qty = editingPoint.quantity != null && !isNaN(editingPoint.quantity) 
        ? editingPoint.quantity 
        : 1;
      setQuantity(qty.toString());
      setPersonId(editingPoint.person_id || "");
      setGrupo(editingPoint.grupo || "");
    } else {
      setName("");
      setAddress("");
      setLatitude("");
      setLongitude("");
      setQuantity("1");
      setPersonId("");
      setGrupo("");
    }
  }, [editingPoint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !address || !latitude || !longitude) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    const quantityNum = parseInt(quantity, 10);
    if (isNaN(quantityNum) || quantityNum < 0) {
      toast({
        title: "Error",
        description: "La cantidad debe ser un número entero positivo",
        variant: "destructive",
      });
      return;
    }

    try {
      await onAdd({
        ...(editingPoint && { id: editingPoint.id }),
        name,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        quantity: quantityNum,
        person_id: personId.trim() || undefined,
        grupo: grupo.trim() || undefined,
      });

      if (!editingPoint) {
        setName("");
        setAddress("");
        setLatitude("");
        setLongitude("");
        setQuantity("1");
        setPersonId("");
        setGrupo("");
      }

      toast({
        title: editingPoint ? "Punto actualizado" : "Punto agregado",
        description: editingPoint 
          ? "El punto de recogida ha sido actualizado exitosamente"
          : "El punto de recogida ha sido agregado exitosamente",
      });
    } catch (error) {
      // Error handling is done in handleAddPickupPoint, but we catch here to prevent unhandled promise rejection
      console.error("Error adding/updating pickup point:", error);
    }
  };

  return (
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
          <div>
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
            />
          </div>
          <div>
            <Label htmlFor="person_id">ID Pasajero (Opcional)</Label>
            <Input
              id="person_id"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              placeholder="Ej: PER-001, PER-002 (separados por coma para múltiples)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Si no especificas un ID, este punto contará como 1 pasajero. Si especificas IDs (separados por coma), se contarán esos pasajeros específicos.
            </p>
          </div>
          <div>
            <Label htmlFor="grupo">Grupo (Opcional)</Label>
            <Input
              id="grupo"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Ej: Grupo A"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Asigna este punto a un grupo para optimizaciones separadas
            </p>
          </div>
          <div className="flex gap-2">
            {editingPoint && onCancelEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                className="flex-1"
              >
                Cancelar
              </Button>
            )}
            <Button type="submit" className={editingPoint ? "flex-1" : "w-full"}>
              <Plus className="w-4 h-4 mr-2" />
              {editingPoint ? "Actualizar Punto" : "Agregar Punto"}
            </Button>
          </div>
        </form>
  );
};

export default PickupPointForm;
