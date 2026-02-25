const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
const allowedOrigins = ["http://localhost:3000", "http://localhost:5173"];

if (process.env.FRONTEND_URL) {
  const urls = process.env.FRONTEND_URL.split(",").map((url) => url.trim());
  allowedOrigins.push(...urls);
}

app.use(
  cors({
    origin: function (origin, callback) {
      console.log("Incoming request origin:", origin);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

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

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/admin", permissionRoutes);
app.use("/api/trainer", trainerRoutes);
app.use("/api/log-history", logRoutes);
app.use("/api/hotel-details", hotelDetailRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/candidate", candidateRoutes);
app.use("/api/feedback-categories", feedbackCategoryRoutes);
app.use("/api/feedback-questions", feedbackQuestionRoutes);
app.use("/api/feedback-forms", feedbackFormRoutes);
app.use("/api/question-bank", questionBankRoutes);

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

// Certificates
const certificateRoutes = require("./routes/certificateRoutes");
app.use("/api/certificates", certificateRoutes);

// Static files
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API is running...");
});

// TEMPORARY: Check outbound IP of this server
app.get("/check-outbound-ip", async (req, res) => {
  try {
    const axios = require("axios");
    const response = await axios.get("https://api.ipify.org?format=json");
    res.json({ outboundIp: response.data.ip, inboundRequestIp: req.ip });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TEMPORARY: Test Azure Token API from this server
app.get("/test-azure-token", async (req, res) => {
  try {
    const axios = require("axios");
    const https = require("https");
    const params = new URLSearchParams();
    params.append("grant_type", "password");
    params.append("username", "apiuser@sbntech.com");
    params.append("Password", "u$eR@apI123");
    const response = await axios.post(
      "https://apim-mts-prod.azure-api.net/MOLMI-Training/api/Token",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Ocp-Apim-Subscription-Key": "d292c094732f423c8f5f7547aa98453a",
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      },
    );
    res.json({ success: true, tokenKeys: Object.keys(response.data) });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
  }
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
