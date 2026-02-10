const db = require("../config/db");

const cleanupSchema = async () => {
  try {
    console.log("Cleaning up schema...");

    // Drop employee_id from users if it exists
    try {
      await db.query("ALTER TABLE users DROP COLUMN employee_id");
      console.log("Dropped 'employee_id' column from 'users' table.");
    } catch (err) {
      if (err.code === "ER_CANT_DROP_FIELD_OR_KEY") {
        console.log(
          "'employee_id' column does not exist in 'users' table. No action needed.",
        );
      } else {
        console.error("Error dropping column:", err.message);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
};

cleanupSchema();
