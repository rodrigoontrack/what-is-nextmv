import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  quantity?: number;
  person_id?: string;
  grupo?: string;
}

interface Vehicle {
  id?: string;
  name: string;
  capacity?: number;
  max_distance?: number;
  start_location?: {
    lon: number;
    lat: number;
  };
  end_location?: {
    lon: number;
    lat: number;
  };
}

interface MapProps {
  pickupPoints: PickupPoint[];
  routes: any[];
  vehicles?: Vehicle[];
  visibleRoutes?: Set<number>; // Set of route indices that should be visible
  onRouteVisibilityChange?: (routeIndex: number, visible: boolean) => void;
  onMapClick?: (lng: number, lat: number) => void;
  clickMode?: boolean;
  focusedPoint?: PickupPoint | null;
  vehicleLocationMode?: "start" | "end" | null;
  vehicleStartLocation?: { lon: number; lat: number } | null;
  vehicleEndLocation?: { lon: number; lat: number } | null;
  selectedRouteIndex?: number | null; // Index of the selected route to zoom to and highlight
  focusLocation?: { lon: number; lat: number } | null; // Specific location to zoom to
  zoomToRoute?: number | null; // Trigger to zoom to a specific route
  initialCenter?: [number, number]; // [lng, lat] for initial map center
  orgLocation?: [number, number]; // [lng, lat] of the organization — shown as home marker after optimization
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const Map = ({ pickupPoints, routes, vehicles = [], visibleRoutes, onRouteVisibilityChange, onMapClick, clickMode = false, focusedPoint, vehicleLocationMode, vehicleStartLocation, vehicleEndLocation, selectedRouteIndex, focusLocation, zoomToRoute, initialCenter, orgLocation }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenter ?? [-74.0721, 4.7110],
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize();
    });
    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => {
        marker.remove();
      });
      markersRef.current = [];
      map.current?.remove();
    };
  }, []);

  // Add click handler separately to handle clickMode changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const clickHandler = (e: mapboxgl.MapMouseEvent) => {
      // Only call onMapClick if clickMode is enabled or vehicle location mode is active
      if (onMapClick && (clickMode || vehicleLocationMode !== null)) {
        onMapClick(e.lngLat.lng, e.lngLat.lat);
      }
    };

    map.current.on("click", clickHandler);

    return () => {
      map.current?.off("click", clickHandler);
    };
  }, [onMapClick, clickMode, mapLoaded, vehicleLocationMode]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers properly
    markersRef.current.forEach((marker) => {
      marker.remove();
    });
    markersRef.current = [];

    // Remove all existing route layers
    try {
      const style = map.current.getStyle();
      if (style && style.layers) {
        const layersToRemove: string[] = [];
        const sourcesToRemove: string[] = [];
        
        style.layers.forEach((layer) => {
          if (layer.id.startsWith("route-")) {
            layersToRemove.push(layer.id);
          }
        });
        
        layersToRemove.forEach((layerId) => {
          try {
            if (map.current!.getLayer(layerId)) {
              map.current!.removeLayer(layerId);
            }
          } catch (e) {
            // Layer might already be removed, ignore
          }
        });
        
        // Remove sources
        if (style.sources) {
          Object.keys(style.sources).forEach((sourceId) => {
            if (sourceId.startsWith("route-")) {
              sourcesToRemove.push(sourceId);
            }
          });
        }
        
        sourcesToRemove.forEach((sourceId) => {
          try {
            if (map.current!.getSource(sourceId)) {
              map.current!.removeSource(sourceId);
            }
          } catch (e) {
            // Source might already be removed, ignore
          }
        });
      }
    } catch (e) {
      // Style might not be loaded yet, continue anyway
      console.warn("Could not clean up layers:", e);
    }

    // Helper function to extract original point ID from encoded stop ID
    // Format: {point.id}__person_{person_id} or just {point.id}
    const extractOriginalPointId = (stopId: string): string => {
      if (!stopId) return stopId;
      const index = stopId.indexOf('__person_');
      return index > -1 ? stopId.substring(0, index) : stopId;
    };

    // Build a map of stop IDs to their order in routes (starting from 0 for start, 1 for first stop)
    // Use Object.create(null) to avoid Map constructor conflict with component name
    const stopOrderMap: Record<string, number> = {};
    // Build a map to track which points are start points
    const stopIsStartPointMap: Record<string, boolean> = {};
    // Build a map of stop IDs to route indices for coloring markers (use first route for color)
    const stopToRouteIndexMap: Record<string, number> = {};
    // Build a map of stop IDs to all route indices that contain them (for filtering)
    const stopToAllRouteIndicesMap: Record<string, Set<number>> = {};
    // Build a map of stop IDs to their order in the selected route (if a route is selected)
    const selectedRouteStopOrderMap: Record<string, number> = {};
    
    // If a route is selected, calculate stop order specifically for that route
    if (selectedRouteIndex !== null && selectedRouteIndex !== undefined && routes[selectedRouteIndex]) {
      const selectedRoute = routes[selectedRouteIndex];
      const vehicleRoute = selectedRoute.route_data?.route || [];
      let orderNumber = 1; // Start counting from 1 for actual stops (after start point)
      
      vehicleRoute.forEach((routeStop: any) => {
        const stopId = routeStop.stop?.id;
        if (!stopId || stopId.includes("-end")) return; // Skip end points
        
        const isStartPoint = stopId.includes("-start");
        const originalPointId = extractOriginalPointId(stopId);
        
        if (isStartPoint) {
          selectedRouteStopOrderMap[originalPointId] = 0;
        } else {
          selectedRouteStopOrderMap[originalPointId] = orderNumber;
          orderNumber++;
        }
      });
    }
    
    if (routes.length > 0) {
      routes.forEach((route: any, routeIndex: number) => {
        const vehicleRoute = route.route_data?.route || [];
        let orderNumber = 1; // Start counting from 1 for actual stops (after start point)
        
        vehicleRoute.forEach((routeStop: any) => {
          const stopId = routeStop.stop?.id;
          if (!stopId || stopId.includes("-end")) return; // Skip end points
          
          const isStartPoint = stopId.includes("-start");
          // Extract original point ID (in case stop ID is encoded with person_id)
          const originalPointId = extractOriginalPointId(stopId);
          
          // Track if this is a start point
          if (isStartPoint) {
            stopIsStartPointMap[originalPointId] = true;
            // Start points have order 0
            if (!(originalPointId in stopOrderMap)) {
              stopOrderMap[originalPointId] = 0;
            }
          } else {
            // Use the minimum order if stop appears in multiple routes
            if (!(originalPointId in stopOrderMap) || stopOrderMap[originalPointId] > orderNumber) {
              stopOrderMap[originalPointId] = orderNumber;
            }
            orderNumber++; // Increment for next stop
          }
          
          // Map stop ID to route index (use first route found if stop appears in multiple routes) - for coloring
          if (!(originalPointId in stopToRouteIndexMap)) {
            stopToRouteIndexMap[originalPointId] = routeIndex;
          }
          // Track all routes that contain this point (for filtering)
          if (!stopToAllRouteIndicesMap[originalPointId]) {
            stopToAllRouteIndicesMap[originalPointId] = new Set();
          }
          stopToAllRouteIndicesMap[originalPointId].add(routeIndex);
        });
      });
    }

    // Add vehicle start location marker
    if (vehicleStartLocation) {
      const startEl = document.createElement("div");
      startEl.className = "w-12 h-12 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs";
      startEl.textContent = "S";
      
      const startMarker = new mapboxgl.Marker(startEl)
        .setLngLat([vehicleStartLocation.lon, vehicleStartLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <h3 class="font-bold text-green-600">Ubicación de Inicio</h3>
              <p class="text-sm">${vehicleStartLocation.lat}, ${vehicleStartLocation.lon}</p>
            </div>`
          )
        )
        .addTo(map.current!);
      markersRef.current.push(startMarker);
    }

    // Add vehicle end location marker
    if (vehicleEndLocation) {
      const endEl = document.createElement("div");
      endEl.className = "w-12 h-12 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold text-xs";
      endEl.textContent = "E";
      
      const endMarker = new mapboxgl.Marker(endEl)
        .setLngLat([vehicleEndLocation.lon, vehicleEndLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <h3 class="font-bold text-red-600">Ubicación de Fin</h3>
              <p class="text-sm">${vehicleEndLocation.lat}, ${vehicleEndLocation.lon}</p>
            </div>`
          )
        )
        .addTo(map.current!);
      markersRef.current.push(endMarker);
    }

    // Add organization home marker after optimization (pin shape so it floats above route start markers)
    if (routes.length > 0 && orgLocation) {
      const homeEl = document.createElement("div");
      homeEl.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
      homeEl.innerHTML = `
        <div style="width:38px;height:38px;background:#111827;border-radius:10px;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </div>
        <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #111827;margin-top:-1px;"></div>
      `;

      const homeMarker = new mapboxgl.Marker({ element: homeEl, anchor: "bottom" })
        .setLngLat(orgLocation)
        .setPopup(
          new mapboxgl.Popup({ offset: 10 }).setHTML(
            `<div style="padding:8px">
              <p style="font-weight:700;margin:0 0 2px">Organización</p>
              <p style="font-size:11px;color:#6b7280;margin:0">${orgLocation[1].toFixed(5)}, ${orgLocation[0].toFixed(5)}</p>
            </div>`
          )
        )
        .addTo(map.current!);
      markersRef.current.push(homeMarker);
    }

    // Color palette for different vehicles (must match the one used for routes)
    const routeColors = [
      "#26bc30", // Green
      "#3b82f6", // Blue
      "#f59e0b", // Amber
      "#ef4444", // Red
      "#8b5cf6", // Purple
      "#ec4899", // Pink
      "#06b6d4", // Cyan
      "#84cc16", // Lime
    ];

    // Add pickup point markers with order numbers and route colors
    // Also add all stops from routes (start points and regular stops) that might not be in pickupPoints
    const allPointsToShow = new Set<string>();
    
    // First, collect all points from pickupPoints
    pickupPoints.forEach((point) => {
      allPointsToShow.add(point.id);
    });
    
    // Then, collect all stops from routes (including start points and regular stops)
    // This ensures markers are shown even if pickupPoints is empty or doesn't contain all stops
    if (routes.length > 0) {
      routes.forEach((route: any, routeIndex: number) => {
        const vehicleRoute = route.route_data?.route || [];
        vehicleRoute.forEach((routeStop: any) => {
          const stopId = routeStop.stop?.id;
          // Include all stops (start points and regular stops, but exclude end points)
          if (stopId && !stopId.includes("-end") && routeStop.stop?.location) {
            const originalPointId = extractOriginalPointId(stopId);
            allPointsToShow.add(originalPointId);
          }
        });
      });
    }
    
    // Now create markers for all points (from pickupPoints and route start points)
    allPointsToShow.forEach((pointId) => {
      // Find the point in pickupPoints, or get location from route
      let point: PickupPoint | null = pickupPoints.find(p => p.id === pointId) || null;
      let pointLocation: { lon: number; lat: number } | null = null;
      
      if (point) {
        pointLocation = { lon: point.longitude, lat: point.latitude };
      } else {
        // Try to find location from route stops (start points and regular stops)
        if (routes.length > 0) {
          for (const route of routes) {
            const vehicleRoute = route.route_data?.route || [];
            for (const routeStop of vehicleRoute) {
              const stopId = routeStop.stop?.id;
              // Check all stops (not just start points) to find the location
              if (stopId && !stopId.includes("-end") && routeStop.stop?.location) {
                const originalPointId = extractOriginalPointId(stopId);
                if (originalPointId === pointId) {
                  pointLocation = {
                    lon: Number(routeStop.stop.location.lon),
                    lat: Number(routeStop.stop.location.lat)
                  };
                  // Create a temporary point object for display
                  const isStartPoint = stopId.includes("-start");
                  point = {
                    id: pointId,
                    name: isStartPoint ? "Punto de inicio" : `Punto ${pointId}`,
                    latitude: pointLocation.lat,
                    longitude: pointLocation.lon
                  };
                  break;
                }
              }
            }
            if (pointLocation) break;
          }
        }
      }
      
      if (!point || !pointLocation) return;
      
      // Use selected route order if available, otherwise use general order
      const orderNumber = (selectedRouteIndex !== null && selectedRouteIndex !== undefined && selectedRouteStopOrderMap[pointId] !== undefined)
        ? selectedRouteStopOrderMap[pointId]
        : stopOrderMap[pointId];
      const isStartPoint = stopIsStartPointMap[pointId] || false;
      const routeIndex = stopToRouteIndexMap[pointId];
      const allRouteIndices = stopToAllRouteIndicesMap[pointId];
      
      // Filter: if a route is selected, only show markers from that route
      if (selectedRouteIndex !== null && selectedRouteIndex !== undefined) {
        // Check if the point belongs to the selected route
        if (!allRouteIndices || !allRouteIndices.has(selectedRouteIndex)) {
          return; // Skip markers that don't belong to the selected route
        }
      }
      
      const el = document.createElement("div");
      
      // Determine marker color: use route color if point belongs to a route, otherwise use primary color
      const markerColor = routeIndex !== undefined ? routeColors[routeIndex % routeColors.length] : undefined;
      
      // Determine marker size based on number (larger for double digits)
      const displayNumber = isStartPoint ? "S" : (orderNumber !== undefined ? String(orderNumber) : "📍");
      const isDoubleDigit = orderNumber !== undefined && orderNumber > 9;
      const markerSize = isDoubleDigit ? "w-12 h-12" : "w-10 h-10";
      const textSize = isDoubleDigit ? "text-xs" : "text-sm";
      
      // Set base classes
      el.className = `${markerSize} rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white font-bold ${textSize}`;
      
      // Set background color: use inline style for route colors, or default to primary
      if (markerColor) {
        el.style.backgroundColor = markerColor;
      } else {
        // Use Tailwind's primary color class as fallback
        el.classList.add("bg-primary");
      }
      
      if (isStartPoint) {
        el.textContent = "S";
      } else if (orderNumber !== undefined) {
        el.textContent = String(orderNumber);
      } else {
        el.textContent = "📍";
      }

      // Build passenger names list for popup
      const allNombres: string[] = (point as any).all_nombres || [];
      const cedulas: string[] = point.person_id
        ? point.person_id.split(',').map((s: string) => s.trim()).filter((s: string) => s)
        : [];
      const passengerNames: string[] = allNombres.length > 0 ? allNombres : cedulas;
      const passengersHTML = !isStartPoint && passengerNames.length > 0
        ? `<p class="text-sm font-semibold mt-1">Pasajeros:</p><ul class="text-sm list-disc ml-4">${passengerNames.map(n => `<li>${n}</li>`).join("")}</ul>`
        : (!isStartPoint && point.quantity && point.quantity > 0 ? `<p class="text-sm">Cantidad: ${point.quantity}</p>` : "");

      const marker = new mapboxgl.Marker(el)
        .setLngLat([pointLocation.lon, pointLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2 max-w-xs">
              ${isStartPoint ? `<h3 class="font-bold text-green-600">Punto de inicio</h3>` : `<h3 class="font-bold">${point.address || point.name}</h3>`}
              ${!isStartPoint && orderNumber !== undefined ? `<p class="text-sm font-semibold text-gray-500">Orden: ${orderNumber}</p>` : ''}
              <p class="text-xs text-gray-400">${pointLocation.lat.toFixed(6)}, ${pointLocation.lon.toFixed(6)}</p>
              ${passengersHTML}
            </div>`
          )
        )
        .addTo(map.current!);
      markersRef.current.push(marker);
    });
    
    // Add end point markers for vehicles that have end locations
    routes.forEach((route: any, routeIndex: number) => {
      // Try to get vehicle from route
      let vehicle: any = null;
      if (route.vehicle_id && vehicles.length > 0) {
        vehicle = vehicles.find((v: any) => v.id === route.vehicle_id);
      }
      
      // Check for end location from vehicle (Supabase or local)
      if (vehicle) {
        let endLocation: { lon: number; lat: number } | null = null;
        
        // Try Supabase vehicle data first (end_latitude, end_longitude)
        if (vehicle.end_latitude != null && vehicle.end_longitude != null) {
          endLocation = {
            lon: Number(vehicle.end_longitude),
            lat: Number(vehicle.end_latitude)
          };
        }
        // Fallback to local vehicle end_location
        else if (vehicle.end_location) {
          endLocation = vehicle.end_location;
        }
        
        // Create marker for end point if available
        if (endLocation && map.current) {
          const routeColor = routeColors[routeIndex % routeColors.length];
          const el = document.createElement('div');
          el.className = 'end-point-marker';
          el.style.width = '20px';
          el.style.height = '20px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = routeColor;
          el.style.border = '3px solid white';
          el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
          el.style.cursor = 'pointer';
          el.title = 'Punto de fin';
          
          const marker = new mapboxgl.Marker(el)
            .setLngLat([endLocation.lon, endLocation.lat])
            .addTo(map.current);
          
          markersRef.current.push(marker);
        }
      }
    });

    // Draw routes - filter to match legend: one route per vehicle with valid coordinates
    // Routes structure: route_data.route[] where each item has stop.location.{lon, lat}
    if (routes.length > 0) {
      // Color palette for different vehicles
      const routeColors = [
        "#26bc30", // Green
        "#3b82f6", // Blue
        "#f59e0b", // Amber
        "#ef4444", // Red
        "#8b5cf6", // Purple
        "#ec4899", // Pink
        "#06b6d4", // Cyan
        "#84cc16", // Lime
      ];
      
        // Filter routes to match legend: only routes with valid polylines AND at least one actual stop (excluding start/end)
        const routesWithPolylines = routes.map((route: any, index: number) => {
          const vehicleRoute = route.route_data?.route || [];
          const hasValidCoordinates = vehicleRoute.some((routeStop: any) => 
            routeStop.stop?.location?.lon && routeStop.stop?.location?.lat
          );
          // Count only actual stops (excluding start/end locations)
          const actualStopCount = vehicleRoute.filter((routeStop: any) => {
            const stopId = routeStop.stop?.id;
            const hasLocation = routeStop.stop?.location?.lon && routeStop.stop?.location?.lat;
            // Exclude start/end stops - only count actual pickup/delivery stops
            const isActualStop = stopId && !stopId.includes("-start") && !stopId.includes("-end");
            return hasLocation && isActualStop;
          }).length;
          // Require at least 1 actual stop (apart from start/end)
          const hasActualStops = actualStopCount >= 1;
          return (hasValidCoordinates && hasActualStops) ? { route, index } : null;
        }).filter((item): item is { route: any; index: number } => item !== null);

      // Group by vehicle and keep only one route per vehicle (same logic as legend)
      // Use a Map to track the first occurrence of each vehicle
      // Use globalThis.Map to avoid conflict with component name
      const MapConstructor = globalThis.Map || window.Map;
      const vehicleRouteMap = new MapConstructor<string, { route: any; index: number }>();
      routesWithPolylines.forEach(({ route, index }) => {
        // Get vehicle identifier - prefer vehicle_id, then route_data.id, fallback to index-based ID
        let vehicleId = route.vehicle_id || route.route_data?.id || null;
        
        // If vehicle_id is null, create a stable identifier based on route data
        // Use the first stop's ID or route index as fallback
        if (!vehicleId && route.route_data?.route && route.route_data.route.length > 0) {
          const firstStopId = route.route_data.route[0]?.stop?.id;
          vehicleId = firstStopId || `route-${index}`;
        }
        
        // Use "null-route-{index}" as final fallback to ensure uniqueness
        const identifier = vehicleId || `null-route-${index}`;
        
        // Only keep the first route for each vehicle
        if (!vehicleRouteMap.has(identifier)) {
          vehicleRouteMap.set(identifier, { route, index });
        }
      });
      
      // Convert map values to array
      const uniqueVehicleRoutes = Array.from(vehicleRouteMap.values());
      
      console.log(`Filtered ${routes.length} routes to ${uniqueVehicleRoutes.length} unique vehicle routes (one per vehicle)`);
      console.log(`Unique vehicle routes:`, uniqueVehicleRoutes.map(({ route, index }) => ({
        index,
        vehicle_id: route.vehicle_id || route.route_data?.id,
        stops_count: route.route_data?.route?.length || 0
      })));
      
      // Collect route coordinates from filtered routes
      // Store both coordinates and original route index to maintain mapping
      const vehicleRoutes: { coordinates: number[][]; originalIndex: number; route: any }[] = [];
      
      uniqueVehicleRoutes.forEach(({ route, index: originalIndex }) => {
        const vehicleRoute = route.route_data?.route || [];
        const coordinates: number[][] = [];
        
        vehicleRoute.forEach((routeStop: any) => {
          if (routeStop.stop?.location) {
            coordinates.push([
              routeStop.stop.location.lon,
              routeStop.stop.location.lat,
            ]);
          }
        });
        
        // Add end point if vehicle has one
        // Try to get vehicle from route
        let vehicle: any = null;
        if (route.vehicle_id && vehicles.length > 0) {
          vehicle = vehicles.find((v: any) => v.id === route.vehicle_id);
        }
        
        // Check for end location from vehicle (Supabase or local)
        if (vehicle) {
          let endLocation: { lon: number; lat: number } | null = null;
          
          // Try Supabase vehicle data first (end_latitude, end_longitude)
          if (vehicle.end_latitude != null && vehicle.end_longitude != null) {
            endLocation = {
              lon: Number(vehicle.end_longitude),
              lat: Number(vehicle.end_latitude)
            };
          }
          // Fallback to local vehicle end_location
          else if (vehicle.end_location) {
            endLocation = vehicle.end_location;
          }
          
          // Add end point to coordinates if available
          if (endLocation) {
            coordinates.push([endLocation.lon, endLocation.lat]);
          }
        }
        
        if (coordinates.length > 0) {
          vehicleRoutes.push({ coordinates, originalIndex, route });
        } else {
          console.warn(`Route ${originalIndex} has no valid coordinates after filtering. Route data:`, route.route_data);
        }
      });
      
      console.log(`Drawing ${vehicleRoutes.length} routes on map (matching legend)`);

      // Helper function to clean and validate coordinates
      const cleanCoordinates = (coords: number[][]): number[][] => {
        return coords.filter((coord, index, arr) => {
          // Validate coordinate is an array with 2 valid numbers
          if (!Array.isArray(coord) || coord.length < 2) return false;
          const [lon, lat] = coord;
          if (typeof lon !== 'number' || typeof lat !== 'number') return false;
          if (!isFinite(lon) || !isFinite(lat)) return false;
          if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return false;
          
          // Remove duplicate consecutive points
          if (index > 0) {
            const [prevLon, prevLat] = arr[index - 1];
            if (prevLon === lon && prevLat === lat) return false;
          }
          
          return true;
        });
      };

      // Draw route lines using Mapbox Directions API to get actual street routes
      // Use async function to handle API calls
      (async () => {
        await Promise.all(vehicleRoutes.map(async ({ coordinates, originalIndex, route }, vehicleIndex) => {
        const sourceId = `route-${originalIndex}`;
        const layerId = `route-${originalIndex}`;
        const routeColor = routeColors[originalIndex % routeColors.length]; // Cycle through colors
        
        // Determine initial visibility - always create the layer even if hidden
        const isInitiallyVisible = !visibleRoutes || visibleRoutes.has(originalIndex);
        
        try {
          // Mapbox Directions API requires at least 2 waypoints
          if (coordinates.length < 2) {
            console.warn(`Route ${originalIndex} has only ${coordinates.length} waypoint(s), using straight line`);
            // Don't return - create a straight line instead
          } else {
            // Mapbox has a limit of 25 waypoints per request
            const MAX_WAYPOINTS = 25;
            let combinedGeometry: any = null;
            
            if (coordinates.length <= MAX_WAYPOINTS) {
              // Single request for routes with 25 or fewer waypoints
              const waypoints = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
              const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
              
              console.log(`Fetching Mapbox route for vehicle ${originalIndex} with ${coordinates.length} waypoints`);
              
              const response = await fetch(directionsUrl);
              const data = await response.json();
              
              if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                combinedGeometry = data.routes[0].geometry;
              } else {
                console.warn(`Mapbox Directions API error for route ${originalIndex}:`, data.code, data.message || data);
              }
            } else {
              // Split into multiple requests for routes with more than 25 waypoints
              console.log(`Route ${originalIndex} has ${coordinates.length} waypoints, splitting into multiple requests (max ${MAX_WAYPOINTS} per request)`);
              
              const routeSegments: any[] = [];
              
              // Split coordinates into chunks of MAX_WAYPOINTS
              // Each chunk (except the first) starts with the last point of the previous chunk for continuity
              for (let i = 0; i < coordinates.length; i += MAX_WAYPOINTS - 1) {
                const chunkStart = i === 0 ? i : i - 1; // Include last point from previous chunk
                const chunkEnd = Math.min(i + MAX_WAYPOINTS, coordinates.length);
                const chunk = coordinates.slice(chunkStart, chunkEnd);
                
                if (chunk.length < 2) continue; // Skip chunks with less than 2 points
                
                const waypoints = chunk.map(coord => `${coord[0]},${coord[1]}`).join(';');
                const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
                
                console.log(`Fetching segment ${Math.floor(i / (MAX_WAYPOINTS - 1)) + 1} for route ${originalIndex} with ${chunk.length} waypoints`);
                
                try {
                  const response = await fetch(directionsUrl);
                  const data = await response.json();
                  
                  if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    routeSegments.push(data.routes[0].geometry);
                  } else {
                    console.warn(`Mapbox Directions API error for route ${originalIndex} segment ${Math.floor(i / (MAX_WAYPOINTS - 1)) + 1}:`, data.code, data.message || data);
                  }
                } catch (error) {
                  console.error(`Error fetching segment for route ${originalIndex}:`, error);
                }
              }
              
              // Combine all route segments into a single geometry
              if (routeSegments.length > 0) {
                const allCoordinates: number[][] = [];
                
                routeSegments.forEach((segment, segmentIndex) => {
                  const segmentCoords = segment.coordinates || [];
                  
                  if (segmentIndex === 0) {
                    // First segment: include all coordinates
                    allCoordinates.push(...segmentCoords);
                  } else {
                    // Subsequent segments: skip first coordinate (duplicate of last from previous segment)
                    if (segmentCoords.length > 1) {
                      allCoordinates.push(...segmentCoords.slice(1));
                    }
                  }
                });
                
                combinedGeometry = {
                  type: "LineString",
                  coordinates: allCoordinates,
                };
                
                console.log(`Combined ${routeSegments.length} segments for route ${originalIndex} into geometry with ${allCoordinates.length} coordinates`);
              } else {
                console.warn(`Route ${originalIndex} failed to fetch any segments, using fallback`);
              }
            }
            
            // Process the combined geometry (from single or multiple requests)
            if (combinedGeometry) {
              // Clean and validate coordinates to prevent jumps
              const cleanedCoords = cleanCoordinates(combinedGeometry.coordinates || []);
              
              // Ensure we have at least 2 valid coordinates
              if (cleanedCoords.length < 2) {
                console.warn(`Route ${originalIndex} has insufficient valid coordinates after cleaning, using fallback`);
                // Fall through to straight line fallback
              } else {
                const cleanedGeometry = {
                  ...combinedGeometry,
                  coordinates: cleanedCoords,
                };
                
                console.log(`Successfully processed Mapbox route for vehicle ${originalIndex}, geometry has ${cleanedCoords.length} valid coordinates`);
                
                // Add or update route line with actual street geometry
                if (map.current!.getSource(sourceId)) {
                  (map.current!.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
                    type: "Feature",
                    properties: {},
                    geometry: cleanedGeometry,
                  });
                } else {
                  map.current!.addSource(sourceId, {
                    type: "geojson",
                    data: {
                      type: "Feature",
                      properties: {},
                      geometry: cleanedGeometry,
                    },
                  });

                  map.current!.addLayer({
                    id: layerId,
                    type: "line",
                    source: sourceId,
                    layout: {
                      "line-join": "round",
                      "line-cap": "round",
                      "visibility": isInitiallyVisible ? "visible" : "none",
                    },
                    paint: {
                      "line-color": routeColor,
                      "line-width": 4,
                    },
                  });
                }
                return; // Successfully created route, exit early
              }
            } else {
              console.warn(`Route ${originalIndex} failed to get geometry from Mapbox, using fallback`);
            }
          }
          
          // Fallback to straight line if Directions API fails or has < 2 waypoints
          console.log(`Using straight line fallback for vehicle ${originalIndex}`);
          // Clean coordinates before using them
          const cleanedFallbackCoords = cleanCoordinates(coordinates);
          if (cleanedFallbackCoords.length < 2) {
            console.warn(`Route ${originalIndex} has insufficient valid coordinates for fallback line`);
            return; // Skip this route if we don't have enough valid coordinates
          }
          
          if (map.current!.getSource(sourceId)) {
            (map.current!.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: cleanedFallbackCoords,
              },
            });
          } else {
            map.current!.addSource(sourceId, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: cleanedFallbackCoords,
                },
              },
            });

            map.current!.addLayer({
              id: layerId,
              type: "line",
              source: sourceId,
              layout: {
                "line-join": "round",
                "line-cap": "round",
                "visibility": isInitiallyVisible ? "visible" : "none",
              },
              paint: {
                "line-color": routeColor,
                "line-width": 4,
              },
            });
          }
        } catch (error) {
          console.error(`Error fetching route for vehicle ${originalIndex}:`, error);
          // Fallback to straight line on error - ensure route is still rendered
          console.log(`Creating fallback straight line for vehicle ${originalIndex} due to error`);
          // Clean coordinates before using them
          const cleanedErrorCoords = cleanCoordinates(coordinates);
          if (cleanedErrorCoords.length < 2) {
            console.warn(`Route ${originalIndex} has insufficient valid coordinates for error fallback line`);
            return; // Skip this route if we don't have enough valid coordinates
          }
          
          if (map.current!.getSource(sourceId)) {
            (map.current!.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: cleanedErrorCoords,
              },
            });
          } else {
            map.current!.addSource(sourceId, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: cleanedErrorCoords,
                },
              },
            });

            map.current!.addLayer({
              id: layerId,
              type: "line",
              source: sourceId,
              layout: {
                "line-join": "round",
                "line-cap": "round",
                "visibility": isInitiallyVisible ? "visible" : "none",
              },
              paint: {
                "line-color": routeColor,
                "line-width": 4,
              },
            });
          }
        }
        
        // Log that route was processed
        console.log(`Route ${originalIndex} processing complete`);
        }));
      })();

    }

    // Fit map to show all points or routes (only if no point is focused and no route is selected)
    if (!focusedPoint && (selectedRouteIndex === null || selectedRouteIndex === undefined)) {
      const bounds = new mapboxgl.LngLatBounds();
      let hasBounds = false;
      
      // Add pickup points to bounds
      if (pickupPoints.length > 0) {
        pickupPoints.forEach((point) => {
          bounds.extend([point.longitude, point.latitude]);
          hasBounds = true;
        });
      }
      
      // Add all route stops to bounds (this ensures routes are visible even if pickupPoints is empty)
      if (routes.length > 0) {
        routes.forEach((route: any) => {
          const vehicleRoute = route.route_data?.route || [];
          vehicleRoute.forEach((routeStop: any) => {
            if (routeStop.stop?.location?.lon && routeStop.stop?.location?.lat) {
              const lon = Number(routeStop.stop.location.lon);
              const lat = Number(routeStop.stop.location.lat);
              if (isFinite(lon) && isFinite(lat)) {
                bounds.extend([lon, lat]);
                hasBounds = true;
              }
            }
          });
        });
      }
      
      if (hasBounds) {
        map.current!.fitBounds(bounds, { padding: 50, maxZoom: 14 });
      }
    }
    // NOTE: visibleRoutes and selectedRouteIndex are intentionally NOT in dependencies - we only update visibility/zoom via separate useEffects below
  }, [pickupPoints, routes, mapLoaded, focusedPoint, vehicleStartLocation, vehicleEndLocation, selectedRouteIndex, orgLocation]);

  // Update route visibility when visibleRoutes changes (separate from route drawing to avoid redrawing)
  useEffect(() => {
    if (!map.current || !mapLoaded || routes.length === 0) return;

    // Update visibility for all route layers that exist
    // This runs immediately when visibleRoutes changes (e.g., checkbox clicked)
    let updatedCount = 0;
    routes.forEach((_, routeIndex) => {
      const layerId = `route-${routeIndex}`;
      try {
        if (map.current!.getLayer(layerId)) {
          const isVisible = !visibleRoutes || visibleRoutes.has(routeIndex);
          map.current!.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
          updatedCount++;
        }
      } catch (e) {
        // Layer might not exist yet (still being drawn), that's okay
      }
    });
    
    if (updatedCount > 0) {
      console.log(`✅ Updated visibility for ${updatedCount} route layers. Visible routes:`, visibleRoutes ? Array.from(visibleRoutes).sort((a, b) => a - b) : 'all');
    }
  }, [visibleRoutes, mapLoaded, routes.length]);

  // Focus on specific point when focusedPoint changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !focusedPoint) return;

    map.current.flyTo({
      center: [focusedPoint.longitude, focusedPoint.latitude],
      zoom: 15,
      duration: 1000,
    });
  }, [focusedPoint, mapLoaded]);

  // Zoom to selected route when selectedRouteIndex changes
  useEffect(() => {
    if (!map.current || !mapLoaded || selectedRouteIndex === null || selectedRouteIndex === undefined || routes.length === 0) return;

    const selectedRoute = routes[selectedRouteIndex];
    if (!selectedRoute || !selectedRoute.route_data?.route) {
      console.warn("Selected route not found or has no route_data:", selectedRouteIndex, selectedRoute);
      return;
    }

    // Wait a bit for the route to be drawn, then calculate bounds
    const zoomToRoute = () => {
      if (!map.current) return;

      const bounds = new mapboxgl.LngLatBounds();
      let hasValidBounds = false;

      // Collect all coordinates from the selected route stops
      const vehicleRoute = selectedRoute.route_data.route || [];
      
      vehicleRoute.forEach((routeStop: any) => {
        if (routeStop.stop?.location?.lon && routeStop.stop?.location?.lat) {
          const lon = Number(routeStop.stop.location.lon);
          const lat = Number(routeStop.stop.location.lat);
          if (isFinite(lon) && isFinite(lat)) {
            bounds.extend([lon, lat]);
            hasValidBounds = true;
          }
        }
      });

      // Also try to get coordinates from the route polyline if available
      const sourceId = `route-${selectedRouteIndex}`;
      try {
        if (map.current.getSource(sourceId)) {
          const source = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource;
          // Use getData() method which is the proper way to get source data
          const sourceData = source.getData() as any;
          if (sourceData && sourceData.geometry && sourceData.geometry.coordinates) {
            const coords = sourceData.geometry.coordinates;
            if (Array.isArray(coords)) {
              coords.forEach((coord: number[]) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const lon = Number(coord[0]);
                  const lat = Number(coord[1]);
                  if (isFinite(lon) && isFinite(lat)) {
                    bounds.extend([lon, lat]);
                    hasValidBounds = true;
                  }
                }
              });
            }
          }
        }
      } catch (e) {
        console.warn("Could not get route polyline coordinates for zoom:", e);
      }

      if (hasValidBounds) {
        try {
          // Ensure bounds are valid
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          
          if (sw && ne && sw.lng !== ne.lng && sw.lat !== ne.lat) {
            console.log("Zooming to route", selectedRouteIndex, "bounds:", { sw, ne });
            map.current.fitBounds(bounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
            });
          } else {
            console.warn("Invalid bounds for route", selectedRouteIndex, { sw, ne });
          }
        } catch (e) {
          console.error("Error zooming to route:", e, bounds);
        }
      } else {
        console.warn("No valid bounds found for route", selectedRouteIndex, "route data:", selectedRoute);
      }
    };

    // Try immediately, then retry after delays in case the route is still being drawn
    zoomToRoute();
    const timeoutId1 = setTimeout(() => {
      zoomToRoute();
    }, 300);
    const timeoutId2 = setTimeout(() => {
      zoomToRoute();
    }, 1000);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [selectedRouteIndex, mapLoaded, routes]);

  // Focus on specific location when focusLocation changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !focusLocation) return;

    map.current.flyTo({
      center: [focusLocation.lon, focusLocation.lat],
      zoom: 15,
      duration: 1000,
    });
  }, [focusLocation, mapLoaded]);

  // Zoom to specific route when zoomToRoute changes
  useEffect(() => {
    if (!map.current || !mapLoaded || zoomToRoute === null || zoomToRoute === undefined || routes.length === 0) return;

    const routeToZoom = routes[zoomToRoute];
    if (!routeToZoom || !routeToZoom.route_data?.route) {
      console.warn("Route to zoom not found or has no route_data:", zoomToRoute, routeToZoom);
      return;
    }

    // Wait a bit for the route to be drawn, then calculate bounds
    const zoomToRouteBounds = () => {
      if (!map.current) return;

      const bounds = new mapboxgl.LngLatBounds();
      let hasValidBounds = false;

      // Collect all coordinates from the route stops
      const vehicleRoute = routeToZoom.route_data.route || [];
      
      vehicleRoute.forEach((routeStop: any) => {
        if (routeStop.stop?.location?.lon && routeStop.stop?.location?.lat) {
          const lon = Number(routeStop.stop.location.lon);
          const lat = Number(routeStop.stop.location.lat);
          if (isFinite(lon) && isFinite(lat)) {
            bounds.extend([lon, lat]);
            hasValidBounds = true;
          }
        }
      });

      // Also try to get coordinates from the route polyline if available
      const sourceId = `route-${zoomToRoute}`;
      try {
        if (map.current.getSource(sourceId)) {
          const source = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource;
          const sourceData = source.getData() as any;
          if (sourceData && sourceData.geometry && sourceData.geometry.coordinates) {
            const coords = sourceData.geometry.coordinates;
            if (Array.isArray(coords)) {
              coords.forEach((coord: number[]) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const lon = Number(coord[0]);
                  const lat = Number(coord[1]);
                  if (isFinite(lon) && isFinite(lat)) {
                    bounds.extend([lon, lat]);
                    hasValidBounds = true;
                  }
                }
              });
            }
          }
        }
      } catch (e) {
        console.warn("Could not get route polyline coordinates for zoom:", e);
      }

      if (hasValidBounds) {
        try {
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          
          if (sw && ne && sw.lng !== ne.lng && sw.lat !== ne.lat) {
            map.current.fitBounds(bounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
            });
          }
        } catch (e) {
          console.error("Error zooming to route:", e);
        }
      }
    };

    // Try immediately, then retry after delays in case the route is still being drawn
    zoomToRouteBounds();
    const timeoutId1 = setTimeout(() => {
      zoomToRouteBounds();
    }, 300);
    const timeoutId2 = setTimeout(() => {
      zoomToRouteBounds();
    }, 1000);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [zoomToRoute, mapLoaded, routes]);

  // Update cursor when clickMode changes
  useEffect(() => {
    if (map.current && mapLoaded) {
      if (clickMode) {
        map.current.getCanvas().style.cursor = "crosshair";
      } else {
        map.current.getCanvas().style.cursor = "";
      }
    }
  }, [clickMode, mapLoaded]);

  // Color palette for different vehicles (must match the one used for routes)
  const routeColors = [
    "#26bc30", // Green
    "#3b82f6", // Blue
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#84cc16", // Lime
  ];

  // Get vehicle names for legend
  const getVehicleName = (routeIndex: number, route: any): string => {
    // Try to find vehicle by vehicle_id in route
    if (route.vehicle_id && vehicles.length > 0) {
      const vehicle = vehicles.find(v => v.id === route.vehicle_id);
      if (vehicle) return vehicle.name;
    }
    // Try to find by matching route_data.id with vehicle id
    if (route.route_data?.id && vehicles.length > 0) {
      const vehicle = vehicles.find(v => v.id === route.route_data.id || `vehicle-${vehicles.indexOf(v)}` === route.route_data.id);
      if (vehicle) return vehicle.name;
    }
    // Fallback to vehicle index
    return vehicles[routeIndex]?.name || `Vehículo ${routeIndex + 1}`;
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg shadow-lg" />
      {clickMode && (
        <div className="absolute top-4 left-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg z-10">
          <p className="text-sm font-semibold">Haz clic en el mapa para agregar un punto de recogida</p>
        </div>
      )}
    </div>
  );
};

export default Map;
