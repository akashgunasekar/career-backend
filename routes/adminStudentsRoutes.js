// backend/routes/adminStudentsRoutes.js
import express from "express";
import db from "../db/connection.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all students
router.get("/", asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = "SELECT * FROM students WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (full_name LIKE ? OR phone LIKE ? OR registration_number LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  const [students] = await db.query(query, params);

  // Get total count
  let countQuery = "SELECT COUNT(*) AS total FROM students WHERE 1=1";
  const countParams = [];
  if (search) {
    countQuery += " AND (full_name LIKE ? OR phone LIKE ? OR registration_number LIKE ?)";
    const searchTerm = `%${search}%`;
    countParams.push(searchTerm, searchTerm, searchTerm);
  }
  const [[{ total }]] = await db.query(countQuery, countParams);

  res.json({
    students,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// Get single student by ID
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[student]] = await db.query("SELECT * FROM students WHERE id=?", [id]);

  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  res.json(student);
}));

// Create new student
router.post("/", asyncHandler(async (req, res) => {
  const { phone, full_name, grade, board, city } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  // Check if phone already exists
  const [existing] = await db.query("SELECT id FROM students WHERE phone=?", [phone]);
  if (existing.length > 0) {
    return res.status(400).json({ message: "Student with this phone number already exists" });
  }

  // Generate registration number
  const registrationNumber = `STU${Date.now().toString().slice(-6)}`;

  const [result] = await db.query(
    `INSERT INTO students (phone, full_name, grade, board, city, registration_number, is_profile_complete)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [phone, full_name || null, grade || null, board || null, city || null, registrationNumber, full_name ? 1 : 0]
  );

  const [[newStudent]] = await db.query("SELECT * FROM students WHERE id=?", [result.insertId]);
  res.status(201).json(newStudent);
}));

// Update student
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { phone, full_name, grade, board, city, is_profile_complete } = req.body;

  // Check if student exists
  const [[existing]] = await db.query("SELECT * FROM students WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "Student not found" });
  }

  // Check if phone is being changed and if it conflicts
  if (phone && phone !== existing.phone) {
    const [phoneCheck] = await db.query("SELECT id FROM students WHERE phone=? AND id!=?", [phone, id]);
    if (phoneCheck.length > 0) {
      return res.status(400).json({ message: "Phone number already in use" });
    }
  }

  await db.query(
    `UPDATE students 
     SET phone=?, full_name=?, grade=?, board=?, city=?, is_profile_complete=?
     WHERE id=?`,
    [
      phone || existing.phone,
      full_name !== undefined ? full_name : existing.full_name,
      grade !== undefined ? grade : existing.grade,
      board !== undefined ? board : existing.board,
      city !== undefined ? city : existing.city,
      is_profile_complete !== undefined ? is_profile_complete : existing.is_profile_complete,
      id,
    ]
  );

  const [[updated]] = await db.query("SELECT * FROM students WHERE id=?", [id]);
  res.json(updated);
}));

// Delete student
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if student exists
  const [[existing]] = await db.query("SELECT id FROM students WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "Student not found" });
  }

  // Delete related records first (if needed)
  await db.query("DELETE FROM student_test_sessions WHERE student_id=?", [id]);
  await db.query("DELETE FROM student_answers WHERE session_id IN (SELECT id FROM student_test_sessions WHERE student_id=?)", [id]);
  await db.query("DELETE FROM student_results WHERE student_id=?", [id]);
  await db.query("DELETE FROM student_shortlists WHERE student_id=?", [id]);
  await db.query("DELETE FROM counselor_bookings WHERE student_id=?", [id]);

  // Delete student
  await db.query("DELETE FROM students WHERE id=?", [id]);

  res.json({ message: "Student deleted successfully" });
}));

export default router;







