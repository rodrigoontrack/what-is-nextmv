import React, { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  quantity?: number;
  person_id?: string;
  grupo?: string;
  group?: string; // Group identifier (local only)
  group_color?: string; // Group color (local only)
  all_nombres?: string[]; // All passenger names when quantity >= 2
}

interface PickupPointsListProps {
  points: PickupPoint[];
  onRemove: (pointId: string) => void;
  onPointClick?: (point: PickupPoint) => void;
  onEdit?: (point: PickupPoint) => void;
  activeGroupFilter?: string | "ALL";
  onGroupFilterChange?: (value: string | "ALL") => void;
  onClearAllGroups?: () => void;
}

const PickupPointsList = ({
  points,
  onRemove,
  onPointClick,
  onEdit,
  activeGroupFilter: controlledActiveGroupFilter,
  onGroupFilterChange,
  onClearAllGroups,
}: PickupPointsListProps) => {
  const [uncontrolledFilter, setUncontrolledFilter] = useState<string | "ALL">("ALL");
  const activeGroupFilter = controlledActiveGroupFilter ?? uncontrolledFilter;

  const setFilter = (value: string | "ALL") => {
    if (onGroupFilterChange) {
      onGroupFilterChange(value);
    } else {
      setUncontrolledFilter(value);
    }
  };

  // Build list of unique groups (prefer local `group`, fall back to `grupo`)
  const groupOptions = useMemo(() => {
    const map = new Map<string, { color?: string; source: "group" | "grupo" }>();

    points.forEach((point) => {
      const label = point.group || point.grupo;
      if (!label) return;

      if (!map.has(label)) {
        map.set(label, {
          color: point.group ? point.group_color : undefined,
          source: point.group ? "group" : "grupo",
        });
      }
    });

    return Array.from(map.entries()).map(([label, meta]) => ({
      label,
      color: meta.color,
      source: meta.source,
    }));
  }, [points]);

  // Text search for passengers by name or ID
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPointsByGroup =
    activeGroupFilter === "ALL"
      ? points
      : points.filter((point) => (point.group || point.grupo) === activeGroupFilter);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredPoints = normalizedSearch
    ? filteredPointsByGroup.filter((point) => {
        // Match by person_id (IDs)
        const personIdMatch = point.person_id
          ? point.person_id.toLowerCase().includes(normalizedSearch)
          : false;

        // Match by passenger names in all_nombres
        const namesMatch = Array.isArray(point.all_nombres)
          ? point.all_nombres.some((name) =>
              name?.toLowerCase().includes(normalizedSearch)
            )
          : false;

        // Also allow matching by point.name as a small convenience
        const pointNameMatch = point.name
          ? point.name.toLowerCase().includes(normalizedSearch)
          : false;

        return personIdMatch || namesMatch || pointNameMatch;
      })
    : filteredPointsByGroup;

  const hasLocalGroups = points.some((p) => p.group);

  const handleExportToExcel = () => {
    // Build rows based on currently visible points (respecting group filter)
    const sourcePoints = filteredPoints;

    // Header row
    const data: any[][] = [
      [
        "Persona ID",
        "Nombre",
        "Dirección",
        "Latitud",
        "Longitud",
        "Grupo",
        "Color grupo",
      ],
    ];

    sourcePoints.forEach((point) => {
      const personIds = point.person_id
        ? point.person_id.split(",").map((id) => id.trim()).filter(Boolean)
        : [""];

      const names =
        point.all_nombres && point.all_nombres.length > 0
          ? point.all_nombres
          : [""];

      const maxLength = Math.max(personIds.length, names.length);

      for (let i = 0; i < maxLength; i++) {
        const personaId = personIds[i] ?? personIds[personIds.length - 1] ?? "";
        const nombre = names[i] ?? names[names.length - 1] ?? "";

        data.push([
          personaId,
          nombre,
          point.address ?? "",
          point.latitude,
          point.longitude,
          point.group || point.grupo || "",
          point.group_color || "",
        ]);
      }
    });

    // Lazy-load XLSX only when needed to avoid adding it to the main bundle for this component
    import("xlsx").then((XLSX) => {
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Puntos de recogida");

      const date = new Date().toISOString().split("T")[0];
      const filename = `puntos_recogida_${date}.xlsx`;
      XLSX.writeFile(workbook, filename);
    });
  };

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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Puntos de Recogida ({points.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasLocalGroups && onClearAllGroups && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                  >
                    Quitar todos los grupos
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Quitar todos los grupos?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción quitará todos los grupos y sus colores de los puntos de recogida,
                      pero los puntos seguirán existiendo en el mapa y en la lista.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onClearAllGroups}
                    >
                      Quitar grupos
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportToExcel}
            >
              Descargar Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar pasajero por nombre o ID"
            className="h-8 text-xs"
          />
        </div>

        {groupOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`px-2 py-0.5 rounded-full border text-xs font-medium transition-colors ${
                activeGroupFilter === "ALL"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Todos
            </button>
            {groupOptions.map((group) => {
              const isActive = activeGroupFilter === group.label;
              const isLocalGroup = group.source === "group";
              const baseClasses =
                "px-2 py-0.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer";

              if (isLocalGroup && group.color) {
                return (
                  <button
                    key={group.label}
                    type="button"
                    onClick={() =>
                      setFilter(activeGroupFilter === group.label ? "ALL" : group.label)
                    }
                    className={baseClasses}
                    style={{
                      backgroundColor: isActive ? group.color : `${group.color}20`,
                      borderColor: group.color,
                      color: "#ffffff",
                    }}
                  >
                    {group.label}
                  </button>
                );
              }

              // Fallback style for `grupo` (Supabase) or groups without explicit color
              return (
                <button
                  key={group.label}
                  type="button"
                  onClick={() =>
                    setFilter(activeGroupFilter === group.label ? "ALL" : group.label)
                  }
                  className={`${baseClasses} ${
                    isActive
                      ? "bg-purple-600 text-white border-purple-700"
                      : "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                  }`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {filteredPoints.map((point) => (
            <div
              key={point.id}
              className="p-3 bg-muted rounded-lg flex items-start justify-between gap-2 hover:bg-muted/80 transition-colors cursor-pointer"
              onClick={() => onPointClick?.(point)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{point.name}</p>
                  {point.group && (
                    <span
                      className="px-2 py-0.5 text-xs font-semibold rounded-md border flex-shrink-0 text-white"
                      style={{
                        backgroundColor: point.group_color || "#8b5cf6",
                        borderColor: point.group_color || "#8b5cf6",
                      }}
                    >
                      {point.group}
                    </span>
                  )}
                  {point.grupo && !point.group && (
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
                  {point.person_id && (
                    <p className="text-xs font-semibold text-blue-600">
                      ID Persona: {point.person_id}
                    </p>
                  )}
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

