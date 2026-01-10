// backend/routes/careerRoutes.js
import express from "express";
import db from "../db/connection.js";

const router = express.Router();

// Get all careers
router.get("/all", async (req, res) => {
  try {
    const [careers] = await db.query("SELECT * FROM careers ORDER BY name");
    res.json(careers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch careers" });
  }
});

// Get single career by ID
router.get("/:careerId", async (req, res) => {
  const { careerId } = req.params;
  try {
    const [[career]] = await db.query("SELECT * FROM careers WHERE id=?", [careerId]);
    if (!career) {
      return res.status(404).json({ message: "Career not found" });
    }
    res.json(career);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch career" });
  }
});

// Careers for a student based on score
router.get("/recommended/:studentId", async (req, res) => {
  const { studentId } = req.params;

  try {
    // Get assessment results to find top categories
    // Map enum categories (R,I,A,S,E,C) to full names
    const [resultRows] = await db.query(`
      SELECT 
        CASE o.category
          WHEN 'R' THEN 'Realistic'
          WHEN 'I' THEN 'Investigative'
          WHEN 'A' THEN 'Artistic'
          WHEN 'S' THEN 'Social'
          WHEN 'E' THEN 'Enterprising'
          WHEN 'C' THEN 'Conventional'
          ELSE o.category
        END AS category,
        SUM(a.score) AS total
      FROM student_answers a
      JOIN options o ON o.id = a.option_id
      JOIN student_test_sessions s ON s.id = a.session_id
      WHERE s.student_id=?
      GROUP BY category
      ORDER BY total DESC
      LIMIT 3
    `, [studentId]);

    // If no results, return all careers (limit to 6)
    if (!resultRows.length) {
      const [allCareers] = await db.query("SELECT * FROM careers LIMIT 6");
      return res.json(allCareers);
    }

    // Get top categories (full names)
    const topCategories = resultRows.map((r) => r.category).filter(c => c);
    
    // Match careers based on category or riasec_code
    let careers = [];
    if (topCategories.length > 0) {
      try {
        // Build query with placeholders
        const placeholders = topCategories.map(() => '?').join(',');
        const riasecCodes = topCategories.map(c => c.charAt(0).toUpperCase());
        const riasecPlaceholders = riasecCodes.map(() => '?').join(',');
        
        // Build the query parameters
        const queryParams = [
          ...topCategories,        // For category IN
          ...riasecCodes,          // For riasec_code IN
          `%${topCategories[0]}%`  // For name LIKE
        ];
        
        // Simplified query without complex ORDER BY CASE
        const [careerRows] = await db.query(
          `SELECT * FROM careers 
           WHERE (category IN (${placeholders}) 
                  OR riasec_code IN (${riasecPlaceholders})
                  OR name LIKE ?)
           ORDER BY id
           LIMIT 6`,
          queryParams
        );
        careers = careerRows;
      } catch (err) {
        console.error("Error matching careers:", err);
        // Fallback to simple query
        try {
          const [simpleCareers] = await db.query(
            "SELECT * FROM careers LIMIT 6"
          );
          careers = simpleCareers;
        } catch (fallbackErr) {
          console.error("Fallback query also failed:", fallbackErr);
        }
      }
    }

    // If no matches, return top 6 careers
    if (!careers.length) {
      const [allCareers] = await db.query("SELECT * FROM careers LIMIT 6");
      return res.json(allCareers);
    }

    // Return top 6 careers as array
    const finalCareers = careers.slice(0, 6);
    res.json(finalCareers);
  } catch (err) {
    console.error(err);
    // Fallback: return top 6 careers
    try {
      const [allCareers] = await db.query("SELECT * FROM careers LIMIT 6");
      res.json(allCareers);
    } catch (fallbackErr) {
      console.error(fallbackErr);
      res.status(500).json({ message: "Failed to get recommended careers" });
    }
  }
});

// Colleges for a career (returns top 5)
router.get("/colleges/:careerId", async (req, res) => {
  const { careerId } = req.params;

  try {
    // First try to get career to determine category/type
    const [[career]] = await db.query("SELECT * FROM careers WHERE id=?", [careerId]);
    
    if (!career) {
      // If career not found, return top 5 colleges
      const [allColleges] = await db.query("SELECT * FROM colleges LIMIT 5");
      return res.json(allColleges);
    }

    // Try to get colleges from junction table (limit to top 5)
    const [rows] = await db.query(
      `SELECT col.*
       FROM college_careers cc
       JOIN colleges col ON col.id = cc.college_id
       WHERE cc.career_id=?
       LIMIT 5`,
      [careerId]
    );

    // If no junction table results, return top 5 colleges (fallback)
    if (!rows.length) {
      const [allColleges] = await db.query("SELECT * FROM colleges LIMIT 5");
      return res.json(allColleges);
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    // Fallback: return top 5 colleges
    try {
      const [allColleges] = await db.query("SELECT * FROM colleges LIMIT 5");
      res.json(allColleges);
    } catch (fallbackErr) {
      console.error(fallbackErr);
      res.status(500).json({ message: "Failed to fetch colleges" });
    }
  }
});

export default router;
