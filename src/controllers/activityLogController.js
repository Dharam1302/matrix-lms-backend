const Student = require("../models/Student");
const ActivityLog = require("../models/ActivityLog");
const asyncHandler = require("express-async-handler");

const sectionSeatLimits = {
  central: 450,
  reference: 300,
  reading: 400,
  elibrary: 100,
};

// Check-in a student
const checkIn = asyncHandler(async (req, res) => {
  const { rollNumber, section } = req.body;
  if (!rollNumber || !section) {
    res.status(400);
    throw new Error("Roll number and section are required");
  }

  console.log(`Checking in: rollNumber=${rollNumber}, section=${section}`);

  const student = await Student.findOne({
    rollNumber: { $regex: `^${rollNumber}$`, $options: "i" },
  });
  if (!student) {
    console.log(`Student not found: ${rollNumber}`);
    res.status(404);
    throw new Error("Student not found");
  }

  const today = new Date().toISOString().split("T")[0];
  const activeLog = await ActivityLog.findOne({
    rollNumber: { $regex: `^${rollNumber}$`, $options: "i" },
    date: today,
    timeOut: null,
    status: "Checked In",
  });

  if (activeLog) {
    console.log(
      `Active log found: ${activeLog.section}, rollNumber=${rollNumber}`
    );
    res.status(400);
    throw new Error(`Student is already checked in to ${activeLog.section}`);
  }

  const now = new Date();
  const currentTime = now.toLocaleTimeString("en-IN", { hour12: false });
  let sectionLabel = section;
  let isStudySection = false;
  let seatSection = section; // For seat limit check

  if (section === "reference") {
    const isAfter430 =
      now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 30);
    sectionLabel = isAfter430 ? "Reference - Study Section" : "Reference";
    isStudySection = isAfter430;
    seatSection = "reference"; // Map to reference for seat counts
  } else if (section === "central") {
    sectionLabel = "Central Library";
    seatSection = "central";
  } else if (section === "reading") {
    sectionLabel = "Reading Room";
    seatSection = "reading";
  } else if (section === "elibrary") {
    sectionLabel = "E-Library";
    seatSection = "elibrary";
  } else {
    console.log(`Invalid section: ${section}`);
    res.status(400);
    throw new Error("Invalid section");
  }

  // Count active check-ins for the seat section
  const activeCheckIns = await ActivityLog.countDocuments({
    $or: [
      { section: sectionLabel },
      { section: { $in: ["Reference", "Reference - Study Section"] } }, // Include both for reference
    ],
    date: today,
    timeOut: null,
    status: "Checked In",
  });

  if (activeCheckIns >= sectionSeatLimits[seatSection]) {
    console.log(
      `No seats available in ${sectionLabel}: ${activeCheckIns}/${sectionSeatLimits[seatSection]}`
    );
    res.status(400);
    throw new Error(`No seats available in ${sectionLabel}`);
  }

  const log = new ActivityLog({
    rollNumber: student.rollNumber,
    name: student.name,
    branch: student.branch,
    section: sectionLabel,
    isStudySection,
    timeIn: currentTime,
    date: today,
    status: "Checked In",
  });

  await log.save();
  console.log(
    `Check-in saved: ${log._id}, rollNumber=${rollNumber}, section=${sectionLabel}, seatSection=${seatSection}`
  );
  res.status(201).json(log);
});

// Check-out a student
const checkOut = asyncHandler(async (req, res) => {
  const { rollNumber, section } = req.body;
  if (!rollNumber || !section) {
    res.status(400);
    throw new Error("Roll number and section are required");
  }

  console.log(`Checking out: rollNumber=${rollNumber}, section=${section}`);

  const student = await Student.findOne({
    rollNumber: { $regex: `^${rollNumber}$`, $options: "i" },
  });
  if (!student) {
    console.log(`Student not found: ${rollNumber}`);
    res.status(404);
    throw new Error("Student not found");
  }

  const today = new Date().toISOString().split("T")[0];
  let sectionLabel = section;
  let seatSection = section;

  if (section === "reference") {
    const now = new Date();
    const isAfter430 =
      now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 30);
    sectionLabel = isAfter430 ? "Reference - Study Section" : "Reference";
    seatSection = "reference";
  } else if (section === "central") {
    sectionLabel = "Central Library";
    seatSection = "central";
  } else if (section === "reading") {
    sectionLabel = "Reading Room";
    seatSection = "reading";
  } else if (section === "elibrary") {
    sectionLabel = "E-Library";
    seatSection = "elibrary";
  } else {
    console.log(`Invalid section: ${section}`);
    res.status(400);
    throw new Error("Invalid section");
  }

  const activeLog = await ActivityLog.findOne({
    rollNumber: { $regex: `^${rollNumber}$`, $options: "i" },
    date: today,
    section: sectionLabel,
    timeOut: null,
    status: "Checked In",
  });

  if (!activeLog) {
    console.log(
      `No active check-in found: rollNumber=${rollNumber}, section=${sectionLabel}`
    );
    res.status(400);
    throw new Error(
      "No active check-in found for this student in the specified section"
    );
  }

  const currentTime = new Date().toLocaleTimeString("en-IN", { hour12: false });
  const checkInTime = new Date(`${today} ${activeLog.timeIn}`);
  const checkOutTime = new Date(`${today} ${currentTime}`);
  const durationMs = checkOutTime - checkInTime;
  const duration = `${Math.floor(durationMs / 3600000)}h ${Math.floor(
    (durationMs % 3600000) / 60000
  )}m`;

  activeLog.timeOut = currentTime;
  activeLog.status = "Checked Out";
  activeLog.duration = duration;

  await activeLog.save();
  console.log(
    `Check-out saved: ${activeLog._id}, rollNumber=${rollNumber}, section=${sectionLabel}, seatSection=${seatSection}`
  );
  res.json(activeLog);
});

// Transfer a student's section
const transfer = asyncHandler(async (req, res) => {
  const { rollNumber, fromSection, toSection, isStudySection } = req.body;
  if (!rollNumber || !fromSection || !toSection) {
    res.status(400);
    throw new Error("Roll number, fromSection, and toSection are required");
  }

  console.log(
    `Transferring: rollNumber=${rollNumber}, from=${fromSection}, to=${toSection}`
  );

  const student = await Student.findOne({
    rollNumber: { $regex: `^${rollNumber}$`, $options: "i" },
  });
  if (!student) {
    console.log(`Student not found: ${rollNumber}`);
    res.status(404);
    throw new Error("Student not found");
  }

  const today = new Date().toISOString().split("T")[0];
  let fromSectionLabel = fromSection;
  let fromSeatSection = fromSection;

  if (fromSection === "reference") {
    fromSectionLabel = "Reference";
    fromSeatSection = "reference";
  } else if (fromSection === "central") {
    fromSectionLabel = "Central Library";
    fromSeatSection = "central";
  } else if (fromSection === "reading") {
    fromSectionLabel = "Reading Room";
    fromSeatSection = "reading";
  } else if (fromSection === "elibrary") {
    fromSectionLabel = "E-Library";
    fromSeatSection = "elibrary";
  }

  const activeLog = await ActivityLog.findOne({
    rollNumber: { $regex: `^${rollNumber}$`, $options: "i" },
    date: today,
    section: fromSectionLabel,
    timeOut: null,
    status: "Checked In",
  });

  if (!activeLog) {
    console.log(
      `No active check-in found: rollNumber=${rollNumber}, section=${fromSectionLabel}`
    );
    res.status(400);
    throw new Error(
      `No active check-in found for ${rollNumber} in ${fromSectionLabel}`
    );
  }

  let toSectionLabel = toSection;
  let toSeatSection = toSection;

  if (toSection === "reference") {
    toSectionLabel = isStudySection ? "Reference - Study Section" : "Reference";
    toSeatSection = "reference";
  } else if (toSection === "central") {
    toSectionLabel = "Central Library";
    toSeatSection = "central";
  } else if (toSection === "reading") {
    toSectionLabel = "Reading Room";
    toSeatSection = "reading";
  } else if (toSection === "elibrary") {
    toSectionLabel = "E-Library";
    toSeatSection = "elibrary";
  }

  // Check seat availability in the target section
  const activeCheckIns = await ActivityLog.countDocuments({
    $or: [
      { section: toSectionLabel },
      {
        section: { $in: ["Reference", "Reference - Study Section"] },
      },
    ],
    date: today,
    timeOut: null,
    status: "Checked In",
  });

  if (activeCheckIns >= sectionSeatLimits[toSeatSection]) {
    console.log(
      `No seats available in ${toSectionLabel}: ${activeCheckIns}/${sectionSeatLimits[toSeatSection]}`
    );
    res.status(400);
    throw new Error(`No seats available in ${toSectionLabel}`);
  }

  activeLog.section = toSectionLabel;
  activeLog.isStudySection = isStudySection || false;

  await activeLog.save();
  console.log(
    `Transfer saved: ${activeLog._id}, rollNumber=${rollNumber}, newSection=${toSectionLabel}, seatSection=${toSeatSection}`
  );
  res.json(activeLog);
});

// Get today's activity logs
const getTodayLogs = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const logs = await ActivityLog.find({ date: today }).sort({ createdAt: -1 });
  console.log(`Fetched ${logs.length} logs for today: ${today}`);
  res.json(logs);
});

// Get seat availability
const getSeatAvailability = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  console.log(`Fetching seat availability for date: ${today}`);

  const logs = await ActivityLog.find({
    date: today,
    timeOut: null,
    status: "Checked In",
  });

  console.log(`Found ${logs.length} active logs for today`);

  const occupiedBySection = {};

  // Initialize counts
  ["central", "reference", "reading", "elibrary"].forEach((key) => {
    occupiedBySection[key] = 0;
  });

  // Count active logs per section
  logs.forEach((log) => {
    let sectionKey;
    if (["Reference", "Reference - Study Section"].includes(log.section)) {
      sectionKey = "reference";
    } else if (log.section === "Central Library") {
      sectionKey = "central";
    } else if (log.section === "Reading Room") {
      sectionKey = "reading";
    } else if (log.section === "E-Library") {
      sectionKey = "elibrary";
    }
    if (sectionKey) {
      occupiedBySection[sectionKey]++;
    }
  });

  const availability = {
    central: {
      total: sectionSeatLimits.central,
      occupied: occupiedBySection.central || 0,
    },
    reference: {
      total: sectionSeatLimits.reference,
      occupied: occupiedBySection.reference || 0,
    },
    reading: {
      total: sectionSeatLimits.reading,
      occupied: occupiedBySection.reading || 0,
    },
    elibrary: {
      total: sectionSeatLimits.elibrary,
      occupied: occupiedBySection.elibrary || 0,
    },
  };

  console.log(`Seat availability: ${JSON.stringify(availability)}`);
  res.json(availability);
});

module.exports = {
  checkIn,
  checkOut,
  transfer,
  getTodayLogs,
  getSeatAvailability,
};
