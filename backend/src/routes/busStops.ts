import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// POST create bus_stop
router.post("/", async (req, res) => {
  const { latitude, longitude, address, next_stop, fk_route_schedule, special } = req.body;
  const values = [
    latitude ?? null,
    longitude ?? null,
    address ?? null,
    next_stop ?? 0,
    fk_route_schedule ?? null,
    special ?? 0,
  ];
  console.log("[POST /api/bus-stops] body:", req.body);
  try {
    const [result]: any = await pool.query(
      `INSERT INTO bus_stop (latitude, longitude, address, next_stop, fk_route_schedule, special)
       VALUES (?, ?, ?, ?, ?, ?)`,
      values
    );
    console.log("[POST /api/bus-stops] insertId:", result.insertId);
    const [rows]: any = await pool.query("SELECT * FROM bus_stop WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/bus-stops] MYSQL ERROR:", err?.code, err?.sqlMessage);
    res.status(500).json({ error: "Failed to create bus_stop", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

export default router;
