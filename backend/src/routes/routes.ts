import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// GET all route optimizations
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ro.*, vo.fk_vehicle
      FROM route_optimization ro
      LEFT JOIN vehicle_optimization vo ON ro.fk_vehicle_optimization = vo.id
      ORDER BY ro.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch routes", detail: String(err) });
  }
});

// GET route optimizations by optimization id
router.get("/optimization/:optimizationId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ro.*, vo.fk_vehicle, v.capacity AS vehicle_capacity
       FROM route_optimization ro
       LEFT JOIN vehicle_optimization vo ON ro.fk_vehicle_optimization = vo.id
       LEFT JOIN vehicle v ON vo.fk_vehicle = v.plate
       WHERE ro.fk_optimization = ?
       ORDER BY ro.id ASC`,
      [req.params.optimizationId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch routes for optimization", detail: String(err) });
  }
});

// POST create route optimization
router.post("/", async (req, res) => {
  const { nextmv_id, distance, time, fk_optimization, fk_vehicle_optimization, fk_route } = req.body;
  const now = new Date();
  const values = [nextmv_id ?? null, distance ?? null, time ?? null, now, fk_optimization ?? null, fk_vehicle_optimization ?? null, fk_route ?? null];
  try {
    const [result]: any = await pool.query(
      `INSERT INTO route_optimization (nextmv_id, distance, time, created_at, fk_optimization, fk_vehicle_optimization, fk_route)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values
    );
    const [rows]: any = await pool.query("SELECT * FROM route_optimization WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/routes] MYSQL ERROR:", err?.code, err?.sqlMessage, err?.sql);
    res.status(500).json({ error: "Failed to create route", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

// DELETE route optimization
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM route_optimization WHERE id = ?", [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete route", detail: String(err) });
  }
});

export default router;
