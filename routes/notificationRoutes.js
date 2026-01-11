// backend/routes/notificationRoutes.js
import express from "express";
import { db } from "../db/connection.js";
import { authenticate, requireStudent } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// Get notifications for a student
router.get("/student/:studentId", authenticate, asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  // Verify student can only access their own notifications
  if (req.user.role !== "admin" && req.user.id !== parseInt(studentId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  const [notifications] = await db.query(
    `SELECT * FROM notifications 
     WHERE student_id = ? 
     ORDER BY created_at DESC 
     LIMIT 50`,
    [studentId]
  );

  res.json(notifications);
}));

// Mark notification as read
router.put("/:id/read", authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get notification to verify ownership
  const [[notification]] = await db.query("SELECT * FROM notifications WHERE id=?", [id]);
  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  // Verify student can only mark their own notifications as read
  if (req.user.role !== "admin" && req.user.id !== notification.student_id) {
    return res.status(403).json({ message: "Access denied" });
  }

  await db.query("UPDATE notifications SET is_read = 1 WHERE id = ?", [id]);

  res.json({ message: "Notification marked as read" });
}));

// Mark all notifications as read for a student
router.put("/student/:studentId/read-all", authenticate, asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  // Verify student can only mark their own notifications as read
  if (req.user.role !== "admin" && req.user.id !== parseInt(studentId)) {
    return res.status(403).json({ message: "Access denied" });
  }

  await db.query("UPDATE notifications SET is_read = 1 WHERE student_id = ?", [studentId]);

  res.json({ message: "All notifications marked as read" });
}));

// Admin: Create notification
router.post("/", authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const { student_id, title, message, type = "info" } = req.body;

  if (!student_id || !title || !message) {
    return res.status(400).json({ message: "student_id, title, and message are required" });
  }

  // Verify student exists
  const [[student]] = await db.query("SELECT id FROM students WHERE id=?", [student_id]);
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }

  const [result] = await db.query(
    "INSERT INTO notifications (student_id, title, message, type) VALUES (?, ?, ?, ?)",
    [student_id, title, message, type]
  );

  const [[newNotification]] = await db.query("SELECT * FROM notifications WHERE id=?", [result.insertId]);
  res.status(201).json(newNotification);
}));

// Admin: Get all notifications
router.get("/", authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  const { student_id, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT n.*, s.full_name AS student_name, s.phone AS student_phone
    FROM notifications n
    JOIN students s ON s.id = n.student_id
    WHERE 1=1
  `;
  const params = [];

  if (student_id) {
    query += " AND n.student_id = ?";
    params.push(student_id);
  }

  query += " ORDER BY n.created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  const [notifications] = await db.query(query, params);

  // Get total count
  let countQuery = "SELECT COUNT(*) AS total FROM notifications WHERE 1=1";
  const countParams = [];
  if (student_id) {
    countQuery += " AND student_id = ?";
    countParams.push(student_id);
  }
  const [[{ total }]] = await db.query(countQuery, countParams);

  res.json({
    notifications,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

export default router;
