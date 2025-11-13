import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

interface PickupPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface MapProps {
  pickupPoints: PickupPoint[];
  routes: any[];
  onMapClick?: (lng: number, lat: number) => void;
}

const MAPBOX_TOKEN = "pk.eyJ1Ijoicm9kcmlnb2l2YW5mIiwiYSI6ImNtaHhoOHk4azAxNjcyanExb2E2dHl6OTMifQ.VO6hcKB-pIDvb8ZFFpLdfw";

const Map = ({ pickupPoints, routes, onMapClick }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-99.1332, 19.4326], // Mexico City default
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    if (onMapClick) {
      map.current.on("click", (e) => {
        onMapClick(e.lngLat.lng, e.lngLat.lat);
      });
    }

    return () => {
      map.current?.remove();
    };
  }, [onMapClick]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers and layers
    const existingMarkers = document.querySelectorAll(".mapboxgl-marker");
    existingMarkers.forEach((marker) => marker.remove());

    if (map.current.getLayer("route")) {
      map.current.removeLayer("route");
    }
    if (map.current.getSource("route")) {
      map.current.removeSource("route");
    }

    // Add pickup point markers
    pickupPoints.forEach((point) => {
      const el = document.createElement("div");
      el.className = "w-8 h-8 bg-primary rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs";
      el.textContent = "📍";

      new mapboxgl.Marker(el)
        .setLngLat([point.longitude, point.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <h3 class="font-bold">${point.name}</h3>
              <p class="text-sm">${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}</p>
            </div>`
          )
        )
        .addTo(map.current!);
    });

    // Draw routes
    if (routes.length > 0 && routes[0].route_data?.route) {
      const routeCoordinates = routes[0].route_data.route.map((stop: any) => [
        stop.location.lon,
        stop.location.lat,
      ]);

      map.current!.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: routeCoordinates,
          },
        },
      });

      map.current!.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#10b981",
          "line-width": 4,
        },
      });
    }

    // Fit map to show all points
    if (pickupPoints.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      pickupPoints.forEach((point) => {
        bounds.extend([point.longitude, point.latitude]);
      });
      map.current!.fitBounds(bounds, { padding: 50 });
    }
  }, [pickupPoints, routes, mapLoaded]);

  return <div ref={mapContainer} className="w-full h-full rounded-lg shadow-lg" />;
};

export default Map;
