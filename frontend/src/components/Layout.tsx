import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Play, History, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SESSION_KEY = 'optimizador_session';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showClearDialog, setShowClearDialog] = useState(false);

  const isOnNew = location.pathname === "/" || location.pathname === "/new";

  const handleNewOptimization = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.routes?.length > 0) {
          setShowClearDialog(true);
          return;
        }
      }
    } catch {
      // ignore
    }
    navigate('/new');
  };

  const confirmNewOptimization = () => {
    localStorage.removeItem(SESSION_KEY);
    setShowClearDialog(false);
    navigate('/new');
  };

  return (
    <div className="min-h-screen bg-background">
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Iniciar nueva optimización?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes una optimización activa. Si continúas, se perderán los puntos de recogida, vehículos y rutas configuradas actualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNewOptimization}>
              Sí, comenzar nueva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="w-full px-4 flex items-center justify-between">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
          <nav className="flex gap-2">
            <Button
              variant={isOnNew ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "text-primary-foreground",
                isOnNew ? "bg-primary-foreground/20" : "hover:bg-primary-foreground/10"
              )}
              onClick={handleNewOptimization}
            >
              <Play className="w-4 h-4 mr-2" />
              Nueva Optimización
            </Button>
            <Button
              asChild
              variant={location.pathname === "/history" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "text-primary-foreground",
                location.pathname === "/history"
                  ? "bg-primary-foreground/20"
                  : "hover:bg-primary-foreground/10"
              )}
            >
              <Link to="/history">
                <History className="w-4 h-4 mr-2" />
                Ejecuciones Anteriores
              </Link>
            </Button>
            <Button
              asChild
              variant={location.pathname === "/geocoding" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "text-primary-foreground",
                location.pathname === "/geocoding"
                  ? "bg-primary-foreground/20"
                  : "hover:bg-primary-foreground/10"
              )}
            >
              <Link to="/geocoding">
                <MapPin className="w-4 h-4 mr-2" />
                Geocodificación
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="w-full pl-4 pt-4 pb-4 pr-0">
        {children}
      </main>
    </div>
  );
};

export default Layout;
