import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// GET all optimizations
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM optimization ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch optimizations", detail: String(err) });
  }
});

// GET single optimization
router.get("/:id", async (req, res) => {
  try {
    const [rows]: any = await pool.query("SELECT * FROM optimization WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch optimization", detail: String(err) });
  }
});

// POST create optimization
router.post("/", async (req, res) => {
  const { optimization_result } = req.body;
  const now = new Date();
  console.log("[POST /api/optimizations] received, result keys:", optimization_result ? Object.keys(optimization_result) : "null");
  try {
    const [result]: any = await pool.query(
      `INSERT INTO optimization (optimization_result, created_at) VALUES (?, ?)`,
      [JSON.stringify(optimization_result), now]
    );
    console.log("[POST /api/optimizations] insertId:", result.insertId);
    const [rows]: any = await pool.query("SELECT * FROM optimization WHERE id = ?", [result.insertId]);
    console.log("[POST /api/optimizations] created row id:", rows[0]?.id);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/optimizations] MYSQL ERROR:", err?.code, err?.sqlMessage, err?.sql);
    res.status(500).json({ error: "Failed to create optimization", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

export default router;
