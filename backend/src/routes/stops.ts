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
  try {
    const [result]: any = await pool.query(
      `INSERT INTO stop_optimization (\`order\`, created_at, fk_bus_stop, fk_pickup_point, fk_route_optimization)
       VALUES (?, ?, ?, ?, ?)`,
      values
    );
    const [rows]: any = await pool.query("SELECT * FROM stop_optimization WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/stops] MYSQL ERROR:", err?.code, err?.sqlMessage, err?.sql);
    res.status(500).json({ error: "Failed to create stop", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

// POST add new passenger stop to an existing route_optimization
router.post("/route/:routeOptimizationId/add", async (req, res) => {
  const { routeOptimizationId } = req.params;
  const { nombre, address, latitude, longitude, insertAfterOrder } = req.body;
  const now = new Date();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Create pickup_point
    const [ppResult]: any = await conn.query(
      `INSERT INTO pickup_point (latitude, longitude, address, quantity, created_at) VALUES (?, ?, ?, 1, ?)`,
      [latitude, longitude, address || nombre, now]
    );

    // 2. New stop gets order = insertAfterOrder + 1
    const newOrder = Number(insertAfterOrder) + 1;

    // 3. Shift existing stops to make room
    await conn.query(
      `UPDATE stop_optimization SET \`order\` = \`order\` + 1 WHERE fk_route_optimization = ? AND \`order\` >= ?`,
      [routeOptimizationId, newOrder]
    );

    // 4. Insert new stop
    await conn.query(
      `INSERT INTO stop_optimization (\`order\`, created_at, fk_bus_stop, fk_pickup_point, fk_route_optimization) VALUES (?, ?, NULL, ?, ?)`,
      [newOrder, now, ppResult.insertId, routeOptimizationId]
    );

    await conn.commit();

    // Return updated stops list
    const [stops]: any = await conn.query(
      `SELECT so.*, pp.latitude, pp.longitude, pp.address
       FROM stop_optimization so
       LEFT JOIN pickup_point pp ON so.fk_pickup_point = pp.id
       WHERE so.fk_route_optimization = ?
       ORDER BY so.order ASC`,
      [routeOptimizationId]
    );
    res.status(201).json({ success: true, stops });
  } catch (err: any) {
    await conn.rollback();
    res.status(500).json({ error: "Failed to add passenger", detail: String(err) });
  } finally {
    conn.release();
  }
});

export default router;
