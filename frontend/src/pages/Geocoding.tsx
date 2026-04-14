import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import Map from "@/components/Map";
import { Upload, Download, Loader2, MapPin } from "lucide-react";
import * as XLSX from "xlsx";
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

interface PassengerData {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

const GOOGLE_GEOCODING_API_KEY = "AIzaSyBYx-lRgZgoWEfAlrmSBcNAeA8ImgqWNGc";

const Geocoding = () => {
  const [file, setFile] = useState<File | null>(null);
  const [passengers, setPassengers] = useState<PassengerData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPassengers([]);
      readExcelFile(selectedFile);
    }
  };

  const readExcelFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

      // Validate required columns
      const requiredColumns = ["id", "name", "address", "city"];
      const firstRow = jsonData[0];
      if (!firstRow) {
        toast({
          title: "Error",
          description: "El archivo Excel está vacío",
          variant: "destructive",
        });
        return;
      }

      const hasAllColumns = requiredColumns.every((col) => col in firstRow);
      if (!hasAllColumns) {
        toast({
          title: "Error",
          description: "El archivo Excel debe contener las columnas: id, name, address, city",
          variant: "destructive",
        });
        return;
      }

      const passengersData: PassengerData[] = jsonData.map((row: any) => ({
        id: String(row.id || ""),
        name: String(row.name || ""),
        address: String(row.address || ""),
        city: String(row.city || ""),
      }));

      setPassengers(passengersData);
      toast({
        title: "Archivo cargado",
        description: `${passengersData.length} pasajeros encontrados`,
      });
    } catch (error) {
      console.error("Error reading Excel file:", error);
      toast({
        title: "Error",
        description: "No se pudo leer el archivo Excel",
        variant: "destructive",
      });
    }
  };

  // Clean address by removing unnecessary information that doesn't help geocoding
  const cleanAddress = (address: string): string => {
    if (!address) return "";

    let cleaned = address.trim();

    // Remove common prefixes that don't help
    cleaned = cleaned.replace(/^(dirección|direccion|address|calle|street|avenida|av\.?|avda\.?):\s*/i, "");
    
    // Remove apartment/unit numbers and related patterns
    // Patterns: Apt 123, Apt. 123, Apto 123, Apto. 123, #123, No. 123, Unit 123, Dept 123, etc.
    cleaned = cleaned.replace(/\s*(apt|apartamento|apartamento|apto|apartamento|unit|unidad|dept|departamento|dpto|dpt|#|no\.?|numero|num\.?)\s*\d+/i, "");
    
    // Remove floor numbers: Piso 3, Floor 3, 3er Piso, etc.
    cleaned = cleaned.replace(/\s*(piso|floor|nivel|level)\s*\d+/i, "");
    cleaned = cleaned.replace(/\s*\d+(er|do|ro|th|st|nd|rd)?\s*(piso|floor|nivel|level)/i, "");
    
    // Remove building/block patterns that might confuse: Edificio X, Bloque Y, Torre Z
    cleaned = cleaned.replace(/\s*(edificio|building|bloque|block|torre|tower|complejo|complex)\s+[a-z0-9]+/i, "");
    
    // Remove extra whitespace and normalize
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    
    // Remove trailing commas and punctuation that might cause issues
    cleaned = cleaned.replace(/[,;:]+$/, "").trim();

    return cleaned;
  };

  const geocodeAddress = async (address: string, city: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      // Clean the address first
      const cleanedAddress = cleanAddress(address);
      
      // Combine address and city for better geocoding accuracy
      const fullAddress = city && city.trim() 
        ? `${cleanedAddress}, ${city.trim()}` 
        : cleanedAddress;
      
      if (!fullAddress || fullAddress.trim() === "") {
        console.warn("Empty address after cleaning");
        return null;
      }

      const encodedAddress = encodeURIComponent(fullAddress);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_GEOCODING_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng,
        };
      } else if (data.status === "ZERO_RESULTS") {
        console.warn(`No results found for address: ${fullAddress}`);
        return null;
      } else {
        console.error(`Geocoding error for ${fullAddress}:`, data.status);
        return null;
      }
    } catch (error) {
      console.error(`Error geocoding address ${address}:`, error);
      return null;
    }
  };

  const handleStartGeocoding = () => {
    if (passengers.length === 0) {
      toast({
        title: "Error",
        description: "Por favor, carga un archivo Excel primero",
        variant: "destructive",
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const processGeocoding = async () => {
    setShowConfirmDialog(false);
    setIsProcessing(true);
    setProgress({ current: 0, total: passengers.length });

    const updatedPassengers: PassengerData[] = [];

    for (let i = 0; i < passengers.length; i++) {
      const passenger = passengers[i];
      setProgress({ current: i + 1, total: passengers.length });

      if (!passenger.address || passenger.address.trim() === "") {
        updatedPassengers.push({ ...passenger });
        continue;
      }

      // Add a small delay to avoid rate limiting (Google allows up to 50 requests/second)
      if (i > 0 && i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const location = await geocodeAddress(passenger.address, passenger.city || "");
      if (location) {
        updatedPassengers.push({
          ...passenger,
          latitude: location.lat,
          longitude: location.lng,
        });
      } else {
        updatedPassengers.push({ ...passenger });
      }
    }

    setPassengers(updatedPassengers);
    setIsProcessing(false);

    const successCount = updatedPassengers.filter((p) => p.latitude && p.longitude).length;
    toast({
      title: "Geocodificación completada",
      description: `${successCount} de ${passengers.length} direcciones geocodificadas`,
    });
  };

  const downloadExcel = () => {
    if (passengers.length === 0) {
      toast({
        title: "Error",
        description: "No hay datos para descargar",
        variant: "destructive",
      });
      return;
    }

    // Prepare data for Excel
    const excelData = passengers.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      latitude: p.latitude ?? "",
      longitude: p.longitude ?? "",
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Geocoded Data");

    // Generate Excel file and download
    const fileName = `geocoded_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Descarga completada",
      description: `Archivo ${fileName} descargado exitosamente`,
    });
  };

  // Convert geocoded passengers to pickup points format for the map
  const mapPickupPoints = useMemo(() => {
    return passengers
      .filter((p) => p.latitude !== undefined && p.longitude !== undefined)
      .map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        latitude: p.latitude!,
        longitude: p.longitude!,
      }));
  }, [passengers]);

  const hasGeocodedPoints = mapPickupPoints.length > 0;

  // Calculate cost: $0.005 per address
  const geocodingCost = passengers.length * 0.005;

  return (
    <Layout>
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Geocodificación</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4">
              <p>
                Estás a punto de gastarte un buen billete. La geocodificación de{" "}
                <strong>{passengers.length}</strong> direcciones cuesta:
              </p>
              <div className="flex items-center justify-center py-4">
                <span className="text-5xl font-bold text-destructive">
                  USD ${geocodingCost.toFixed(2)}
                </span>
              </div>
              <p className="text-center font-semibold">
                ¿A lo bien quieres proceder?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={processGeocoding} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, proceder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="container mx-auto max-w-[1800px] py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Geocodificación de Direcciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Carga un archivo Excel con las columnas: <strong>id</strong>, <strong>name</strong>, <strong>address</strong>, y <strong>city</strong>.
                  El sistema limpiará automáticamente las direcciones y obtendrá las coordenadas (latitud y longitud) para cada dirección usando la ciudad para mayor precisión.
                </p>
              </div>

              <div className="flex gap-4 items-center">
                <label htmlFor="excel-upload-geocoding" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => document.getElementById("excel-upload-geocoding")?.click()}
                    disabled={isProcessing}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {file ? "Cambiar archivo" : "Subir Excel"}
                  </Button>
                  <input
                    id="excel-upload-geocoding"
                    type="file"
                    accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isProcessing}
                  />
                </label>

                {file && (
                  <span className="text-sm text-muted-foreground">
                    {file.name}
                  </span>
                )}
              </div>

              {passengers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {passengers.length} pasajeros cargados
                      {hasGeocodedPoints && (
                        <span className="ml-2 text-muted-foreground">
                          ({mapPickupPoints.length} geocodificados)
                        </span>
                      )}
                    </p>
                    <Button
                      onClick={handleStartGeocoding}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Procesando... ({progress.current}/{progress.total})
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4 mr-2" />
                          Iniciar Geocodificación
                        </>
                      )}
                    </Button>
                  </div>

                  {isProcessing && (
                    <div className="w-full bg-secondary rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${(progress.current / progress.total) * 100}%`,
                        }}
                      />
                    </div>
                  )}

                  {passengers.some((p) => p.latitude && p.longitude) && (
                    <Button
                      onClick={downloadExcel}
                      className="w-full sm:w-auto"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Excel con Coordenadas
                    </Button>
                  )}

                  {/* Map and Table in a grid layout */}
                  {hasGeocodedPoints && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="h-[600px]">
                        <CardHeader>
                          <CardTitle className="text-lg">Vista Previa en Mapa</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 h-[calc(100%-80px)]">
                          <Map
                            pickupPoints={mapPickupPoints}
                            routes={[]}
                          />
                        </CardContent>
                      </Card>

                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-[600px]">
                          <table className="w-full text-sm">
                            <thead className="bg-muted sticky top-0">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">ID</th>
                                <th className="px-4 py-2 text-left font-medium">Nombre</th>
                                <th className="px-4 py-2 text-left font-medium">Dirección</th>
                                <th className="px-4 py-2 text-left font-medium">Ciudad</th>
                                <th className="px-4 py-2 text-left font-medium">Latitud</th>
                                <th className="px-4 py-2 text-left font-medium">Longitud</th>
                              </tr>
                            </thead>
                            <tbody>
                              {passengers.map((passenger, index) => (
                                <tr
                                  key={`${passenger.id}-${index}`}
                                  className={`border-t hover:bg-muted/50 ${
                                    passenger.latitude !== undefined && passenger.longitude !== undefined
                                      ? "bg-green-50/50"
                                      : ""
                                  }`}
                                >
                                  <td className="px-4 py-2">{passenger.id}</td>
                                  <td className="px-4 py-2">{passenger.name}</td>
                                  <td className="px-4 py-2">{passenger.address}</td>
                                  <td className="px-4 py-2">{passenger.city}</td>
                                  <td className="px-4 py-2">
                                    {passenger.latitude !== undefined
                                      ? passenger.latitude.toFixed(6)
                                      : "-"}
                                  </td>
                                  <td className="px-4 py-2">
                                    {passenger.longitude !== undefined
                                      ? passenger.longitude.toFixed(6)
                                      : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Table only if no geocoded points yet */}
                  {!hasGeocodedPoints && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-sm">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">ID</th>
                              <th className="px-4 py-2 text-left font-medium">Nombre</th>
                              <th className="px-4 py-2 text-left font-medium">Dirección</th>
                              <th className="px-4 py-2 text-left font-medium">Ciudad</th>
                              <th className="px-4 py-2 text-left font-medium">Latitud</th>
                              <th className="px-4 py-2 text-left font-medium">Longitud</th>
                            </tr>
                          </thead>
                          <tbody>
                            {passengers.map((passenger, index) => (
                              <tr
                                key={`${passenger.id}-${index}`}
                                className="border-t hover:bg-muted/50"
                              >
                                <td className="px-4 py-2">{passenger.id}</td>
                                <td className="px-4 py-2">{passenger.name}</td>
                                <td className="px-4 py-2">{passenger.address}</td>
                                <td className="px-4 py-2">{passenger.city}</td>
                                <td className="px-4 py-2">
                                  {passenger.latitude !== undefined
                                    ? passenger.latitude.toFixed(6)
                                    : "-"}
                                </td>
                                <td className="px-4 py-2">
                                  {passenger.longitude !== undefined
                                    ? passenger.longitude.toFixed(6)
                                    : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Geocoding;
