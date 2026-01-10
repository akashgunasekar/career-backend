// backend/routes/adminStatsRoutes.js
import express from "express";
import db from "../db/connection.js";

const router = express.Router();

// Overview stats
router.get("/overview", async (req, res) => {
  try {
    const [[studentCount]] = await db.query(
      "SELECT COUNT(*) AS total_students FROM students"
    );
    const [[testCount]] = await db.query(
      "SELECT COUNT(DISTINCT student_id) AS students_completed_tests FROM student_test_sessions WHERE status='completed'"
    );
    const [[bookingCount]] = await db.query(
      "SELECT COUNT(*) AS total_bookings FROM counselor_bookings"
    );
    const [[careerCount]] = await db.query(
      "SELECT COUNT(*) AS total_careers FROM careers"
    );
    const [[collegeCount]] = await db.query(
      "SELECT COUNT(*) AS total_colleges FROM colleges"
    );
    const [[counselorCount]] = await db.query(
      "SELECT COUNT(*) AS total_counselors FROM counselors"
    );
    const [[instituteCount]] = await db.query(
      "SELECT COUNT(*) AS total_institutes FROM institutes"
    );

    res.json({
      total_students: studentCount.total_students,
      students_completed_tests: testCount.students_completed_tests,
      total_bookings: bookingCount.total_bookings,
      total_careers: careerCount.total_careers,
      total_colleges: collegeCount.total_colleges,
      total_counselors: counselorCount.total_counselors,
      total_institutes: instituteCount.total_institutes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch overview stats" });
  }
});

// Details per student
router.get("/student-results/:studentId", async (req, res) => {
  const { studentId } = req.params;
  try {
    const [studentRows] = await db.query(
      "SELECT id, full_name, phone FROM students WHERE id=?",
      [studentId]
    );

    const student = studentRows[0];

    const [results] = await db.query(
      `SELECT r.*, t.name AS test_name
       FROM student_results r
       JOIN tests t ON t.id = r.test_id
       WHERE r.student_id=?`,
      [studentId]
    );

    const [bookings] = await db.query(
      `SELECT b.id, b.status, s.slot_time, c.name AS counselor_name
       FROM counselor_bookings b
       JOIN counselor_slots s ON s.id = b.slot_id
       JOIN counselors c ON c.id = s.counselor_id
       WHERE b.student_id=?`,
      [studentId]
    );

    res.json({ student, results, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch student details" });
  }
});

export default router;
