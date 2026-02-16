require("dotenv").config();
const mysql = require("mysql2/promise");

async function testConnection(host) {
  console.log(`Testing connection to ${host}...`);
  try {
    const connection = await mysql.createConnection({
      host: host,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
    });
    console.log(`Successfully connected to ${host}!`);
    await connection.end();
    return true;
  } catch (error) {
    console.error(`Failed to connect to ${host}:`, error.message);
    return false;
  }
}

(async () => {
  console.log("--- Starting DB Connection Diagnostics ---");
  const resultLocalhost = await testConnection("localhost");
  const resultIP = await testConnection("127.0.0.1");

  if (!resultLocalhost && resultIP) {
    console.log(
      '\nDIAGNOSIS: "localhost" failed but "127.0.0.1" worked. Node.js might be resolving localhost to IPv6 ::1 but MySQL is listening on IPv4.',
    );
  } else if (!resultLocalhost && !resultIP) {
    console.log(
      "\nDIAGNOSIS: Both connections failed. MySQL service is likely NOT RUNNING or listening on a different port.",
    );
  }
})();
