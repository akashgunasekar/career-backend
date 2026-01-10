import express from "express";
import { instituteModel } from "../modules/institute.js";

const router = express.Router();

// Request OTP
router.post("/request-otp", async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone)
      return res.status(400).json({ message: "Name and phone required" });

    const otp = await instituteModel.requestOTP(name, phone);

    res.json({ message: "OTP sent successfully", otp }); // remove otp in prod
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp)
      return res.status(400).json({ message: "Phone and OTP required" });

    const institute = await instituteModel.verifyOTP(phone, otp);

    if (!institute)
      return res.status(401).json({ message: "Invalid or expired OTP ❌" });

    res.json({ message: "Institute login success 🎉", institute });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
