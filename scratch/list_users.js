const db = require("../config/db");

const run = async () => {
  try {
    console.log("Listing first 10 users:");
    const [users] = await db.query("SELECT id, email, first_name, last_name, role_id, status FROM users LIMIT 10");
    console.table(users);

    console.log("Listing first 10 nominators:");
    const [nominators] = await db.query("SELECT id, email, name, status FROM nominators LIMIT 10");
    console.table(nominators);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.end();
  }
};

run();
