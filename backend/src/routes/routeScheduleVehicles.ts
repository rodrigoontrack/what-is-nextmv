import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// POST create route_schedule_vehicle
router.post("/", async (req, res) => {
  const { fk_vehicle, fk_route_schedule } = req.body;
  console.log("[POST /api/route-schedule-vehicles] body:", req.body);
  try {
    const [result]: any = await pool.query(
      `INSERT INTO route_schedule_vehicle (fk_vehicle, fk_route_schedule)
       VALUES (?, ?)`,
      [fk_vehicle ?? null, fk_route_schedule ?? null]
    );
    console.log("[POST /api/route-schedule-vehicles] insertId:", result.insertId);
    const [rows]: any = await pool.query("SELECT * FROM route_schedule_vehicle WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/route-schedule-vehicles] MYSQL ERROR:", err?.code, err?.sqlMessage);
    res.status(500).json({ error: "Failed to create route_schedule_vehicle", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

export default router;
