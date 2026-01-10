// backend/routes/adminQuestionsRoutes.js
import express from "express";
import db from "../db/connection.js";
import { requireAdmin } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all questions
router.get("/", asyncHandler(async (req, res) => {
  const { test_id, test_code, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  // Handle both test_code and test_id columns in questions table
  let query = `
    SELECT q.*, 
           COALESCE(t.name, 'Unknown') AS test_name, 
           COALESCE(t.code, q.test_code, 'UNKNOWN') AS test_code
    FROM questions q
    LEFT JOIN tests t ON t.id = q.test_id OR t.code = q.test_code
    WHERE 1=1
  `;
  const params = [];

  if (test_id) {
    query += " AND (q.test_id = ? OR q.test_id = (SELECT id FROM tests WHERE id = ?))";
    params.push(test_id, test_id);
  }

  if (test_code) {
    query += " AND (t.code = ? OR q.test_code = ?)";
    params.push(test_code, test_code);
  }

  query += " ORDER BY q.sequence ASC, q.id ASC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  const [questions] = await db.query(query, params);

  // Get options for each question
  for (const question of questions) {
    const [options] = await db.query(
      "SELECT * FROM options WHERE question_id = ? ORDER BY id ASC",
      [question.id]
    );
    question.options = options;
  }

  // Get total count (handle both test_code and test_id)
  let countQuery = `
    SELECT COUNT(*) AS total
    FROM questions q
    LEFT JOIN tests t ON t.id = q.test_id OR t.code = q.test_code
    WHERE 1=1
  `;
  const countParams = [];
  if (test_id) {
    countQuery += " AND (q.test_id = ? OR q.test_id = (SELECT id FROM tests WHERE id = ?))";
    countParams.push(test_id, test_id);
  }
  if (test_code) {
    countQuery += " AND (t.code = ? OR q.test_code = ?)";
    countParams.push(test_code, test_code);
  }
  const [[{ total }]] = await db.query(countQuery, countParams);

  res.json({
    questions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}));

// Get single question by ID
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [[question]] = await db.query(
    `SELECT q.*, 
           COALESCE(t.name, 'Unknown') AS test_name, 
           COALESCE(t.code, q.test_code, 'UNKNOWN') AS test_code
     FROM questions q
     LEFT JOIN tests t ON t.id = q.test_id OR t.code = q.test_code
     WHERE q.id=?`,
    [id]
  );

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  // Get options
  const [options] = await db.query(
    "SELECT * FROM options WHERE question_id = ? ORDER BY id ASC",
    [id]
  );
  question.options = options;

  res.json(question);
}));

// Create new question with options
router.post("/", asyncHandler(async (req, res) => {
  const { test_id, question_text, sequence, options } = req.body;

  if (!test_id || !question_text) {
    return res.status(400).json({ message: "test_id and question_text are required" });
  }

  // Check if test exists
  const [[test]] = await db.query("SELECT id FROM tests WHERE id=?", [test_id]);
  if (!test) {
    return res.status(400).json({ message: "Invalid test_id" });
  }

  // Get next sequence if not provided
  let questionSequence = sequence;
  if (!questionSequence) {
    const [[{ maxSeq }]] = await db.query(
      "SELECT COALESCE(MAX(sequence), 0) + 1 AS maxSeq FROM questions WHERE test_id=?",
      [test_id]
    );
    questionSequence = maxSeq;
  }

  // Insert question
  const [result] = await db.query(
    "INSERT INTO questions (test_id, question_text, sequence) VALUES (?, ?, ?)",
    [test_id, question_text, questionSequence]
  );

  const questionId = result.insertId;

  // Insert options - require 4-5 options (4 preferred, 5 for backward compatibility)
  if (!options || !Array.isArray(options) || options.length < 4 || options.length > 5) {
    return res.status(400).json({ message: "4-5 options are required for each question (4 preferred)" });
  }

  // Validate all options have text
  for (const option of options) {
    if (!option.text && !option.option_text) {
      return res.status(400).json({ message: "All options must have text" });
    }
  }

  // Insert all 4 options
  for (const option of options) {
    await db.query(
      "INSERT INTO options (question_id, option_text, score, category) VALUES (?, ?, ?, ?)",
      [
        questionId,
        option.text || option.option_text || "",
        option.score || 0,
        option.category || null,
      ]
    );
  }

  // Return created question with options
  const [[newQuestion]] = await db.query(
    `SELECT q.*, t.name AS test_name, t.code AS test_code
     FROM questions q
     JOIN tests t ON t.id = q.test_id
     WHERE q.id=?`,
    [questionId]
  );
  const [questionOptions] = await db.query(
    "SELECT * FROM options WHERE question_id = ? ORDER BY id ASC",
    [questionId]
  );
  newQuestion.options = questionOptions;

  res.status(201).json(newQuestion);
}));

// Update question
router.put("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { question_text, sequence, test_id, options } = req.body;

  // Check if question exists
  const [[existing]] = await db.query("SELECT * FROM questions WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "Question not found" });
  }

  // Update question
  await db.query(
    "UPDATE questions SET question_text=?, sequence=?, test_id=? WHERE id=?",
    [
      question_text !== undefined ? question_text : existing.question_text,
      sequence !== undefined ? sequence : existing.sequence,
      test_id !== undefined ? test_id : existing.test_id,
      id,
    ]
  );

  // Update options if provided - require 4-5 options (4 preferred, 5 for backward compatibility)
  if (options && Array.isArray(options)) {
    if (options.length < 4 || options.length > 5) {
      return res.status(400).json({ message: "4-5 options are required for each question (4 preferred)" });
    }

    // Validate all options have text
    for (const option of options) {
      if (!option.text && !option.option_text) {
        return res.status(400).json({ message: "All options must have text" });
      }
    }

    // Delete existing options
    await db.query("DELETE FROM options WHERE question_id=?", [id]);

    // Insert new options
    for (const option of options) {
      await db.query(
        "INSERT INTO options (question_id, option_text, score, category) VALUES (?, ?, ?, ?)",
        [
          id,
          option.text || option.option_text || "",
          option.score || 0,
          option.category || null,
        ]
      );
    }
  }

  // Return updated question with options
  const [[updated]] = await db.query(
    `SELECT q.*, t.name AS test_name, t.code AS test_code
     FROM questions q
     JOIN tests t ON t.id = q.test_id
     WHERE q.id=?`,
    [id]
  );
  const [questionOptions] = await db.query(
    "SELECT * FROM options WHERE question_id = ? ORDER BY id ASC",
    [id]
  );
  updated.options = questionOptions;

  res.json(updated);
}));

// Delete question
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if question exists
  const [[existing]] = await db.query("SELECT id FROM questions WHERE id=?", [id]);
  if (!existing) {
    return res.status(404).json({ message: "Question not found" });
  }

  // Delete related records
  await db.query("DELETE FROM options WHERE question_id=?", [id]);
  await db.query("DELETE FROM student_answers WHERE question_id=?", [id]);

  // Delete question
  await db.query("DELETE FROM questions WHERE id=?", [id]);

  res.json({ message: "Question deleted successfully" });
}));

export default router;

