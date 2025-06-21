const bcrypt = require("bcryptjs");

async function verifyPassword(plaintext, hash) {
  const isMatch = await bcrypt.compare(plaintext, hash);
  console.log(`Password "${plaintext}" matches hash "${hash}": ${isMatch}`);
}

// Test admin password
verifyPassword(
  "admin123",
  "$2a$12$I78.Dk5mWdfCSJOGSh8kWOJgr4FVsVHtM7u/88NW6NTUiHGdmVqFq"
);

// Test student password
verifyPassword(
  "student123",
  "$2a$12$eeNct6Un1ltVeUByLoln8uqzFKgHG3qn3E1/JgB/ACd5h6pV91YnS"
);
