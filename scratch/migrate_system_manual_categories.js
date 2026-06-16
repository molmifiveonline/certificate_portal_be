const db = require("../config/db");

async function migrate() {
  console.log("Starting database migration for System Manual Categories...");
  try {
    // Drop existing table if any
    await db.query("DROP TABLE IF EXISTS `system_manual_categories`");
    console.log("Dropped existing table if any.");

    // Create categories table with matching collation
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`system_manual_categories\` (
        \`id\` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
        \`name\` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
        \`description\` TEXT COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        \`status\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.query(createTableQuery);
    console.log("Table 'system_manual_categories' created with correct collation.");

    // Check if column category_id already exists in system_manuals
    const [columns] = await db.query("SHOW COLUMNS FROM `system_manuals` LIKE 'category_id'");
    if (columns.length === 0) {
      const addColumnQuery = `
        ALTER TABLE \`system_manuals\`
        ADD COLUMN \`category_id\` VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL AFTER \`title\`,
        ADD CONSTRAINT \`fk_system_manuals_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`system_manual_categories\` (\`id\`) ON DELETE SET NULL;
      `;
      await db.query(addColumnQuery);
      console.log("Column 'category_id' and FK constraint added to 'system_manuals' successfully.");
    } else {
      console.log("Column 'category_id' already exists in 'system_manuals'.");
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
