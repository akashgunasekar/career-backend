// backend/routes/adminCounselorsRoutes.js
import express from "express";
import { db } from "../db/connection.js";

import { requireAdmin } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all counselors
router.get("/", asyncHandler(async (req, res) => {
  const { search, specialization, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = "SELECT * FROM counselors WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (name LIKE ? OR specialization LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (specialization) {
    query += " AND specialization = ?";
    params.push(specialization);
  }

  query += " ORDER BY name ASC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  const [counselors] = await db.query(query, params);

  // Get total count
  let countQuery = "SELECT COUNT(*) AS total FROM counselors WHERE 1=1";
  const countParams = [];
  if (search) {
    countQuery += " AND (name LIKE ? OR specialization LIKE ?)";
    const searchTerm = `%${search}%`;
    countParams.push(searchTerm, searchTerm);
  }
  if (specialization) {
    countQuery += " AND specialization = ?";
    countParams.push(specialization);
  }
  const [[{ total }]] = await db.query(countQuery, countParams);

  res.json({
    counselors,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// Get single counselor by ID
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[counselor]] = await db.query("SELECT * FROM counselors WHERE id=?", [id]);

  if (!counselor) {
    return res.status(404).json({ message: "Counselor not found" });
  }

  res.json(counselor);
}));

// Create new counselor
router.post("/", asyncHandler(async (req, res) => {
  const {
    name,
    specialization,
    experience_years,
    qualification,
    bio,
    email,
    phone,
    fee_per_session,
    is_active = true,
  } = req.body;

  if (!name || !specialization) {
    return res.status(400).json({ message: "Name and specialization are required" });
  }

  const [result] = await db.query(
    `INSERT INTO counselors (name, specialization, experience_years, qualification, bio, email, phone, fee_per_session, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      specialization,
      experience_years || 0,
      qualification || null,
      bio || null,
      email || null,
      phone || null,
      fee_per_session || null,
      is_active ? 1 : 0,
    ]
  );

  const [[newCounselor]] = await db.query("SELECT * FROM counselors WHERE id=?", [result.insertId]);
  res.status(201).json(newCounselor);
}));

// Update counselor
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    specialization,
    experience_years,
    qualification,
    bio,
    email,
    phone,
    fee_per_session,
    is_active,
  } = req.body;

  // Check if counselor exists
  const [[existing]] = await db.query("SELECT * FROM counselors WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "Counselor not found" });
  }

  await db.query(
    `UPDATE counselors 
     SET name=?, specialization=?, experience_years=?, qualification=?, 
         bio=?, email=?, phone=?, fee_per_session=?, is_active=?
     WHERE id=?`,
    [
      name !== undefined ? name : existing.name,
      specialization !== undefined ? specialization : existing.specialization,
      experience_years !== undefined ? experience_years : existing.experience_years,
      qualification !== undefined ? qualification : existing.qualification,
      bio !== undefined ? bio : existing.bio,
      email !== undefined ? email : existing.email,
      phone !== undefined ? phone : existing.phone,
      fee_per_session !== undefined ? fee_per_session : existing.fee_per_session,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id,
    ]
  );

  const [[updated]] = await db.query("SELECT * FROM counselors WHERE id=?", [id]);
  res.json(updated);
}));

// Delete counselor
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if counselor exists
  const [[existing]] = await db.query("SELECT id FROM counselors WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "Counselor not found" });
  }

  // Delete related records
  await db.query("DELETE FROM counselor_slots WHERE counselor_id=?", [id]);
  await db.query("DELETE FROM counselor_bookings WHERE slot_id IN (SELECT id FROM counselor_slots WHERE counselor_id=?)", [id]);

  // Delete counselor
  await db.query("DELETE FROM counselors WHERE id=?", [id]);

  res.json({ message: "Counselor deleted successfully" });
}));

export default router;







