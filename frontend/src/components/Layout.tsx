import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Play, History, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
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
  const [hasActiveSession, setHasActiveSession] = useState(false);

  const isOnNew = location.pathname === "/new";

  // Check for active session whenever location changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        setHasActiveSession((session.routes?.length > 0) || (session.pickupPoints?.length > 0) || (session.vehicles?.length > 0));
      } else {
        setHasActiveSession(false);
      }
    } catch {
      setHasActiveSession(false);
    }
  }, [location]);

  const handleNewOptimization = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.routes?.length > 0 || session.pickupPoints?.length > 0 || session.vehicles?.length > 0) {
          setShowClearDialog(true);
          return;
        }
      }
    } catch {
      // ignore
    }
    navigate('/new');
  };

  const resumeOptimization = () => {
    setShowClearDialog(false);
    navigate('/new');
  };

  const confirmNewOptimization = () => {
    localStorage.removeItem(SESSION_KEY);
    setShowClearDialog(false);
    navigate('/new');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Resume session dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="max-w-sm">
          <button
            onClick={() => setShowClearDialog(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes una optimización activa</AlertDialogTitle>
            <AlertDialogDescription>
              Hay puntos, vehículos o rutas guardados de tu sesión anterior. ¿Qué quieres hacer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
            <AlertDialogAction
              onClick={resumeOptimization}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Continuar
            </AlertDialogAction>
            <AlertDialogAction
              onClick={confirmNewOptimization}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar y empezar nueva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <div className="w-full px-4 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain cursor-pointer" />
          </Link>

          <nav className="flex gap-2">
            <Button
              variant={isOnNew ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "text-primary-foreground relative",
                isOnNew ? "bg-primary-foreground/20" : "hover:bg-primary-foreground/10"
              )}
              onClick={handleNewOptimization}
            >
              <Play className="w-4 h-4 mr-2" />
              Nueva Optimización
              {/* Green dot when there's an active session and we're not on /new */}
              {hasActiveSession && !isOnNew && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border-2 border-primary rounded-full" />
              )}
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
