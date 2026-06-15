const pool = require("../config/db");

async function migrate() {
  try {
    console.log("Starting database migration for master_course material links...");
    
    // Check if columns already exist
    const [columns] = await pool.query("SHOW COLUMNS FROM master_course");
    const columnNames = columns.map(c => c.Field);
    
    if (!columnNames.includes("trainer_material_link")) {
      console.log("Adding new material link columns...");
      await pool.query(`
        ALTER TABLE master_course
        ADD COLUMN trainer_material_link TEXT DEFAULT NULL AFTER remarks,
        ADD COLUMN candidate_material_link TEXT DEFAULT NULL AFTER trainer_material_link,
        ADD COLUMN study_material_link TEXT DEFAULT NULL AFTER candidate_material_link
      `);
    } else {
      console.log("New material link columns already exist.");
    }
    
    if (columnNames.includes("material_link")) {
      console.log("Migrating existing material_link data to candidate_material_link...");
      await pool.query(`
        UPDATE master_course SET candidate_material_link = material_link
      `);
      
      console.log("Dropping old material_link column...");
      await pool.query(`
        ALTER TABLE master_course DROP COLUMN material_link
      `);
    } else {
      console.log("Old material_link column already dropped.");
    }
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

migrate();
