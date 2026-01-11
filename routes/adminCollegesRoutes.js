// backend/routes/adminCollegesRoutes.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all colleges
router.get("/", asyncHandler(async (req, res) => {
  const { search, location, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = "SELECT * FROM colleges WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (name LIKE ? OR description LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (location) {
    query += " AND location LIKE ?";
    params.push(`%${location}%`);
  }

  query += " ORDER BY name ASC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  const [colleges] = await db.query(query, params);

  // Get total count
  let countQuery = "SELECT COUNT(*) AS total FROM colleges WHERE 1=1";
  const countParams = [];
  if (search) {
    countQuery += " AND (name LIKE ? OR description LIKE ?)";
    const searchTerm = `%${search}%`;
    countParams.push(searchTerm, searchTerm);
  }
  if (location) {
    countQuery += " AND location LIKE ?";
    countParams.push(`%${location}%`);
  }
  const [[{ total }]] = await db.query(countQuery, countParams);

  res.json({
    colleges,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// Get single college by ID
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[college]] = await db.query("SELECT * FROM colleges WHERE id=?", [id]);

  if (!college) {
    return res.status(404).json({ message: "College not found" });
  }

  res.json(college);
}));

// Create new college
router.post("/", asyncHandler(async (req, res) => {
  const {
    name,
    location,
    description,
    rating,
    website,
    contact_email,
    contact_phone,
    established_year,
    is_active = true,
  } = req.body;

  if (!name) {
    return res.status(400).json({ message: "College name is required" });
  }

  const [result] = await db.query(
    `INSERT INTO colleges (name, location, description, rating, website, contact_email, contact_phone, established_year, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      location || null,
      description || null,
      rating || null,
      website || null,
      contact_email || null,
      contact_phone || null,
      established_year || null,
      is_active ? 1 : 0,
    ]
  );

  const [[newCollege]] = await db.query("SELECT * FROM colleges WHERE id=?", [result.insertId]);
  res.status(201).json(newCollege);
}));

// Update college
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    location,
    description,
    rating,
    website,
    contact_email,
    contact_phone,
    established_year,
    is_active,
  } = req.body;

  // Check if college exists
  const [[existing]] = await db.query("SELECT * FROM colleges WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "College not found" });
  }

  await db.query(
    `UPDATE colleges 
     SET name=?, location=?, description=?, rating=?, website=?, 
         contact_email=?, contact_phone=?, established_year=?, is_active=?
     WHERE id=?`,
    [
      name !== undefined ? name : existing.name,
      location !== undefined ? location : existing.location,
      description !== undefined ? description : existing.description,
      rating !== undefined ? rating : existing.rating,
      website !== undefined ? website : existing.website,
      contact_email !== undefined ? contact_email : existing.contact_email,
      contact_phone !== undefined ? contact_phone : existing.contact_phone,
      established_year !== undefined ? established_year : existing.established_year,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id,
    ]
  );

  const [[updated]] = await db.query("SELECT * FROM colleges WHERE id=?", [id]);
  res.json(updated);
}));

// Delete college
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if college exists
  const [[existing]] = await db.query("SELECT id FROM colleges WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "College not found" });
  }

  // Delete related records
  await db.query("DELETE FROM college_careers WHERE college_id=?", [id]);
  await db.query("DELETE FROM student_shortlists WHERE college_id=?", [id]);

  // Delete college
  await db.query("DELETE FROM colleges WHERE id=?", [id]);

  res.json({ message: "College deleted successfully" });
}));

export default router;







