import { verifyToken } from "../utils/jwt.js";

// Middleware to verify JWT token
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(401).json({ message: "Authentication failed" });
  }
};

// Middleware to check if user has specific role
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

// Combined middleware for admin routes
export const requireAdmin = [authenticate, requireRole("admin")];

// Combined middleware for student routes
export const requireStudent = [authenticate, requireRole("student")];

// Combined middleware for institute routes
export const requireInstitute = [authenticate, requireRole("institute")];
