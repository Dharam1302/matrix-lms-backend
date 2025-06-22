// MongoDB Shell Script for populating students and users

// Students Collection
db.students.insertMany([
  {
    sNo: "S001",
    rollNumber: "20MCA001",
    name: "Rahul Kumar",
    branch: "MCA",
    college: "MITS",
    email: "rahul.kumar@mits.ac.in",
    year: "2nd"
  },
  {
    sNo: "S002",
    rollNumber: "20MCA002",
    name: "Priya Singh",
    branch: "MCA",
    college: "MITS",
    email: "priya.singh@mits.ac.in",
    year: "2nd"
  },
  {
    sNo: "S003",
    rollNumber: "20MCA003",
    name: "Amit Patel",
    branch: "MCA",
    college: "MITS",
    email: "amit.patel@mits.ac.in",
    year: "2nd"
  },
  {
    sNo: "S004",
    rollNumber: "21MCA001",
    name: "Sneha Gupta",
    branch: "MCA",
    college: "MITS",
    email: "sneha.gupta@mits.ac.in",
    year: "1st"
  },
  {
    sNo: "S005",
    rollNumber: "21MCA002",
    name: "Mohammed Ali",
    branch: "MCA",
    college: "MITS",
    email: "mohammed.ali@mits.ac.in",
    year: "1st"
  }
]);

// Users Collection (with hashed passwords)
// Note: Password for all users is 'password123'
// The hash below is generated using bcrypt with salt round 10
db.users.insertMany([
  {
    email: "admin@mits.ac.in",
    // hashed version of 'password123'
    password: "$2a$10$6Ybp.ZB0RhP1U0HFr9PUb.0yjvf1UqnNY.cvhpBCZGtizHsqYcQYi",
    role: "admin",
    name: "Admin User",
    createdAt: new Date()
  },
  {
    email: "rahul.kumar@mits.ac.in",
    password: "$2a$10$6Ybp.ZB0RhP1U0HFr9PUb.0yjvf1UqnNY.cvhpBCZGtizHsqYcQYi",
    role: "student",
    name: "Rahul Kumar",
    createdAt: new Date()
  },
  {
    email: "priya.singh@mits.ac.in",
    password: "$2a$10$6Ybp.ZB0RhP1U0HFr9PUb.0yjvf1UqnNY.cvhpBCZGtizHsqYcQYi",
    role: "student",
    name: "Priya Singh",
    createdAt: new Date()
  }
]); 