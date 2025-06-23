const Book = require("../models/Book");
const RackAssignment = require("../models/RackAssignment");
const axios = require("axios");

// Get books by query (supports isbn or isnn)
const getBooksByQuery = async (req, res) => {
  try {
    const { isbn, isnn } = req.query;
    let query = {};
    if (isbn) {
      query.isbn = isbn;
    } else if (isnn) {
      query.isnn = isnn;
    }
    const books = await Book.find(query);
    res.status(200).json(books);
  } catch (error) {
    console.error("Error in getBooksByQuery:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch book by Book.id field
const fetchBookById = async (req, res) => {
  try {
    const book = await Book.findOne({ id: req.params.id });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json(book);
  } catch (error) {
    console.error("Error in fetchBookById:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch book by ISBN (from Google Books and save to DB)
const fetchBookByISBN = async (req, res) => {
  const { isbn } = req.params;
  try {
    // Check if book exists in local DB
    let book = await Book.findOne({ isbn });
    if (book) {
      console.log(`Found book in DB for ISBN ${isbn}:`, book.id);
      return res.status(200).json(book);
    }

    // Fetch from Google Books
    console.log(`Fetching book from Google Books for ISBN ${isbn}`);
    const response = await axios.get(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    );
    if (response.data.totalItems === 0 || !response.data.items) {
      console.error(`No book found in Google Books for ISBN ${isbn}`);
      return res.status(404).json({ message: "Book not found" });
    }

    const bookData = response.data.items[0].volumeInfo;
    const formattedBook = {
      id: `B${Date.now()}-${isbn}`, // Custom id field, not _id
      title: bookData.title || "Untitled",
      author: bookData.authors?.join(", ") || "Unknown Author",
      isbn,
      publisher: bookData.publisher || "Unknown Publisher",
      publishedDate: bookData.publishedDate || "",
      description: bookData.description || "",
      pageCount: bookData.pageCount || 0,
      categories: bookData.categories || [],
      coverImage: bookData.imageLinks?.thumbnail || "",
      toc: bookData.tableOfContents || null,
      language: bookData.language || "en",
      type: "book",
      auditTrail: [
        {
          action: "Added (Book)",
          by: "Librarian",
          date: new Date(),
        },
      ],
    };

    // Check again to avoid race condition
    book = await Book.findOne({ isbn });
    if (book) {
      console.log(
        `Book already exists for ISBN ${isbn} (race condition):`,
        book.id
      );
      return res.status(200).json(book);
    }

    book = new Book(formattedBook);
    await book.save();
    console.log(`Saved book to DB for ISBN ${isbn}:`, book.id);
    res.status(200).json(book);
  } catch (error) {
    console.error(
      "Error fetching book from Google Books:",
      error.message,
      error.stack
    );
    res.status(500).json({ message: "Error fetching book data" });
  }
};

// Fetch journal by ISNN (from CrossRef and save to DB)
const fetchJournalByISNN = async (req, res) => {
  const { isnn } = req.params;
  try {
    // Check if journal exists in local DB
    let journal = await Book.findOne({ isnn });
    if (journal) {
      console.log(`Found journal in DB for ISNN ${isnn}:`, journal.id);
      return res.status(200).json(journal);
    }

    // Fetch from CrossRef
    console.log(`Fetching journal from CrossRef for ISNN ${isnn}`);
    const response = await axios.get(
      `https://api.crossref.org/journals/${isnn}`
    );
    if (!response.data.message || !response.data.message.title) {
      console.error(`No journal found in CrossRef for ISNN ${isnn}`);
      return res.status(404).json({ message: "Journal not found" });
    }

    const journalData = response.data.message;
    const formattedJournal = {
      id: `J${Date.now()}-${isnn}`,
      title: journalData.title || "Untitled",
      isnn,
      publisher: journalData.publisher || "Unknown Publisher",
      publishedDate: journalData.created?.["date-time"]?.split("T")[0] || "",
      description: journalData.description || "",
      coverImage: "",
      toc: null,
      language: "en",
      categories: ["Journal"],
      type: "journal",
      auditTrail: [
        {
          action: "Added (Journal)",
          by: "Librarian",
          date: new Date(),
        },
      ],
    };

    // Check again to avoid race condition
    journal = await Book.findOne({ isnn });
    if (journal) {
      console.log(
        `Journal already exists for ISNN ${isnn} (race condition):`,
        journal.id
      );
      return res.status(200).json(journal);
    }

    journal = new Book(formattedJournal);
    await journal.save();
    console.log(`Saved journal to DB for ISNN ${isnn}:`, journal.id);
    res.status(200).json(journal);
  } catch (error) {
    console.error(
      "Error fetching journal from CrossRef:",
      error.message,
      error.stack
    );
    res.status(500).json({ message: "Error fetching journal data" });
  }
};

// Add a new book
const addBook = async (req, res) => {
  try {
    const bookData = req.body;
    const { isbn, isnn, type } = bookData;

    // Generate unique ID
    const id = `${type === "journal" ? "J" : "B"}${Date.now()}-${isnn || isbn}`;
    bookData.id = id;

    // Ensure auditTrail is initialized
    bookData.auditTrail = [
      {
        action: `Added (${type === "journal" ? "Journal" : "Book"})`,
        by: "Librarian",
        date: new Date(),
      },
    ];

    const book = new Book(bookData);
    await book.save();
    console.log(`Saved book via addBook for ${isbn || isnn}:`, book.id);
    res.status(201).json(book);
  } catch (error) {
    console.error("Error adding book:", error.message, error.stack);
    res.status(500).json({ message: "Server error" });
  }
};

// Update a book
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating id, isbn, or isnn
    delete updates.id;
    delete updates.isbn;
    delete updates.isnn;

    // Add to audit trail
    updates.auditTrail = [
      ...((await Book.findOne({ id })?.auditTrail) || []),
      {
        action: "Updated",
        by: "Librarian",
        date: new Date(),
        details: `Updated fields: ${Object.keys(updates).join(", ")}`,
      },
    ];

    const book = await Book.findOneAndUpdate({ id }, updates, { new: true });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json(book);
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a book
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findOneAndDelete({ id });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json({ message: "Book deleted" });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Bulk update book status
const bulkUpdateStatus = async (req, res) => {
  try {
    const { bookIds, status } = req.body;
    if (!bookIds || !Array.isArray(bookIds) || !status) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const updatedBooks = await Book.updateMany(
      { id: { $in: bookIds } },
      {
        $set: { status },
        $push: {
          auditTrail: {
            action: "Status Updated (Bulk)",
            by: "Librarian",
            date: new Date(),
            details: `Status changed to ${status}`,
          },
        },
      },
      { new: true }
    );

    res
      .status(200)
      .json({ message: `Updated ${updatedBooks.nModified} books` });
  } catch (error) {
    console.error("Error bulk updating status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Export books
const exportBooks = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start and end dates required" });
    }

    const books = await Book.find({
      addedDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });

    res.status(200).json(books);
  } catch (error) {
    console.error("Error exporting books:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Search books with location information
const searchBooksWithLocation = async (req, res) => {
  try {
    const { query } = req.query;
    
    // Create search criteria
    const searchCriteria = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } },
        { isbn: { $regex: query, $options: 'i' } },
        { categories: { $in: [new RegExp(query, 'i')] } }
      ]
    };

    // First find matching books
    const books = await Book.find(searchCriteria)
      .select('id title author isbn status coverImage categories')
      .limit(6);

    // Get rack assignments for these books
    const bookIds = books.map(book => book.id);
    const rackAssignments = await RackAssignment.find({ bookId: { $in: bookIds } });

    // Create a map of book IDs to their rack assignments
    const rackMap = rackAssignments.reduce((map, assignment) => {
      map[assignment.bookId] = assignment;
      return map;
    }, {});

    // Format response
    const formattedBooks = books.map(book => ({
      id: book.id,
      title: book.title,
      authors: [book.author], // Convert to array to match frontend format
      thumbnail: book.coverImage,
      status: book.status,
      categories: book.categories,
      location: rackMap[book.id] ? {
        library: rackMap[book.id].library,
        department: rackMap[book.id].department,
        rack: rackMap[book.id].rack
      } : {
        library: 'Unassigned',
        department: 'N/A',
        rack: 'N/A'
      }
    }));

    res.status(200).json(formattedBooks);
  } catch (error) {
    console.error('Error in searchBooksWithLocation:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getBooksByQuery,
  fetchBookById,
  fetchBookByISBN,
  fetchJournalByISNN,
  addBook,
  updateBook,
  deleteBook,
  bulkUpdateStatus,
  exportBooks,
  searchBooksWithLocation
};
