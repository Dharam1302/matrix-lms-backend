const express = require("express");
const router = express.Router();
const RackAssignment = require("../models/RackAssignment");
const Book = require("../models/Book");

router.get("/", async (req, res) => {
  try {
    const { isbn, isnn, library } = req.query;
    let query = {};
    if (isbn) query.isbn = isbn;
    if (isnn) query.isnn = isnn;
    if (library) query.library = library;
    const assignments = await RackAssignment.find(query);
    res.json(assignments);
  } catch (error) {
    console.error("Error in GET /api/rack-assignments:", error);
    res
      .status(500)
      .json({
        message: "Error fetching rack assignments",
        error: error.message,
      });
  }
});

router.post("/", async (req, res) => {
  try {
    const assignments = req.body;
    console.log(
      "Received payload for POST /api/rack-assignments:",
      JSON.stringify(assignments, null, 2)
    );

    if (!Array.isArray(assignments) || assignments.length === 0) {
      console.error("Validation failed: Assignments must be a non-empty array");
      return res
        .status(400)
        .json({ message: "Assignments must be a non-empty array" });
    }

    for (const assignment of assignments) {
      // Validate bookId exists in Book collection
      const book = await Book.findOne({ id: assignment.bookId });
      if (!book) {
        console.error(
          `Validation failed: Invalid bookId: ${assignment.bookId}`
        );
        return res
          .status(400)
          .json({ message: `Invalid bookId: ${assignment.bookId}` });
      }

      // Validate required fields
      const requiredFields = [
        "bookId",
        "title",
        "rack",
        "department",
        "library",
      ];
      const missingFields = requiredFields.filter(
        (field) => !assignment[field] && assignment[field] !== undefined
      );
      if (missingFields.length > 0) {
        console.error(
          `Validation failed: Missing required fields: ${missingFields.join(
            ", "
          )} for bookId: ${assignment.bookId}`
        );
        return res
          .status(400)
          .json({
            message: `Missing required fields: ${missingFields.join(", ")}`,
          });
      }

      // Validate data types
      if (typeof assignment.title !== "string") {
        console.error(
          `Validation failed: title must be a string for bookId: ${assignment.bookId}`
        );
        return res
          .status(400)
          .json({
            message: `title must be a string for bookId: ${assignment.bookId}`,
          });
      }
      if (assignment.isbn && typeof assignment.isbn !== "string") {
        console.error(
          `Validation failed: isbn must be a string for bookId: ${assignment.bookId}`
        );
        return res
          .status(400)
          .json({
            message: `isbn must be a string for bookId: ${assignment.bookId}`,
          });
      }
      if (assignment.isnn && typeof assignment.isnn !== "string") {
        console.error(
          `Validation failed: isnn must be a string for bookId: ${assignment.bookId}`
        );
        return res
          .status(400)
          .json({
            message: `isnn must be a string for bookId: ${assignment.bookId}`,
          });
      }
      if (!Array.isArray(assignment.categories)) {
        console.error(
          `Validation failed: categories must be an array for bookId: ${assignment.bookId}`
        );
        return res
          .status(400)
          .json({
            message: `categories must be an array for bookId: ${assignment.bookId}`,
          });
      }
    }

    const createdAssignments = await RackAssignment.insertMany(assignments);
    // Update Book documents' rack field
    for (const assignment of createdAssignments) {
      await Book.updateOne(
        { id: assignment.bookId },
        { rack: assignment.rack }
      );
    }
    console.log(
      "Successfully created assignments:",
      JSON.stringify(createdAssignments, null, 2)
    );
    res.status(201).json(createdAssignments);
  } catch (error) {
    console.error("Error in POST /api/rack-assignments:", error);
    res
      .status(400)
      .json({
        message: "Error creating rack assignments",
        error: error.message,
      });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const assignment = await RackAssignment.findById(req.params.id);
    if (!assignment) {
      console.error(
        `Validation failed: Rack assignment not found for id: ${req.params.id}`
      );
      return res.status(404).json({ message: "Rack assignment not found" });
    }
    await RackAssignment.findByIdAndDelete(req.params.id);
    // Update Book document's rack field
    await Book.updateOne({ id: assignment.bookId }, { rack: "N/A" });
    console.log(`Successfully deleted rack assignment: ${req.params.id}`);
    res.json({ message: "Rack assignment deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE /api/rack-assignments/:id:", error);
    res
      .status(500)
      .json({
        message: "Error deleting rack assignment",
        error: error.message,
      });
  }
});

module.exports = router;
