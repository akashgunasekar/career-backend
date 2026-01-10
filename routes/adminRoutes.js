import express from "express";
import jwt from "jsonwebtoken";
import { adminModel } from "../modules/admin.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const admin = await adminModel.login(username, password);

  if (!admin)
    return res.status(401).json({ message: "Invalid credentials" });

  // Generate token
  const token = jwt.sign(
    { id: admin.id, role: "admin" },
    process.env.SECRET_KEY,
    { expiresIn: "1d" }
  );

  // 🔥 IMPORTANT: this matches frontend AuthContext format
  res.json({
    token,
    admin: {
      id: admin.id,
      name: admin.name || username,
    },
  });
});

export default router;
