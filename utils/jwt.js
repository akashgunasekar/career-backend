import jwt from "jsonwebtoken";

export function signToken(payload) {
  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.SECRET_KEY);
  } catch (err) {
    return null;
  }
}
