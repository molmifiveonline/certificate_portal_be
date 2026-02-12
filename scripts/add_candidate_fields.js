const db = require("../config/db");

async function migrate() {
  console.log("Starting migration...");

  const columns = [
    "ADD COLUMN designation VARCHAR(255)",
    "ADD COLUMN vessel_type VARCHAR(255)",
    "ADD COLUMN last_vessel_name VARCHAR(255)",
    "ADD COLUMN next_vessel_name VARCHAR(255)",
    "ADD COLUMN manning_company VARCHAR(255)",
    "ADD COLUMN sign_on_date DATE",
    "ADD COLUMN sign_off_date DATE",
    "ADD COLUMN officer VARCHAR(255)",
    "ADD COLUMN seaman_book_no VARCHAR(255)",
    "ADD COLUMN profile_image VARCHAR(1024)",
  ];

  for (const col of columns) {
    try {
      await db.query(`ALTER TABLE candidate_profiles ${col}`);
      console.log(`Success: ${col}`);
    } catch (error) {
      if (error.code === "ER_DUP_FIELDNAME") {
        console.log(`Skipping (Exists): ${col}`);
      } else {
        console.error(`Failed: ${col} - ${error.message}`);
      }
    }
  }

  process.exit();
}

migrate();
