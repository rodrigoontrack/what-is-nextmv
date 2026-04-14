import { Router } from "express";
import { pool } from "../db/connection";

const router = Router();

// GET all pickup points
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM pickup_point ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error("Failed to fetch pickup points:", err);
    res.status(500).json({ error: "Failed to fetch pickup points", detail: String(err) });
  }
});

// GET single pickup point
router.get("/:id", async (req, res) => {
  try {
    const [rows]: any = await pool.query("SELECT * FROM pickup_point WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pickup point", detail: String(err) });
  }
});

// POST create pickup point
router.post("/", async (req, res) => {
  const { latitude, longitude, address, quantity } = req.body;
  const now = new Date();
  try {
    const [result]: any = await pool.query(
      `INSERT INTO pickup_point (latitude, longitude, address, quantity, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [latitude, longitude, address, quantity ?? null, now]
    );
    const [rows]: any = await pool.query("SELECT * FROM pickup_point WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create pickup point", detail: String(err) });
  }
});

// PUT update pickup point
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, address, quantity } = req.body;
  const now = new Date();
  try {
    await pool.query(
      `UPDATE pickup_point SET latitude=?, longitude=?, address=?, quantity=?, updated_at=? WHERE id=?`,
      [latitude, longitude, address, quantity ?? null, now, id]
    );
    const [rows]: any = await pool.query("SELECT * FROM pickup_point WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update pickup point", detail: String(err) });
  }
});

// DELETE pickup point
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM pickup_point WHERE id = ?", [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete pickup point", detail: String(err) });
  }
});

export default router;
