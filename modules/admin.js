import { db } from "../db/connection.js";
import bcrypt from "bcryptjs";

export const adminModel = {

  login: async (username, password) => {
    const [rows] = await db.query("SELECT * FROM admin WHERE username=?", [username]);
    if (!rows.length) return null;

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password);

    return match ? admin : null;
  }
};
