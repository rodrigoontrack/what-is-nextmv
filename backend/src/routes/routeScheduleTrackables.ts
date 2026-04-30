import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// POST create route_schedule_trackable
router.post("/", async (req, res) => {
  const { fk_route_schedule, fk_trackable_organization, fk_trackable_code, spot_row, spot_col } = req.body;
  try {
    // Verify the trackable exists before inserting (not all passengers have a trackable record)
    const [existing]: any = await pool.query(
      `SELECT 1 FROM trackable WHERE fk_organization = ? AND code = ? LIMIT 1`,
      [fk_trackable_organization, fk_trackable_code]
    );
    if (!existing || existing.length === 0) {
      return res.status(200).json({ skipped: true, reason: "trackable not found" });
    }

    const [result]: any = await pool.query(
      `INSERT INTO route_schedule_trackable (fk_route_schedule, fk_trackable_organization, fk_trackable_code, spot_row, spot_col)
       VALUES (?, ?, ?, ?, ?)`,
      [fk_route_schedule ?? null, fk_trackable_organization ?? null, fk_trackable_code ?? null, spot_row ?? null, spot_col ?? null]
    );
    const [rows]: any = await pool.query("SELECT * FROM route_schedule_trackable WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/route-schedule-trackables] MYSQL ERROR:", err?.code, err?.sqlMessage);
    res.status(500).json({ error: "Failed to create route_schedule_trackable", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

export default router;
