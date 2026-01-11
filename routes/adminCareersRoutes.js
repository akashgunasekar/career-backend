// backend/routes/adminCareersRoutes.js
import express from "express";
import { db } from "../db/connection.js";

import { requireAdmin } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all careers
router.get("/", asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = "SELECT * FROM careers WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (name LIKE ? OR description LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY name ASC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  const [careers] = await db.query(query, params);

  // Get total count
  let countQuery = "SELECT COUNT(*) AS total FROM careers WHERE 1=1";
  const countParams = [];
  if (search) {
    countQuery += " AND (name LIKE ? OR description LIKE ?)";
    const searchTerm = `%${search}%`;
    countParams.push(searchTerm, searchTerm);
  }
  if (category) {
    countQuery += " AND category = ?";
    countParams.push(category);
  }
  const [[{ total }]] = await db.query(countQuery, countParams);

  res.json({
    careers,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// Get single career by ID
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[career]] = await db.query("SELECT * FROM careers WHERE id=?", [id]);

  if (!career) {
    return res.status(404).json({ message: "Career not found" });
  }

  res.json(career);
}));

// Create new career
router.post("/", asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    average_salary,
    growth_rate,
    education_required,
    skills_required,
    is_active = true,
  } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Career name is required" });
  }

  const [result] = await db.query(
    `INSERT INTO careers (name, description, category, average_salary, growth_rate, education_required, skills_required, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description || null, category || null, average_salary || null, growth_rate || null, education_required || null, skills_required || null, is_active ? 1 : 0]
  );

  const [[newCareer]] = await db.query("SELECT * FROM careers WHERE id=?", [result.insertId]);
  res.status(201).json(newCareer);
}));

// Update career
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    category,
    average_salary,
    growth_rate,
    education_required,
    skills_required,
    is_active,
  } = req.body;

  // Check if career exists
  const [[existing]] = await db.query("SELECT * FROM careers WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "Career not found" });
  }

  await db.query(
    `UPDATE careers 
     SET name=?, description=?, category=?, average_salary=?, growth_rate=?, 
         education_required=?, skills_required=?, is_active=?
     WHERE id=?`,
    [
      name !== undefined ? name : existing.name,
      description !== undefined ? description : existing.description,
      category !== undefined ? category : existing.category,
      average_salary !== undefined ? average_salary : existing.average_salary,
      growth_rate !== undefined ? growth_rate : existing.growth_rate,
      education_required !== undefined ? education_required : existing.education_required,
      skills_required !== undefined ? skills_required : existing.skills_required,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id,
    ]
  );

  const [[updated]] = await db.query("SELECT * FROM careers WHERE id=?", [id]);
  res.json(updated);
}));

// Delete career
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if career exists
  const [[existing]] = await db.query("SELECT id FROM careers WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "Career not found" });
  }

  // Delete related records
  await db.query("DELETE FROM college_careers WHERE career_id=?", [id]);

  // Delete career
  await db.query("DELETE FROM careers WHERE id=?", [id]);

  res.json({ message: "Career deleted successfully" });
}));

export default router;







