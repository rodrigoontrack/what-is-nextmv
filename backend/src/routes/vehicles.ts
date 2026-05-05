import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// GET all vehicle optimizations (with vehicle plate)
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM vehicle_optimization");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicles", detail: String(err) });
  }
});

// GET vehicles by organization (from vehicle_organization table joined with vehicle)
router.get("/organization/:orgId", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT v.plate, v.alias
       FROM vehicle_organization vo
       JOIN vehicle v ON vo.fk_vehicle = v.plate
       WHERE vo.fk_organization = ?`,
      [req.params.orgId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch organization vehicles", detail: String(err) });
  }
});

// GET vehicle by plate (from vehicle table)
router.get("/plate/:plate", async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM vehicle WHERE plate = ?",
      [req.params.plate]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Vehicle not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicle by plate", detail: String(err) });
  }
});

// PATCH update capacity on the vehicle table by plate
router.patch("/plate/:plate/capacity", async (req, res) => {
  const { capacity } = req.body;
  if (capacity === undefined || isNaN(Number(capacity)) || Number(capacity) <= 0) {
    return res.status(400).json({ error: "Invalid capacity value" });
  }
  try {
    const [result]: any = await pool.query(
      "UPDATE vehicle SET capacity = ? WHERE plate = ?",
      [Math.floor(Number(capacity)), req.params.plate]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Vehicle not found" });
    res.json({ plate: req.params.plate, capacity: Math.floor(Number(capacity)) });
  } catch (err) {
    res.status(500).json({ error: "Failed to update vehicle capacity", detail: String(err) });
  }
});

// GET single vehicle optimization
router.get("/:id", async (req, res) => {
  try {
    const [rows]: any = await pool.query("SELECT * FROM vehicle_optimization WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch vehicle", detail: String(err) });
  }
});

// POST create vehicle optimization
router.post("/", async (req, res) => {
  const { max_distance, start_latitude, start_longitude, end_latitude, end_longitude, fk_vehicle } = req.body;
  const values = [max_distance ?? null, start_latitude ?? null, start_longitude ?? null, end_latitude ?? null, end_longitude ?? null, fk_vehicle ?? null];
  try {
    const [result]: any = await pool.query(
      `INSERT INTO vehicle_optimization (max_distance, start_latitude, start_longitude, end_latitude, end_longitude, fk_vehicle)
       VALUES (?, ?, ?, ?, ?, ?)`,
      values
    );
    const [rows]: any = await pool.query("SELECT * FROM vehicle_optimization WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/vehicles] MYSQL ERROR:", err?.code, err?.sqlMessage, err?.sql);
    res.status(500).json({ error: "Failed to create vehicle", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

// PUT update vehicle optimization
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { max_distance, start_latitude, start_longitude, end_latitude, end_longitude, fk_vehicle } = req.body;
  try {
    await pool.query(
      `UPDATE vehicle_optimization SET max_distance=?, start_latitude=?, start_longitude=?, end_latitude=?, end_longitude=?, fk_vehicle=?
       WHERE id=?`,
      [max_distance ?? null, start_latitude, start_longitude, end_latitude ?? null, end_longitude ?? null, fk_vehicle, id]
    );
    const [rows]: any = await pool.query("SELECT * FROM vehicle_optimization WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update vehicle", detail: String(err) });
  }
});

// DELETE vehicle optimization
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM vehicle_optimization WHERE id = ?", [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete vehicle", detail: String(err) });
  }
});

export default router;
