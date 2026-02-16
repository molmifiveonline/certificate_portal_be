const db = require("./config/db");

async function checkRegistrationTypes() {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT registration_type FROM candidate_profiles",
    );
    console.log("Distinct Registration Types:", rows);
    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkRegistrationTypes();
