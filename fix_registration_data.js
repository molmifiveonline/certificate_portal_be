const db = require("./config/db");

async function fixRegistrationTypes() {
  try {
    // Fix 1: Update 'Other' to 'Others'
    await db.query(`
      UPDATE candidate_profiles 
      SET registration_type = 'Others' 
      WHERE registration_type = 'Other'
    `);

    // Fix 2: Update NULL or Empty to 'Others' (or handle as needed, but 'Others' is safe default for now if they aren't MOLMI)
    // Note: Assuming if not explicitly 'MOLMI Employee', they should be 'Others' for now to be visible.
    await db.query(`
      UPDATE candidate_profiles 
      SET registration_type = 'Others' 
      WHERE registration_type IS NULL OR registration_type = ''
    `);

    console.log("Registration types fixed.");
    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixRegistrationTypes();
