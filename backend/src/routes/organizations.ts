import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// GET organization by id
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows]: any = await pool.query(
      "SELECT id, name, country, city, latitude, longitude FROM organization WHERE id = ?",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Organization not found" });
    }
    res.json(rows[0]);
  } catch (err: any) {
    console.error("[GET /api/organizations/:id] ERROR:", err?.code, err?.sqlMessage);
    res.status(500).json({ error: "Failed to fetch organization", detail: String(err) });
  }
});

export default router;
