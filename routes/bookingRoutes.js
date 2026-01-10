// backend/routes/bookingRoutes.js
import express from "express";
import db from "../db/connection.js";

const router = express.Router();

// List all counselors
router.get("/counselors", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.id, c.name, c.specialization, c.experience_years
       FROM counselors c
       ORDER BY c.experience_years DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch counselors" });
  }
});

// List available slots
router.get("/slots", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id AS slot_id, s.slot_time, c.id AS counselor_id, c.name AS counselor_name
       FROM counselor_slots s
       JOIN counselors c ON c.id = s.counselor_id
       WHERE s.is_booked = 0 AND s.slot_time > NOW()
       ORDER BY s.slot_time ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch slots" });
  }
});

// Book a slot
router.post("/book", async (req, res) => {
  const { studentId, slotId } = req.body;
  if (!studentId || !slotId)
    return res.status(400).json({ message: "studentId & slotId required" });

  try {
    // Update slot status
    await db.query(
      "UPDATE counselor_slots SET is_booked = 1 WHERE id = ? AND is_booked = 0",
      [slotId]
    );

    // Get slot details for fee calculation
    const [[slotInfo]] = await db.query(
      `SELECT s.slot_time, c.id AS counselor_id 
       FROM counselor_slots s 
       JOIN counselors c ON c.id = s.counselor_id 
       WHERE s.id = ?`,
      [slotId]
    );

    // Create booking record with payment status
    const [result] = await db.query(
      `INSERT INTO counselor_bookings 
      (student_id, slot_id, status, payment_status) 
      VALUES (?, ?, 'booked', 'paid')`,
      [studentId, slotId]
    );

    res.json({ 
      bookingId: result.insertId,
      message: "Booking confirmed successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to book slot" });
  }
});

// List bookings for a student
router.get("/my-bookings/:studentId", async (req, res) => {
  const { studentId } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT b.id AS booking_id, b.status, b.payment_status,
              s.slot_time, c.name AS counselor_name
       FROM counselor_bookings b
       JOIN counselor_slots s ON s.id = b.slot_id
       JOIN counselors c ON c.id = s.counselor_id
       WHERE b.student_id = ?`,
      [studentId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

export default router;
