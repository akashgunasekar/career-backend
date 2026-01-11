// backend/routes/studentRoutes.js
import express from "express";
import { db } from "../db/connection.js";
import generateOTP from "../utils/generateOTP.js";
import sendOTP from "../utils/sendOTP.js";
import { signToken } from "../utils/jwt.js";

const router = express.Router();

/* --------------------
   1) Send OTP (Login or Signup)
--------------------- */
router.post("/auth/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone required" });

  try {
    const [rows] = await db.query("SELECT * FROM students WHERE phone = ?", [phone]);
    let student = rows[0];

    // If new user → create record
    if (!student) {
      const [result] = await db.query(
        "INSERT INTO students (phone) VALUES (?)",
        [phone]
      );
      const [created] = await db.query(
        "SELECT * FROM students WHERE id = ?",
        [result.insertId]
      );
      student = created[0];
    }

    const otp = generateOTP();
    const expire = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    // Ensure OTP is stored as string
    await db.query(
      "UPDATE students SET otp=?, otp_expire=? WHERE id=?",
      [String(otp), expire, student.id]
    );

    await sendOTP(phone, otp);
    
    console.log(`✅ OTP ${otp} generated and stored for phone: ${phone}, expires at: ${expire}`);

    // Return OTP in response for development (remove in production)
    res.json({ 
      message: "OTP sent",
      otp: otp // Include OTP for development/testing
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});


/* --------------------
   2) Verify OTP -> Login + check Profile
--------------------- */
router.post("/auth/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp)
    return res.status(400).json({ message: "Phone & OTP required" });

  try {
    // Use SQL WHERE clause to verify OTP and expiry in one query (more reliable)
    const [rows] = await db.query(
      "SELECT * FROM students WHERE phone=? AND otp=? AND otp_expire > NOW()",
      [phone, String(otp).trim()]
    );

    if (!rows.length) {
      // Check if student exists but OTP is wrong/expired
      const [studentRows] = await db.query("SELECT * FROM students WHERE phone=?", [phone]);
      
      if (!studentRows.length) {
        console.log(`❌ Student not found for phone: ${phone}`);
        return res.status(404).json({ message: "Student not found" });
      }

      const student = studentRows[0];
      
      if (!student.otp || !student.otp_expire) {
        console.log(`❌ OTP not requested for phone: ${phone}`);
        return res.status(400).json({ message: "OTP not requested. Please request a new OTP." });
      }

      // Check if expired
      const now = new Date();
      const expiry = new Date(student.otp_expire);
      if (now > expiry) {
        console.log(`❌ OTP expired for phone: ${phone}. Expired at: ${expiry}, Now: ${now}`);
        return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
      }

      // OTP doesn't match
      console.log(`❌ Invalid OTP for phone: ${phone}. Expected: ${student.otp}, Received: ${otp}`);
      return res.status(400).json({ message: "Invalid OTP. Please check and try again." });
    }

    const student = rows[0];

    // Clear OTP after success
    await db.query("UPDATE students SET otp=NULL, otp_expire=NULL WHERE id=?", [
      student.id,
    ]);

    console.log(`✅ OTP verified successfully for phone: ${phone}`);

    const token = signToken({ id: student.id, role: "student" });

    res.json({
      token,
      user: {
        id: student.id,
        phone: student.phone,
        full_name: student.full_name,
        is_profile_complete: !!student.is_profile_complete,
      },
    });
  } catch (err) {
    console.error("❌ OTP verification error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});


/* --------------------
   3) Complete Profile
--------------------- */
router.post("/profile", async (req, res) => {
  const { studentId, full_name, grade, board, city } = req.body;

  if (!studentId || !full_name)
    return res
      .status(400)
      .json({ message: "studentId & full_name required" });

  try {
    await db.query(
      "UPDATE students SET full_name=?, grade=?, board=?, city=?, is_profile_complete=1 WHERE id=?",
      [full_name, grade || null, board || null, city || null, studentId]
    );

    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Profile update failed" });
  }
});

export default router;
