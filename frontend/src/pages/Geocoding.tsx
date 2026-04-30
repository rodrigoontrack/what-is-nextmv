import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import Map from "@/components/Map";
import { Upload, Download, Loader2, MapPin, FileDown, Pencil, X } from "lucide-react";
import * as XLSX from "xlsx";

interface PassengerData {
  codigo: string;
  name: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

const GOOGLE_GEOCODING_API_KEY = import.meta.env.VITE_GOOGLE_GEOCODING_API_KEY as string;

const Geocoding = () => {
  const [file, setFile] = useState<File | null>(null);
  const [passengers, setPassengers] = useState<PassengerData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [correctingIndex, setCorrectingIndex] = useState<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (correctingIndex === null) return;
    mapContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCorrectingIndex(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [correctingIndex]);

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

      const requiredColumns = ["codigo", "nombre", "direccion", "ciudad"];
      const firstRow = jsonData[0];
      if (!firstRow) {
        toast({ title: "Error", description: "El archivo Excel está vacío", variant: "destructive" });
        return;
      }

      const hasAllColumns = requiredColumns.every((col) => col in firstRow);
      if (!hasAllColumns) {
        toast({
          title: "Error",
          description: "El archivo Excel debe contener las columnas: codigo, nombre, direccion, ciudad. Descarga la plantilla para ver el formato correcto.",
          variant: "destructive",
        });
        return;
      }

      const passengersData: PassengerData[] = jsonData.map((row: any) => ({
        codigo: String(row.codigo || ""),
        name: String(row.nombre || ""),
        address: String(row.direccion || ""),
        city: String(row.ciudad || ""),
      }));

      setPassengers(passengersData);
      toast({ title: "Archivo cargado", description: `${passengersData.length} pasajeros encontrados` });
    } catch (error) {
      console.error("Error reading Excel file:", error);
      toast({ title: "Error", description: "No se pudo leer el archivo Excel", variant: "destructive" });
    }
  };

  const cleanAddress = (address: string): string => {
    if (!address) return "";
    // Only normalize whitespace and trailing punctuation — Colombian addresses
    // use # as a structural separator (e.g. "Calle 118 # 14-20") so no content is removed.
    return address.trim().replace(/\s+/g, " ").replace(/[,;:]+$/, "").trim();
  };

  const geocodeAddress = async (address: string, city: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const cleanedAddress = cleanAddress(address);
      const fullAddress = city && city.trim() ? `${cleanedAddress}, ${city.trim()}` : cleanedAddress;

      if (!fullAddress || fullAddress.trim() === "") return null;

      const encodedAddress = encodeURIComponent(fullAddress);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_GEOCODING_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
      }
      return null;
    } catch (error) {
      console.error(`Error geocoding address ${address}:`, error);
      return null;
    }
  };

  const handleStartGeocoding = () => {
    if (passengers.length === 0) {
      toast({ title: "Error", description: "Por favor, carga un archivo Excel primero", variant: "destructive" });
      return;
    }
    processGeocoding();
  };

  const processGeocoding = async () => {
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

      if (i > 0 && i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const location = await geocodeAddress(passenger.address, passenger.city || "");
      if (location) {
        updatedPassengers.push({ ...passenger, latitude: location.lat, longitude: location.lng });
      } else {
        updatedPassengers.push({ ...passenger });
      }
    }

    setPassengers(updatedPassengers);
    setIsProcessing(false);

    const successCount = updatedPassengers.filter((p) => p.latitude && p.longitude).length;
    toast({ title: "Geocodificación completada", description: `${successCount} de ${passengers.length} direcciones geocodificadas` });
  };

  const handleMapClick = (lng: number, lat: number) => {
    if (correctingIndex === null) return;
    setPassengers((prev) =>
      prev.map((p, i) => (i === correctingIndex ? { ...p, latitude: lat, longitude: lng } : p))
    );
    toast({
      title: "Coordenadas actualizadas",
      description: `Ubicación de ${passengers[correctingIndex].name} corregida`,
    });
    setCorrectingIndex(null);
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([["codigo", "nombre", "direccion", "ciudad"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    XLSX.writeFile(workbook, "plantilla_geocodificacion.xlsx");
  };

  const downloadExcel = () => {
    if (passengers.length === 0) {
      toast({ title: "Error", description: "No hay datos para descargar", variant: "destructive" });
      return;
    }

    // Columns match the pickup points template exactly
    const excelData = passengers.map((p) => ({
      nombre: p.name,
      direccion: p.address,
      latitud: p.latitude ?? "",
      longitud: p.longitude ?? "",
      codigo: p.codigo,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Geocoded Data");

    const fileName = `geocoded_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({ title: "Descarga completada", description: `Archivo ${fileName} descargado exitosamente` });
  };

  const mapPickupPoints = useMemo(() => {
    return passengers
      .filter((p) => p.latitude !== undefined && p.longitude !== undefined)
      .map((p) => ({
        id: p.codigo,
        name: p.name,
        address: p.address,
        latitude: p.latitude!,
        longitude: p.longitude!,
      }));
  }, [passengers]);

  const hasGeocodedPoints = mapPickupPoints.length > 0;

  const correctingPassenger = correctingIndex !== null ? passengers[correctingIndex] : null;

  const tableRows = (passengers: PassengerData[], showCorrectButton: boolean) =>
    passengers.map((passenger, index) => (
      <tr
        key={`${passenger.codigo}-${index}`}
        className={`border-t hover:bg-muted/50 transition-colors ${
          correctingIndex === index
            ? "bg-yellow-50 ring-1 ring-inset ring-yellow-400"
            : passenger.latitude !== undefined && passenger.longitude !== undefined
            ? "bg-green-50/50"
            : ""
        }`}
      >
        <td className="px-3 py-2 text-xs text-muted-foreground">{passenger.codigo}</td>
        <td className="px-3 py-2 font-medium">{passenger.name}</td>
        <td className="px-3 py-2 text-sm max-w-[220px]">
          <span className="block truncate" title={passenger.address}>{passenger.address}</span>
        </td>
        <td className="px-3 py-2">
          {passenger.latitude !== undefined ? (
            <span className="text-xs font-mono leading-tight block">
              {passenger.latitude.toFixed(6)}
              <br />
              {passenger.longitude!.toFixed(6)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Sin geocodificar</span>
          )}
        </td>
        {showCorrectButton && (
          <td className="px-3 py-2">
            {passenger.latitude !== undefined && (
              <Button
                variant={correctingIndex === index ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                title="Corregir ubicación en mapa"
                onClick={() => setCorrectingIndex(correctingIndex === index ? null : index)}
              >
                <Pencil className="w-3 h-3" />
                {correctingIndex === index ? "Cancelar" : "Corregir"}
              </Button>
            )}
          </td>
        )}
      </tr>
    ));

  return (
    <Layout>
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
              <p className="text-sm text-muted-foreground">
                Descarga la plantilla, diligénciala y cárgala para obtener las coordenadas de cada dirección.
              </p>

              <div className="flex gap-4 items-center">
                <Button variant="outline" onClick={downloadTemplate} disabled={isProcessing}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Descargar plantilla
                </Button>

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
                  <span className="text-sm text-muted-foreground">{file.name}</span>
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
                    <Button onClick={handleStartGeocoding} disabled={isProcessing}>
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
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  )}

                  {passengers.some((p) => p.latitude && p.longitude) && (
                    <Button onClick={downloadExcel} className="w-full sm:w-auto">
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Excel con Coordenadas
                    </Button>
                  )}

                  {/* Map — shown when there are geocoded points */}
                  {hasGeocodedPoints && (
                    <div className="space-y-2">
                      {correctingPassenger && (
                        <div className="flex items-center justify-between gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                          <span>
                            <strong>Modo corrección:</strong> haz clic en el mapa para reubicar a{" "}
                            <strong>{correctingPassenger.name}</strong>. Presiona Escape para cancelar.
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100"
                            onClick={() => setCorrectingIndex(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      <div ref={mapContainerRef} className="rounded-lg overflow-hidden border h-[450px]">
                        <Map
                          pickupPoints={mapPickupPoints}
                          routes={[]}
                          clickMode={correctingIndex !== null}
                          onMapClick={handleMapClick}
                        />
                      </div>
                    </div>
                  )}

                  {/* Table — always shown when there are passengers */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-y-auto max-h-[400px]">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-xs">Documento / Código</th>
                            <th className="px-3 py-2 text-left font-medium text-xs">Nombre</th>
                            <th className="px-3 py-2 text-left font-medium text-xs">Dirección</th>
                            <th className="px-3 py-2 text-left font-medium text-xs">Coordenadas</th>
                            {hasGeocodedPoints && <th className="px-3 py-2 text-left font-medium text-xs"></th>}
                          </tr>
                        </thead>
                        <tbody>{tableRows(passengers, hasGeocodedPoints)}</tbody>
                      </table>
                    </div>
                  </div>
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
