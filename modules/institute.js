import { db } from "../db/connection.js";
import generateOTP from "../utils/generateOTP.js";

export const instituteModel = {

  requestOTP: async (name, phone) => {
    const otp = generateOTP();
    const expire = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry (increased from 2 min)

    // Ensure OTP is stored as string
    await db.query(
      "INSERT INTO institutes (name, phone, otp, otp_expire) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=?, otp=?, otp_expire=?",
      [name, phone, String(otp), expire, name, String(otp), expire]
    );

    console.log(`✅ OTP ${otp} generated and stored for institute phone: ${phone}, expires at: ${expire}`);
    return otp;
  },

  verifyOTP: async (phone, otp) => {
    // Convert both to strings for comparison
    const receivedOtp = String(otp).trim();
    
    const [rows] = await db.query(
      "SELECT * FROM institutes WHERE phone=? AND otp_expire > NOW()",
      [phone]
    );

    if (!rows.length) {
      console.log(`❌ No valid OTP found for institute phone: ${phone}`);
      return null;
    }

    const institute = rows[0];
    const storedOtp = String(institute.otp).trim();

    if (storedOtp !== receivedOtp) {
      console.log(`❌ Invalid OTP for institute phone: ${phone}. Expected: ${storedOtp}, Received: ${receivedOtp}`);
      return null;
    }

    console.log(`✅ OTP verified successfully for institute phone: ${phone}`);
    return institute;
  }
};
