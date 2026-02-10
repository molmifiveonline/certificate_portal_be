const db = require("../config/db");

async function updateSchema() {
  const connection = await db.getConnection();
  try {
    console.log("Checking trainer_profiles table schema...");

    const [columns] = await connection.query(
      "SHOW COLUMNS FROM trainer_profiles",
    );
    const existingColumns = columns.map((c) => c.Field);

    const columnsToAdd = [
      { name: "prefix", type: "VARCHAR(10)" },
      { name: "officer", type: "VARCHAR(100)" },
      { name: "other_officer", type: "VARCHAR(100)" },
      { name: "designation", type: "VARCHAR(100)" },
      { name: "nationality", type: "VARCHAR(50)" },
      { name: "digital_signature", type: "VARCHAR(255)" },
      { name: "profile_photo", type: "VARCHAR(255)" },
      { name: "status", type: "TINYINT DEFAULT 1" },
    ];

    const alterStatements = [];

    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        alterStatements.push(`ADD COLUMN ${col.name} ${col.type}`);
      }
    }

    if (alterStatements.length > 0) {
      const sql = `ALTER TABLE trainer_profiles ${alterStatements.join(", ")}`;
      console.log("Executing:", sql);
      await connection.query(sql);
      console.log("Schema updated successfully!");
    } else {
      console.log("Schema is already up to date.");
    }
  } catch (error) {
    console.error("Error updating schema:", error);
  } finally {
    connection.release();
    process.exit();
  }
}

updateSchema();
