require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");
const bookRoutes = require("./src/routes/bookRoutes");
const rackRoutes = require("./src/routes/racks");
const rackAssignmentRoutes = require("./src/routes/rackAssignments");
const borrowRoutes = require("./src/routes/borrowRoutes");
const cors = require("cors");
app.use(cors({ origin: "http://localhost:3000" }));

const PORT = process.env.PORT || 5000;

// Mount routes
app.use("/api/books", bookRoutes);
app.use("/api/racks", rackRoutes);
app.use("/api/rack-assignments", rackAssignmentRoutes);
app.use("/api/borrow-records", borrowRoutes);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
