// backend/routes/collegeRoutes.js
import express from "express";
import { db } from "../db/connection.js";

const router = express.Router();

// Get all colleges
router.get("/all", async (req, res) => {
  try {
    const [colleges] = await db.query("SELECT * FROM colleges ORDER BY name");
    res.json(colleges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch colleges" });
  }
});

// Get single college by ID
router.get("/:collegeId", async (req, res) => {
  const { collegeId } = req.params;
  try {
    const [[college]] = await db.query("SELECT * FROM colleges WHERE id=?", [collegeId]);
    if (!college) {
      return res.status(404).json({ message: "College not found" });
    }
    res.json(college);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch college" });
  }
});

// Shortlist a college
router.post("/shortlist", async (req, res) => {
  const { studentId, collegeId } = req.body;
  
  if (!studentId || !collegeId) {
    return res.status(400).json({ message: "studentId and collegeId required" });
  }

  try {
    // Check if already shortlisted
    const [existing] = await db.query(
      "SELECT * FROM student_shortlists WHERE student_id=? AND college_id=?",
      [studentId, collegeId]
    );

    if (existing.length > 0) {
      return res.json({ message: "Already shortlisted", shortlisted: true });
    }

    // Add to shortlist
    await db.query(
      "INSERT INTO student_shortlists (student_id, college_id) VALUES (?, ?)",
      [studentId, collegeId]
    );

    res.json({ message: "College shortlisted successfully", shortlisted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to shortlist college" });
  }
});

// Remove from shortlist
router.delete("/shortlist", async (req, res) => {
  const { studentId, collegeId } = req.body;
  
  if (!studentId || !collegeId) {
    return res.status(400).json({ message: "studentId and collegeId required" });
  }

  try {
    await db.query(
      "DELETE FROM student_shortlists WHERE student_id=? AND college_id=?",
      [studentId, collegeId]
    );

    res.json({ message: "Removed from shortlist", shortlisted: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to remove from shortlist" });
  }
});

// Get shortlisted colleges for a student
router.get("/shortlist/:studentId", async (req, res) => {
  const { studentId } = req.params;
  
  try {
    const [colleges] = await db.query(
      `SELECT c.* FROM colleges c
       JOIN student_shortlists s ON s.college_id = c.id
       WHERE s.student_id = ?
       ORDER BY s.created_at DESC`,
      [studentId]
    );

    res.json(colleges);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch shortlisted colleges" });
  }
});

// Check if college is shortlisted
router.get("/shortlist/check/:studentId/:collegeId", async (req, res) => {
  const { studentId, collegeId } = req.params;
  
  try {
    const [rows] = await db.query(
      "SELECT * FROM student_shortlists WHERE student_id=? AND college_id=?",
      [studentId, collegeId]
    );

    res.json({ shortlisted: rows.length > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to check shortlist status" });
  }
});

export default router;
