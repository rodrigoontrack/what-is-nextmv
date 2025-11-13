import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Map from "@/components/Map";
import PickupPointForm from "@/components/PickupPointForm";
import VehicleConfig from "@/components/VehicleConfig";
import { Play, MapPin, Truck, Route } from "lucide-react";
import { Loader2 } from "lucide-react";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Vehicle {
  id?: string;
  name: string;
  capacity: number;
  max_distance: number;
}

const Index = () => {
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPickupPoints();
    loadVehicles();
  }, []);

  const loadPickupPoints = async () => {
    const { data, error } = await supabase.from("pickup_points").select("*");
    if (error) {
      console.error("Error loading pickup points:", error);
      return;
    }
    setPickupPoints(data || []);
  };

  const loadVehicles = async () => {
    const { data, error } = await supabase.from("vehicles").select("*");
    if (error) {
      console.error("Error loading vehicles:", error);
      return;
    }
    setVehicles(data || []);
  };

  const handleAddPickupPoint = async (point: Omit<PickupPoint, "id">) => {
    const { data, error } = await supabase
      .from("pickup_points")
      .insert([point])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el punto de recogida",
        variant: "destructive",
      });
      return;
    }

    setPickupPoints([...pickupPoints, data]);
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
    try {
      const { data, error } = await supabase.functions.invoke("optimize-routes", {
        body: { pickupPoints, vehicles },
      });

      if (error) throw error;

      toast({
        title: "Rutas optimizadas",
        description: "Las rutas han sido calculadas exitosamente",
      });

      // Reload routes from database
      const { data: routesData } = await supabase
        .from("routes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(vehicles.length);

      setRoutes(routesData || []);
    } catch (error) {
      console.error("Error optimizing routes:", error);
      toast({
        title: "Error",
        description: "No se pudieron optimizar las rutas",
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
          <Truck className="w-8 h-8" />
          <h1 className="text-2xl font-bold">LogiTrack</h1>
          <span className="bg-primary-foreground text-primary px-3 py-1 rounded-full text-xs font-semibold ml-2">
            Enterprise
          </span>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <PickupPointForm onAdd={handleAddPickupPoint} />
            <VehicleConfig onAdd={handleAddVehicle} vehicles={vehicles} />
            <Button
              onClick={handleOptimizeRoutes}
              disabled={isOptimizing || pickupPoints.length < 2 || vehicles.length === 0}
              className="w-full bg-primary hover:bg-primary/90 h-14 text-lg font-bold"
              size="lg"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Optimizando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Optimizar Rutas
                </>
              )}
            </Button>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-[calc(100vh-240px)]">
              <CardContent className="p-0 h-full">
                <Map pickupPoints={pickupPoints} routes={routes} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
