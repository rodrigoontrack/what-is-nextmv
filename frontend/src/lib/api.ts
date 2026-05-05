const BASE_URL = "http://localhost:3000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = [err.error, err.detail].filter(Boolean).join(" | detail: ");
    console.error(`API ERROR [${options?.method || "GET"} ${path}] ${res.status}:`, message, "\nBody sent:", options?.body);
    throw new Error(message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Pickup Points ---
export const getPickupPoints = () =>
  request<any[]>("/pickup-points");

export const createPickupPoint = (data: any) =>
  request<any>("/pickup-points", { method: "POST", body: JSON.stringify(data) });

export const updatePickupPoint = (id: number, data: any) =>
  request<any>(`/pickup-points/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deletePickupPoint = (id: number) =>
  request<void>(`/pickup-points/${id}`, { method: "DELETE" });

// --- Route Records (route table) ---
export const createRouteRecord = (data: any) =>
  request<any>("/route-records", { method: "POST", body: JSON.stringify(data) });

// --- Schedules ---
export const createSchedule = (data: any) =>
  request<any>("/schedules", { method: "POST", body: JSON.stringify(data) });

// --- Route Schedules ---
export const createRouteSchedule = (data: any) =>
  request<any>("/route-schedules", { method: "POST", body: JSON.stringify(data) });

// --- Route Schedule Vehicles ---
export const createRouteScheduleVehicle = (data: any) =>
  request<any>("/route-schedule-vehicles", { method: "POST", body: JSON.stringify(data) });

// --- Bus Stops ---
export const createBusStop = (data: any) =>
  request<any>("/bus-stops", { method: "POST", body: JSON.stringify(data) });

// --- Route Schedule Trackables ---
export const createRouteScheduleTrackable = (data: any) =>
  request<any>("/route-schedule-trackables", { method: "POST", body: JSON.stringify(data) });

// --- Vehicles ---
export const getVehiclesByOrganization = (orgId: number) =>
  request<any[]>(`/vehicles/organization/${orgId}`);

export const getVehicleByPlate = (plate: string) =>
  request<any>(`/vehicles/plate/${encodeURIComponent(plate)}`);

export const createVehicleOptimization = (data: any) =>
  request<any>("/vehicles", { method: "POST", body: JSON.stringify(data) });

export const updateVehicleCapacity = (plate: string, capacity: number) =>
  request<any>(`/vehicles/plate/${encodeURIComponent(plate)}/capacity`, {
    method: "PATCH",
    body: JSON.stringify({ capacity }),
  });

// --- Optimizations ---
export const getOptimizations = () =>
  request<any[]>("/optimizations");

export const getOptimization = (id: number) =>
  request<any>(`/optimizations/${id}`);

export const createOptimization = (data: any) =>
  request<any>("/optimizations", { method: "POST", body: JSON.stringify(data) });

export const deleteOptimization = (id: number) =>
  request<void>(`/optimizations/${id}`, { method: "DELETE" });

// --- Routes ---
export const getRoutesByOptimization = (optimizationId: number) =>
  request<any[]>(`/routes/optimization/${optimizationId}`);

export const createRoute = (data: any) =>
  request<any>("/routes", { method: "POST", body: JSON.stringify(data) });

export const deleteRoute = (id: number) =>
  request<void>(`/routes/${id}`, { method: "DELETE" });

// --- Organizations ---
export const getOrganization = (id: number) =>
  request<any>(`/organizations/${id}`);

// --- Stops ---
export const createStop = (data: any) =>
  request<any>("/stops", { method: "POST", body: JSON.stringify(data) });

export const getStopsByRoute = (routeOptimizationId: number) =>
  request<any[]>(`/stops/route/${routeOptimizationId}`);

export const addPassengerToRoute = (routeOptimizationId: number, data: {
  nombre: string;
  address: string;
  latitude: number;
  longitude: number;
  insertAfterOrder: number;
}) =>
  request<any>(`/stops/route/${routeOptimizationId}/add`, { method: "POST", body: JSON.stringify(data) });
