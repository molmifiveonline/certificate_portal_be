const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
const allowedOrigins = [
  "http://localhost:3000",
  "https://molmi.fiveonline.in",
  "http://localhost:3001",
  "http://molmicertificatestaging-frontend-jw0yao-743c18-72-62-229-205.traefik.me",
];

if (process.env.FRONTEND_URL) {
  const urls = process.env.FRONTEND_URL.split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  allowedOrigins.push(...urls);
}

console.log("Allowed CORS origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      console.log("Incoming request origin:", origin);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        console.log("Allowed origins are:", allowedOrigins);
        callback(new Error("Not allowed by CORS"));
      }
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json());

const activityLogger = require("./middleware/activityLogger");
app.use(activityLogger);

// Routes
const authRoutes = require("./routes/authRoutes");
const menuRoutes = require("./routes/menuRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const trainerRoutes = require("./routes/trainerRoutes");
const logRoutes = require("./routes/logRoutes");
const hotelDetailRoutes = require("./routes/hotelDetailRoutes");
const locationRoutes = require("./routes/locationRoutes");
const candidateRoutes = require("./routes/candidateRoutes");
const feedbackCategoryRoutes = require("./routes/feedbackCategoryRoutes");
const feedbackQuestionRoutes = require("./routes/feedbackQuestionRoutes");
const feedbackFormRoutes = require("./routes/feedbackFormRoutes");
const questionBankRoutes = require("./routes/questionBankRoutes");
const systemManualRoutes = require("./routes/systemManualRoutes");
const systemManualCategoryRoutes = require("./routes/systemManualCategoryRoutes");
const adminUserRoutes = require("./routes/admin/adminUserRoutes");
const adminRoleRoutes = require("./routes/adminRoleRoutes");
const reimbursementRoutes = require("./routes/reimbursementRoutes");
const adminReimbursementRoutes = require("./routes/admin/reimbursementRoutes");
const adminNotificationRoutes = require("./routes/admin/notificationRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/admin", permissionRoutes);
app.use("/api/admin-roles", adminRoleRoutes);
app.use("/api/trainer", trainerRoutes);
app.use("/api/log-history", logRoutes);
app.use("/api/hotel-details", hotelDetailRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/candidate", candidateRoutes);
app.use("/api/feedback-categories", feedbackCategoryRoutes);
app.use("/api/feedback-questions", feedbackQuestionRoutes);
app.use("/api/feedback-forms", feedbackFormRoutes);
app.use("/api/question-bank", questionBankRoutes);
app.use("/api/system-manual", systemManualRoutes);
app.use("/api/system-manual-categories", systemManualCategoryRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/reimbursements", reimbursementRoutes);
app.use("/api/admin/reimbursements", adminReimbursementRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);

// Dummy Seeder Route for Testing
app.use("/api/seed", require("./routes/seedRoutes"));

// Assessment
const assessmentRoutes = require("./routes/assessmentRoutes");
app.use("/api/assessment", assessmentRoutes);

// Feedback Answers
const feedbackAnswerRoutes = require("./routes/feedbackAnswerRoutes");
app.use("/api/feedback-answers", feedbackAnswerRoutes);

// Master Courses
const masterCourseRoutes = require("./routes/masterCourseRoutes");
app.use("/api/master-courses", masterCourseRoutes);

// Active Courses
const activeCourseRoutes = require("./routes/activeCourseRoutes");
app.use("/api/active-courses", activeCourseRoutes);

// Dashboard
const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

// Reports
const reportRoutes = require("./routes/admin/reportRoutes");
app.use("/api/reports", reportRoutes);

// Nominators
const nominatorRoutes = require("./routes/nominatorRoutes");
app.use("/api/nominators", nominatorRoutes);

// Pre-Active Courses
const preActiveCourseRoutes = require("./routes/preActiveCourseRoutes");
app.use("/api/pre-active", preActiveCourseRoutes);

// Outhouse Courses
const outhouseCourseRoutes = require("./routes/outhouseCourseRoutes");
app.use("/api/outhouse-courses", outhouseCourseRoutes);

// Certificates
const certificateRoutes = require("./routes/certificateRoutes");
app.use("/api/certificates", certificateRoutes);

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS solution");
    res.json({
      message: "Database connected successfully",
      solution: rows[0].solution,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Database connection failed", error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
