const express = require("express");
const router = express.Router();
const {
  checkIn,
  checkOut,
  transfer,
  getTodayLogs,
  getSeatAvailability,
} = require("../controllers/activityLogController");
const authMiddleware = require("../middleware/auth");
const restrictTo = require("../middleware/restrictTo");

// Protected routes (require authentication and admin role)
router.post("/check-in", authMiddleware, restrictTo(["admin"]), checkIn);
router.post("/check-out", authMiddleware, restrictTo(["admin"]), checkOut);
router.post("/transfer", authMiddleware, restrictTo(["admin"]), transfer);
router.get("/today", authMiddleware, restrictTo(["admin"]), getTodayLogs);

// Public route for seat availability
router.get("/seats", getSeatAvailability);

module.exports = router;
