const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const fs = require("fs");

async function createLogsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, "create_logs_table.sql"),
      "utf8",
    );
    console.log("Creating logs table...");
    await connection.query(sql);
    console.log("Logs table created successfully.");
  } catch (error) {
    console.error("Error creating logs table:", error.message);
  } finally {
    await connection.end();
  }
}

createLogsTable();
