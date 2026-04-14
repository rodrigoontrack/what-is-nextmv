import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// GET stops by route_optimization id
router.get("/route/:routeOptimizationId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT so.*, pp.latitude, pp.longitude, pp.address
       FROM stop_optimization so
       LEFT JOIN pickup_point pp ON so.fk_pickup_point = pp.id
       WHERE so.fk_route_optimization = ?
       ORDER BY so.order ASC`,
      [req.params.routeOptimizationId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stops", detail: String(err) });
  }
});

// POST create stop
router.post("/", async (req, res) => {
  const { order, fk_bus_stop, fk_pickup_point, fk_route_optimization } = req.body;
  const now = new Date();
  const values = [order, now, fk_bus_stop ?? null, fk_pickup_point, fk_route_optimization];
  console.log("[POST /api/stops] body:", req.body);
  console.log("[POST /api/stops] values:", values);
  try {
    const [result]: any = await pool.query(
      `INSERT INTO stop_optimization (\`order\`, created_at, fk_bus_stop, fk_pickup_point, fk_route_optimization)
       VALUES (?, ?, ?, ?, ?)`,
      values
    );
    console.log("[POST /api/stops] insertId:", result.insertId);
    const [rows]: any = await pool.query("SELECT * FROM stop_optimization WHERE id = ?", [result.insertId]);
    console.log("[POST /api/stops] created row:", rows[0]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/stops] MYSQL ERROR:", err?.code, err?.sqlMessage, err?.sql);
    res.status(500).json({ error: "Failed to create stop", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

export default router;
