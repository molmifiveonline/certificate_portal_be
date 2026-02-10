const db = require("../config/db");

const applySchema = async () => {
  try {
    console.log("Applying schema updates...");

    const queries = [
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT 3, id FROM permissions WHERE slug IN ('view_dashboard');`,

      `ALTER TABLE candidate_profiles
       ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100) AFTER user_id,
       ADD COLUMN IF NOT EXISTS prefix VARCHAR(20) AFTER user_id,
       ADD COLUMN IF NOT EXISTS gender VARCHAR(20) AFTER dob,
       ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100),
       ADD COLUMN IF NOT EXISTS manager VARCHAR(100),
       ADD COLUMN IF NOT EXISTS other_manager VARCHAR(100),
       ADD COLUMN IF NOT EXISTS rank VARCHAR(100),
       ADD COLUMN IF NOT EXISTS other_rank VARCHAR(100),
       ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20),
       ADD COLUMN IF NOT EXISTS alternate_mobile VARCHAR(20),
       ADD COLUMN IF NOT EXISTS indos_number VARCHAR(100),
       ADD COLUMN IF NOT EXISTS registration_type VARCHAR(50) COMMENT 'MOLMI Employee or Others';`,
    ];

    for (const query of queries) {
      try {
        await db.query(query);
        console.log("Query executed successfully");
      } catch (err) {
        // Ignore "Duplicate column name" errors
        if (err.code === "ER_DUP_FIELDNAME") {
          console.log("Column already exists, skipping.");
        } else {
          console.error("Error executing query:", err.message);
        }
      }
    }

    console.log("Schema updates applied.");
    process.exit(0);
  } catch (error) {
    console.error("Schema update failed:", error);
    process.exit(1);
  }
};

applySchema();
