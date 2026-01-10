import express from "express";
import db from "../db/connection.js";

const router = express.Router();

/** -------------------------------
 *  GET TEST INFO
 * --------------------------------
*/
router.get("/info/:testCode", async (req, res) => {
  const { testCode } = req.params;

  try {
    let testId;
    if (!isNaN(testCode)) {
      testId = parseInt(testCode);
    } else {
      const [[test]] = await db.query("SELECT id FROM tests WHERE code=?", [testCode]);
      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }
      testId = test.id;
    }

    const [[testInfo]] = await db.query("SELECT * FROM tests WHERE id=?", [testId]);
    if (!testInfo) {
      return res.status(404).json({ message: "Test not found" });
    }

    // Get total questions count (try test_code first, then test_id)
    let actualTestCode = testCode;
    if (!isNaN(testCode)) {
      const [[testByCode]] = await db.query("SELECT code FROM tests WHERE id=?", [testId]);
      if (testByCode) actualTestCode = testByCode.code;
    }
    
    let [[countResult]] = await db.query(
      `SELECT COUNT(*) AS total FROM questions WHERE test_code=?`,
      [actualTestCode]
    );
    
    // If no results with test_code, try test_id
    if (countResult.total === 0 && testId) {
      [[countResult]] = await db.query(
        `SELECT COUNT(*) AS total FROM questions WHERE test_id=?`,
        [testId]
      );
    }

    res.json({
      id: testInfo.id,
      name: testInfo.name,
      code: testInfo.code,
      description: testInfo.description,
      totalQuestions: countResult.total || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch test info" });
  }
});

/** -------------------------------
 *  STEP 1: START TEST
 * --------------------------------
*/
router.post("/start", async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) return res.status(400).json({ message: "Student ID required" });

  try {
    const [[existing]] = await db.query(
      "SELECT * FROM student_test_sessions WHERE student_id=? AND status='in_progress'",
      [studentId]
    );

    if (existing) {
      return res.json({
        sessionId: existing.id,
        currentStage: existing.current_stage,
        progress: existing.progress,
      });
    }

    const [[firstTest]] = await db.query(
      "SELECT * FROM tests ORDER BY sequence ASC LIMIT 1"
    );

    if (!firstTest) {
      return res.status(404).json({ message: "No tests available. Please seed the database." });
    }

    const [result] = await db.query(
      `INSERT INTO student_test_sessions (student_id, test_id, current_stage, progress, status)
       VALUES (?, ?, ?, 0, 'in_progress')`,
      [studentId, firstTest.id, firstTest.code]
    );

    res.json({
      sessionId: result.insertId,
      currentStage: firstTest.code,
      progress: 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to start session" });
  }
});


/** -------------------------------
 *  STEP 2: GET NEXT QUESTION
 * --------------------------------
*/
router.get("/next/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const [[session]] = await db.query(
      `SELECT * FROM student_test_sessions WHERE id=?`,
      [sessionId]
    );

    // Get test code and test_id from current_stage (handle both numeric ID and code)
    let testCode = session.current_stage;
    let testId = null;
    
    if (!isNaN(session.current_stage)) {
      // current_stage is a number (test_id), look up the code
      testId = parseInt(session.current_stage);
      const [[test]] = await db.query(
        `SELECT code FROM tests WHERE id=?`,
        [testId]
      );
      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }
      testCode = test.code;
    } else {
      // current_stage is a code, get the test_id
      const [[test]] = await db.query(
        `SELECT id FROM tests WHERE code=?`,
        [testCode]
      );
      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }
      testId = test.id;
    }

    // Get total questions count for this test (check both test_code and test_id)
    let [[countResult]] = await db.query(
      `SELECT COUNT(*) AS total FROM questions WHERE test_code=?`,
      [testCode]
    );
    
    // If no results with test_code, try test_id
    if (countResult.total === 0 && testId) {
      [[countResult]] = await db.query(
        `SELECT COUNT(*) AS total FROM questions WHERE test_id=?`,
        [testId]
      );
    }
    
    const totalQuestions = countResult?.total || 0;

    // Try test_code first, then fallback to test_id
    let [qs] = await db.query(
      `SELECT * FROM questions WHERE test_code=? ORDER BY sequence ASC, id ASC LIMIT 1 OFFSET ?`,
      [testCode, session.progress]
    );
    
    // If no results with test_code, try test_id
    if (!qs.length && testId) {
      [qs] = await db.query(
        `SELECT * FROM questions WHERE test_id=? ORDER BY sequence ASC, id ASC LIMIT 1 OFFSET ?`,
        [testId, session.progress]
      );
    }

    if (!qs.length) return res.json({ stageComplete: true });

    const question = qs[0];
    const [options] = await db.query(
      "SELECT * FROM options WHERE question_id=? ORDER BY id", [question.id]
    );

    res.json({
      question,
      options,
      stage: session.current_stage,
      progress: session.progress + 1,
      totalQuestions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching question" });
  }
});


/** -------------------------------
 *  STEP 3: SAVE ANSWER
 * --------------------------------
*/
router.post("/answer", async (req, res) => {
  const { sessionId, questionId, optionId } = req.body;

  try {
    const [[opt]] = await db.query(
      "SELECT score FROM options WHERE id=?",
      [optionId]
    );

    if (!opt) {
      return res.status(400).json({ message: "Option not found" });
    }

    await db.query(
      `INSERT INTO student_answers (session_id, question_id, option_id, score)
       VALUES (?, ?, ?, ?)`,
      [sessionId, questionId, optionId, opt.score]
    );

    await db.query("UPDATE student_test_sessions SET progress = progress + 1 WHERE id=?", [
      sessionId,
    ]);

    res.json({ saved: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save answer" });
  }
});


/** -------------------------------
 *  STEP 4: MOVE NEXT STAGE
 * --------------------------------
*/
router.post("/next-stage", async (req, res) => {
  const { sessionId } = req.body;

  try {
    const [[session]] = await db.query(
      "SELECT * FROM student_test_sessions WHERE id=?",
      [sessionId]
    );

    const [tests] = await db.query("SELECT * FROM tests ORDER BY sequence");
    const order = tests.map((t) => t.code);

    // Handle numeric current_stage by converting to test code first
    let currentStageCode = session.current_stage;
    if (!isNaN(session.current_stage)) {
      const [[testByNum]] = await db.query("SELECT code FROM tests WHERE id=?", [session.current_stage]);
      if (testByNum) {
        currentStageCode = testByNum.code;
      }
    }

    const nextStage = order[order.indexOf(currentStageCode) + 1];

    if (!nextStage) {
      await db.query(
        "UPDATE student_test_sessions SET status='completed', completed_at=NOW() WHERE id=?",
        [sessionId]
      );
      
      // Calculate and save final results
      try {
        const [[sessionData]] = await db.query("SELECT * FROM student_test_sessions WHERE id=?", [sessionId]);
        const testId = sessionData.test_id;
        
        if (!testId) {
          return res.json({ finished: true });
        }
        
        // Calculate total score
        const [scoreRows] = await db.query(`
          SELECT SUM(a.score) AS total_score
          FROM student_answers a
          WHERE a.session_id=?
        `, [sessionId]);
        
        const totalScore = scoreRows[0]?.total_score || 0;
        
        // Try to save to student_results table (if it exists)
        try {
          await db.query(
            `INSERT INTO student_results (student_id, test_id, total_score, created_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE total_score=?, created_at=NOW()`,
            [sessionData.student_id, testId, totalScore, totalScore]
          );
        } catch (err) {
          // Table might not exist, that's okay - silently skip
        }
      } catch (err) {
        // Error saving results - continue anyway
      }
      
      return res.json({ finished: true });
    }

    // Get test_id for next stage
    const [[nextTest]] = await db.query("SELECT id FROM tests WHERE code=?", [nextStage]);
    if (!nextTest) {
      return res.status(404).json({ message: "Next test not found" });
    }

    await db.query(
      "UPDATE student_test_sessions SET test_id=?, current_stage=?, progress=0 WHERE id=?",
      [nextTest.id, nextStage, sessionId]
    );

    res.json({ nextStage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to move next stage" });
  }
});


/** -------------------------------
 *  STEP 5: FINAL RESULTS
 * --------------------------------
*/
router.get("/result/:studentId", async (req, res) => {
  const { studentId } = req.params;

  try {
    // Use option category mapping - map enum values to full names
    const [rows] = await db.query(`
      SELECT 
        CASE o.category
          WHEN 'R' THEN 'Realistic'
          WHEN 'I' THEN 'Investigative'
          WHEN 'A' THEN 'Artistic'
          WHEN 'S' THEN 'Social'
          WHEN 'E' THEN 'Enterprising'
          WHEN 'C' THEN 'Conventional'
          WHEN 'P' THEN 'Personality'
          WHEN 'V' THEN 'Values'
          ELSE COALESCE(o.category, 'Other')
        END AS category,
        SUM(a.score) AS total
      FROM student_answers a
      JOIN options o ON o.id = a.option_id
      JOIN student_test_sessions s ON s.id = a.session_id
      WHERE s.student_id=?
        AND o.category IS NOT NULL
        AND o.category != ''
      GROUP BY category
      ORDER BY total DESC
    `, [studentId]);

    // If no category-based results, try question-based fallback for RIASEC
    if (!rows.length) {
      const [fallbackRows] = await db.query(`
        SELECT 
          CASE 
            WHEN q.sequence <= 5 THEN 'Realistic'
            WHEN q.sequence <= 10 THEN 'Investigative'
            WHEN q.sequence <= 15 THEN 'Artistic'
            WHEN q.sequence <= 20 THEN 'Social'
            WHEN q.sequence <= 25 THEN 'Enterprising'
            ELSE 'Conventional'
          END AS category,
          SUM(a.score) AS total
        FROM student_answers a
        JOIN questions q ON q.id = a.question_id
        JOIN student_test_sessions s ON s.id = a.session_id
        WHERE s.student_id=?
        GROUP BY category
        ORDER BY total DESC
      `, [studentId]);
      
      if (fallbackRows.length) {
        return res.json({
          success: true,
          results: fallbackRows,
        });
      }
    }

    if (!rows.length) return res.json({ message: "No answers found yet.", results: [] });

    res.json({
      success: true,
      results: rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to compute results" });
  }
});

export default router;
