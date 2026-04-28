import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, History, MapPin, Route, Truck, Clock } from "lucide-react";
import { getOptimizations, getPickupPoints } from "@/lib/api";

const Home = () => {
  const navigate = useNavigate();
  const [totalOptimizations, setTotalOptimizations] = useState<number | null>(null);
  const [totalPickupPoints, setTotalPickupPoints] = useState<number | null>(null);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);

  useEffect(() => {
    getOptimizations()
      .then((data: any[]) => {
        setTotalOptimizations(data.length);
        setRecentRuns(data.slice(0, 5));
      })
      .catch(() => {});

    getPickupPoints()
      .then((data: any[]) => setTotalPickupPoints(data.length))
      .catch(() => {});
  }, []);

  const stats = [
    {
      label: "Optimizaciones realizadas",
      value: totalOptimizations,
      icon: Route,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Puntos de recogida registrados",
      value: totalPickupPoints,
      icon: MapPin,
      color: "text-green-600",
      bg: "bg-green-50",
    },
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 px-4 py-6">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bienvenido al Optimizador de Rutas</h1>
          <p className="text-muted-foreground mt-1">
            Planifica y optimiza rutas de transporte de forma rápida y eficiente.
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/new")}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-full bg-primary/10 p-3">
                <Play className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Nueva optimización</p>
                <p className="text-xs text-muted-foreground">Cargar puntos y vehículos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/history")}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-full bg-blue-50 p-3">
                <History className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Ejecuciones anteriores</p>
                <p className="text-xs text-muted-foreground">Ver y exportar resultados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/geocoding")}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-full bg-green-50 p-3">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Geocodificación</p>
                <p className="text-xs text-muted-foreground">Convertir direcciones a coordenadas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-full ${bg} p-3`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {value === null ? "—" : value}
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent runs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4" />
              Últimas ejecuciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground mb-4">Aún no hay ejecuciones registradas</p>
                <Button onClick={() => navigate("/new")} size="sm">
                  Crear primera optimización
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRuns.map((run: any) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate("/history")}
                  >
                    <div className="flex items-center gap-3">
                      <Route className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Optimización #{run.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {run.created_at
                            ? new Date(run.created_at).toLocaleString("es-ES", {
                                year: "numeric", month: "short", day: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : "Fecha desconocida"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-green-600 font-medium">✓ Completado</span>
                  </div>
                ))}
                {totalOptimizations !== null && totalOptimizations > 5 && (
                  <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => navigate("/history")}>
                    Ver todas ({totalOptimizations})
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
};

export default Home;
