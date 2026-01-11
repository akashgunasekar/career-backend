import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import instituteRoutes from "./routes/instituteRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import careerRoutes from "./routes/careerRoutes.js";
import collegeRoutes from "./routes/collegeRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import adminStatsRoutes from "./routes/adminStatsRoutes.js";
import adminStudentsRoutes from "./routes/adminStudentsRoutes.js";
import adminCareersRoutes from "./routes/adminCareersRoutes.js";
import adminCollegesRoutes from "./routes/adminCollegesRoutes.js";
import adminCounselorsRoutes from "./routes/adminCounselorsRoutes.js";
import adminQuestionsRoutes from "./routes/adminQuestionsRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { db } from "./db/connection.js";

dotenv.config();

const app = express();

// JSON parser
app.use(express.json());

// ✅ CORS – THIS IS ENOUGH
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// ❌ REMOVE THIS LINE COMPLETELY
// app.options("*", cors());

// DB check
db.getConnection()
  .then(() => console.log("🔥 Database connected"))
  .catch((err) => console.log("❌ DB Error:", err));

// Health check
app.get("/", (req, res) => {
  res.send("🚀 Career Clarity API is working!");
});

// ROUTES
app.use("/api/student", studentRoutes);
app.use("/api/institute", instituteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/career", careerRoutes);
app.use("/api/college", collegeRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/admin/stats", adminStatsRoutes);
app.use("/api/admin/students", adminStudentsRoutes);
app.use("/api/admin/careers", adminCareersRoutes);
app.use("/api/admin/colleges", adminCollegesRoutes);
app.use("/api/admin/counselors", adminCounselorsRoutes);
app.use("/api/admin/questions", adminQuestionsRoutes);
app.use("/api/notifications", notificationRoutes);

// Error handler LAST
app.use(errorHandler);

// START SERVER
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});


// Old

// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";

// import instituteRoutes from "./routes/instituteRoutes.js";
// import adminRoutes from "./routes/adminRoutes.js";
// import studentRoutes from "./routes/studentRoutes.js";
// import testRoutes from "./routes/testRoutes.js";
// import careerRoutes from "./routes/careerRoutes.js";
// import collegeRoutes from "./routes/collegeRoutes.js";
// import bookingRoutes from "./routes/bookingRoutes.js";
// import adminStatsRoutes from "./routes/adminStatsRoutes.js";
// import adminStudentsRoutes from "./routes/adminStudentsRoutes.js";
// import adminCareersRoutes from "./routes/adminCareersRoutes.js";
// import adminCollegesRoutes from "./routes/adminCollegesRoutes.js";
// import adminCounselorsRoutes from "./routes/adminCounselorsRoutes.js";
// import adminQuestionsRoutes from "./routes/adminQuestionsRoutes.js";
// import notificationRoutes from "./routes/notificationRoutes.js";
// import { errorHandler } from "./middleware/errorHandler.js";

// import { db } from "./db/connection.js";

// dotenv.config();

// const app = express();

// const cors = require("cors");

// app.use(
//   cors({
//     origin: "*",
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//   })
// );

// // IMPORTANT: preflight support
// app.options("*", cors());


// app.use(express.json());

// // Database connection test
// db.getConnection()
//   .then(() => console.log("🔥 Database connected"))
//   .catch((err) => console.log("❌ DB Error:", err));

// app.get("/", (req, res) => {
//   res.send("🚀 Career Clarity API is working!");
// });

// // ROUTES
// app.use("/api/student", studentRoutes);
// app.use("/api/institute", instituteRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/api/tests", testRoutes);
// app.use("/api/career", careerRoutes);
// app.use("/api/college", collegeRoutes);
// app.use("/api/booking", bookingRoutes);
// app.use("/api/admin/stats", adminStatsRoutes);
// app.use("/api/admin/students", adminStudentsRoutes);
// app.use("/api/admin/careers", adminCareersRoutes);
// app.use("/api/admin/colleges", adminCollegesRoutes);
// app.use("/api/admin/counselors", adminCounselorsRoutes);
// app.use("/api/admin/questions", adminQuestionsRoutes);
// app.use("/api/notifications", notificationRoutes);

// // Error handling middleware (must be last)
// app.use(errorHandler);

// app.listen(process.env.PORT || 5001, () => console.log("Backend running on port", process.env.PORT || 5001, "🚀"));
