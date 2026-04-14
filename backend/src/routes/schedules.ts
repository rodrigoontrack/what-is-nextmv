import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// POST create schedule
router.post("/", async (req, res) => {
  const { name, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, fk_organization } = req.body;
  const values = [
    name ?? null,
    monday ? 1 : 0, tuesday ? 1 : 0, wednesday ? 1 : 0, thursday ? 1 : 0,
    friday ? 1 : 0, saturday ? 1 : 0, sunday ? 1 : 0,
    start_time ?? null, end_time ?? null,
    fk_organization ?? 321,
  ];
  console.log("[POST /api/schedules] body:", req.body);
  try {
    const [result]: any = await pool.query(
      `INSERT INTO schedule (name, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, fk_organization)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
    console.log("[POST /api/schedules] insertId:", result.insertId);
    const [rows]: any = await pool.query("SELECT * FROM schedule WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/schedules] MYSQL ERROR:", err?.code, err?.sqlMessage);
    res.status(500).json({ error: "Failed to create schedule", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

export default router;
