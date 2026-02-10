const mysql = require("mysql2/promise");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, "../update_schema.sql"),
      "utf8",
    );
    console.log("Applying schema update...");
    await connection.query(sql);
    console.log("Schema update applied successfully.");
  } catch (error) {
    console.error("Error applying schema:", error.message);
  } finally {
    await connection.end();
  }
}

migrate();
