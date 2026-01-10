import { db } from "../db/connection.js";
import generateOTP from "../utils/generateOTP.js";

export const studentModel = {
  requestOTP: async ({ name, phone }) => {
    const otp = generateOTP();
    const expire = new Date(Date.now() + 2 * 60 * 1000);

    const [rows] = await db.query("SELECT * FROM students WHERE phone=?", [phone]);

    // Existing student → only update OTP
    if (rows.length > 0) {
      await db.query("UPDATE students SET otp=?, otp_expire=? WHERE phone=?", [
        otp,
        expire,
        phone,
      ]);
      return { type: "existing", otp };
    }

    // New student → requires name
    if (!name || name.trim() === "") {
      return { type: "need_name" };
    }

    // Create new student
    await db.query(
      "INSERT INTO students (name, phone, otp, otp_expire) VALUES (?, ?, ?, ?)",
      [name, phone, otp, expire]
    );

    return { type: "new", otp };
  },

  verifyOTP: async ({ phone, otp }) => {
    const [rows] = await db.query(
      "SELECT * FROM students WHERE phone=? AND otp=? AND otp_expire > NOW()",
      [phone, otp]
    );

    if (rows.length === 0) return null;

    await db.query("UPDATE students SET otp=null, otp_expire=null WHERE phone=?", [phone]);

    return rows[0];
  },
};
