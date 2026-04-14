import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Trash2, Edit } from "lucide-react";
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

interface PickupPointsListProps {
  points: PickupPoint[];
  onRemove: (pointId: string) => void;
  onPointClick?: (point: PickupPoint) => void;
  onEdit?: (point: PickupPoint) => void;
}

const PickupPointsList = ({ points, onRemove, onPointClick, onEdit }: PickupPointsListProps) => {

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Puntos de Recogida ({points.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay puntos de recogida agregados. Haz clic en el mapa para agregar puntos.
          </p>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Puntos de Recogida ({points.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {points.map((point) => (
            <div
              key={point.id}
              className="p-3 bg-muted rounded-lg flex items-start justify-between gap-2 hover:bg-muted/80 transition-colors cursor-pointer"
              onClick={() => onPointClick?.(point)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{point.name}</p>
                  {point.grupo && (
                    <span className="px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-md border border-purple-300 flex-shrink-0">
                      {point.grupo}
                    </span>
                  )}
                </div>
                {/* Show all passenger names when quantity >= 2 */}
                {point.quantity && point.quantity >= 2 && point.all_nombres && point.all_nombres.length > 0 && (
                  <div className="mt-1 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Pasajeros:</p>
                    <div className="flex flex-wrap gap-1">
                      {point.all_nombres.map((nombre, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-medium"
                        >
                          {nombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {typeof point.latitude === 'number' ? point.latitude : String(point.latitude)}, {typeof point.longitude === 'number' ? point.longitude : String(point.longitude)}
                </p>
                {point.address && point.address !== `${point.latitude}, ${point.longitude}` && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Dirección: {point.address}
                  </p>
                )}
                <div className="flex gap-3 mt-1 flex-wrap">
                  <p className="text-xs font-semibold text-primary">
                    Cantidad: {point.quantity !== undefined && point.quantity !== null ? point.quantity : 1}
                  </p>
                  {/* Temporarily hidden - persona ID display */}
                  {/* {point.person_id && (
                    <p className="text-xs font-semibold text-blue-600">
                      ID Persona: {point.person_id}
                    </p>
                  )} */}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(point);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar punto de recogida?</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Estás seguro de que deseas eliminar "{point.name}"? Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onRemove(point.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
};

export default PickupPointsList;

