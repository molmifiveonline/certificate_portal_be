const db = require("./config/db");

const run = async () => {
  try {
    console.log("Creating study_materials table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`study_materials\` (
        \`id\` CHAR(36) NOT NULL,
        \`master_course_id\` CHAR(36) NOT NULL,
        \`category\` VARCHAR(255) NOT NULL,
        \`user_type\` VARCHAR(20) NOT NULL,
        \`access_type\` VARCHAR(20) NOT NULL DEFAULT 'view',
        \`status\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_master_course_id\` (\`master_course_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    
    console.log("Creating study_material_files table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`study_material_files\` (
        \`id\` CHAR(36) NOT NULL,
        \`study_material_id\` CHAR(36) NOT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_original_name\` VARCHAR(255) NOT NULL,
        \`display_name\` VARCHAR(255) NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_study_material_id\` (\`study_material_id\`),
        CONSTRAINT \`fk_sm_files_material\` FOREIGN KEY (\`study_material_id\`)
          REFERENCES \`study_materials\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("Tables created successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating tables:", err);
    process.exit(1);
  }
};

run();
