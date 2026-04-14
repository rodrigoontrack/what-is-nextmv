import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import pickupPointsRouter from "./routes/pickupPoints";
import vehiclesRouter from "./routes/vehicles";
import routesRouter from "./routes/routes";
import optimizationsRouter from "./routes/optimizations";
import stopsRouter from "./routes/stops";
import routeRecordsRouter from "./routes/routeRecords";
import schedulesRouter from "./routes/schedules";
import routeSchedulesRouter from "./routes/routeSchedules";
import routeScheduleVehiclesRouter from "./routes/routeScheduleVehicles";
import busStopsRouter from "./routes/busStops";
import organizationsRouter from "./routes/organizations";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:8080" }));
app.use(express.json());

app.use("/api/pickup-points", pickupPointsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/routes", routesRouter);
app.use("/api/optimizations", optimizationsRouter);
app.use("/api/stops", stopsRouter);
app.use("/api/route-records", routeRecordsRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api/route-schedules", routeSchedulesRouter);
app.use("/api/route-schedule-vehicles", routeScheduleVehiclesRouter);
app.use("/api/bus-stops", busStopsRouter);
app.use("/api/organizations", organizationsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
