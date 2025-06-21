const mongoose = require("mongoose");

const rackAssignmentSchema = new mongoose.Schema(
  {
    bookId: { type: String, required: true }, // Matches Book.id (e.g., B<timestamp>-<isbn>)
    title: { type: String, required: true },
    isbn: { type: String }, // Optional, for books
    isnn: { type: String }, // Optional, for journals
    author: { type: String, required: true },
    categories: [{ type: String }], // Array from Book schema
    publishedDate: { type: String }, // String from Book schema
    rack: { type: String, required: true },
    department: { type: String, required: true },
    library: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RackAssignment", rackAssignmentSchema);
