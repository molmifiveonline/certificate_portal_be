const db = require("./config/db");

async function addMaterialLinkColumn() {
  try {
    // Check if column exists
    const [columns] = await db.query(
      "SHOW COLUMNS FROM master_course LIKE 'material_link'",
    );
    if (columns.length === 0) {
      await db.query(
        "ALTER TABLE master_course ADD COLUMN material_link TEXT DEFAULT NULL AFTER remarks",
      );
      console.log("Column 'material_link' added successfully.");
    } else {
      console.log("Column 'material_link' already exists.");
    }
    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

addMaterialLinkColumn();
