const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const db = require("./config/db");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require("./routes/authRoutes");
const menuRoutes = require("./routes/menuRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const trainerRoutes = require("./routes/trainerRoutes");
const logRoutes = require("./routes/logRoutes");
const hotelDetailRoutes = require("./routes/hotelDetailRoutes");
const locationRoutes = require("./routes/locationRoutes");
const candidateRoutes = require("./routes/candidateRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/admin", permissionRoutes);
app.use("/api/trainer", trainerRoutes);
app.use("/api/log-history", logRoutes);
app.use("/api/hotel-details", hotelDetailRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/candidate", candidateRoutes);

// Static files
const path = require("path");
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
