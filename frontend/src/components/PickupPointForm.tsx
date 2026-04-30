import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PickupPointFormProps {
  onAdd: (point: { address: string; latitude: number; longitude: number; quantity?: number; person_id?: string; all_nombres?: string[] }) => Promise<void>;
  editingPoint?: { id: string; name: string; address: string; latitude: number; longitude: number; quantity?: number; person_id?: string; grupo?: string; all_nombres?: string[] } | null;
  onCancelEdit?: () => void;
}

const PickupPointForm = ({ onAdd, editingPoint, onCancelEdit }: PickupPointFormProps) => {
  const [passengerName, setPassengerName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [personId, setPersonId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (editingPoint) {
      // When editing, show the first all_nombres entry (or name) as the passenger name
      const isAutoTitle = /^Punto \d+$/.test(editingPoint.name || "");
      setPassengerName(editingPoint.all_nombres?.[0] || (isAutoTitle ? "" : editingPoint.name) || "");
      setAddress(editingPoint.address);
      setLatitude(editingPoint.latitude.toString());
      setLongitude(editingPoint.longitude.toString());
      const qty = editingPoint.quantity != null && !isNaN(editingPoint.quantity)
        ? editingPoint.quantity
        : 1;
      setQuantity(qty.toString());
      setPersonId(editingPoint.person_id || "");
    } else {
      setPassengerName("");
      setAddress("");
      setLatitude("");
      setLongitude("");
      setQuantity("1");
      setPersonId("");
    }
  }, [editingPoint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !latitude || !longitude) {
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
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        quantity: quantityNum,
        person_id: personId.trim() || undefined,
        all_nombres: passengerName.trim() ? [passengerName.trim()] : undefined,
      });

      if (!editingPoint) {
        setPassengerName("");
        setAddress("");
        setLatitude("");
        setLongitude("");
        setQuantity("1");
        setPersonId("");
      }

      toast({
        title: editingPoint ? "Punto actualizado" : "Punto agregado",
        description: editingPoint
          ? "El punto de recogida ha sido actualizado exitosamente"
          : "El punto de recogida ha sido agregado exitosamente",
      });
    } catch (error) {
      console.error("Error adding/updating pickup point:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="passengerName">Nombre del pasajero (Opcional)</Label>
        <Input
          id="passengerName"
          value={passengerName}
          onChange={(e) => setPassengerName(e.target.value)}
          placeholder="Ej: Juan García"
        />
      </div>
      <div>
        <Label htmlFor="address">Dirección</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ej: Calle 118 # 14-20"
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
            placeholder="4.7110"
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
            placeholder="-74.0721"
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
        <Label htmlFor="person_id">Documento / Código (Opcional)</Label>
        <Input
          id="person_id"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          placeholder="Ej: 1234567890"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Documento o código identificador del pasajero a recoger en este punto
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
