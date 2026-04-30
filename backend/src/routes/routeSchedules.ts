import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// POST create route_schedule
router.post("/", async (req, res) => {
  const { fk_route, fk_schedule, firebase_trace_url } = req.body;
  try {
    const [result]: any = await pool.query(
      `INSERT INTO route_schedule (fk_route, fk_schedule, firebase_trace_url)
       VALUES (?, ?, ?)`,
      [fk_route ?? null, fk_schedule ?? null, firebase_trace_url ?? null]
    );
    const [rows]: any = await pool.query("SELECT * FROM route_schedule WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/route-schedules] MYSQL ERROR:", err?.code, err?.sqlMessage);
    res.status(500).json({ error: "Failed to create route_schedule", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

export default router;
