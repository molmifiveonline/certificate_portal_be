const db = require("../config/db");

const run = async () => {
  try {
    console.log("Searching for 'tirth' in users...");
    const [usersTirth] = await db.query("SELECT id, email, first_name, status FROM users WHERE email LIKE '%tirth%'");
    console.log("Users:", usersTirth);

    console.log("Searching for 'admin' in users...");
    const [usersAdmin] = await db.query("SELECT id, email, first_name, status FROM users WHERE email LIKE '%admin%'");
    console.log("Users:", usersAdmin);

    console.log("Searching for 'trainer' in users...");
    const [usersTrainer] = await db.query("SELECT id, email, first_name, status FROM users WHERE email LIKE '%trainer%'");
    console.log("Users:", usersTrainer);

    console.log("Searching for 'creativegalileo' in nominators...");
    const [nominators] = await db.query("SELECT id, email, name, status FROM nominators WHERE email LIKE '%creativegalileo%'");
    console.log("Nominators:", nominators);

    console.log("Searching for 'amalvaniya' in nominators...");
    const [nominatorsAmal] = await db.query("SELECT id, email, name, status FROM nominators WHERE email LIKE '%amal%'");
    console.log("Nominators:", nominatorsAmal);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.end();
  }
};

run();
