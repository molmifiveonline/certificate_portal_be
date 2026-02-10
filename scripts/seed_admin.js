const db = require("../config/db");
const bcrypt = require("bcryptjs");

const seedAdmin = async () => {
  try {
    const email = "admin@molmi.com";
    const password = "admin123";
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if admin exists
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      console.log("Admin user already exists.");
      process.exit(0);
    }

    // Get Admin Role ID
    const [roles] = await db.query("SELECT id FROM roles WHERE name = 'admin'");
    if (roles.length === 0) {
      console.error("Admin role not found. Run migration first.");
      process.exit(1);
    }
    const roleId = roles[0].id;

    // Insert Admin
    await db.query(
      "INSERT INTO users (role_id, first_name, last_name, email, password, status) VALUES (?, ?, ?, ?, ?, ?)",
      [roleId, "Super", "Admin", email, hashedPassword, 1],
    );

    console.log(`Admin user created: ${email} / ${password}`);
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
