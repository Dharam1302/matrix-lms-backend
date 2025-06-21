const express = require("express");
const cors = require("cors");
const errorMiddleware = require("./middleware/error");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", require("./routes/authRoutes"));

// Error handling
app.use(errorMiddleware);

module.exports = app;
