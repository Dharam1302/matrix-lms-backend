const express = require("express");
const cors = require("cors");
const errorMiddleware = require("./middleware/error");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use("/api/auth", require("./routes/authRoutes"));

// Health check
app.get("/", (req, res) => res.send("Server is running"));

// Error handling
app.use(errorMiddleware);

module.exports = app;
