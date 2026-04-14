import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// POST create a route record (in the `route` table)
router.post("/", async (req, res) => {
  const { name, type, category, code, fk_organization } = req.body;
  const org = fk_organization ?? 321;
  const values = [name ?? null, type ?? 0, category ?? 0, code ?? null, org];
  console.log("[POST /api/route-records] body:", req.body);
  console.log("[POST /api/route-records] values:", values);
  try {
    const [result]: any = await pool.query(
      `INSERT INTO route (name, type, category, code, fk_organization, for_optimization, in_trash, priority, \`public\`, allow_caretakers, extra, has_attendance)
       VALUES (?, ?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 1)`,
      values
    );
    console.log("[POST /api/route-records] insertId:", result.insertId);
    const [rows]: any = await pool.query("SELECT * FROM route WHERE id = ?", [result.insertId]);
    console.log("[POST /api/route-records] created route id:", rows[0]?.id);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("[POST /api/route-records] MYSQL ERROR:", err?.code, err?.sqlMessage);
    res.status(500).json({ error: "Failed to create route record", detail: String(err), code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

export default router;
