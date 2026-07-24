const db = require("../config/db");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const run = async () => {
  try {
    console.log("Seeding test users...");

    // 1. Seed Nominator
    const nominatorEmail = "amalvaniya@creativegalileo.com";
    const nominatorPasswordHash = await bcrypt.hash("Agam@123", 10);
    const [existingNominators] = await db.query("SELECT id FROM nominators WHERE email = ?", [nominatorEmail]);
    
    if (existingNominators.length === 0) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO nominators (id, name, first_name, last_name, email, password, status)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [id, "Amal Vaniya", "Amal", "Vaniya", nominatorEmail, nominatorPasswordHash]
      );
      console.log("Seeded nominator: amalvaniya@creativegalileo.com");
    } else {
      await db.query("UPDATE nominators SET password = ?, status = 1 WHERE email = ?", [nominatorPasswordHash, nominatorEmail]);
      console.log("Updated nominator password: amalvaniya@creativegalileo.com");
    }

    // Roles map
    const [roles] = await db.query("SELECT * FROM roles");
    const roleMap = {};
    roles.forEach(r => {
      roleMap[r.name.toLowerCase()] = r.id;
    });

    // Helper to seed users
    const seedUser = async (email, password, first, last, roleName) => {
      const roleId = roleMap[roleName];
      if (!roleId) {
        console.error(`Role ${roleName} not found!`);
        return;
      }

      const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
      const passHash = await bcrypt.hash(password, 10);
      let userId;

      if (existing.length === 0) {
        userId = uuidv4();
        await db.query(
          `INSERT INTO users (id, role_id, first_name, last_name, email, password, status)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [userId, roleId, first, last, email, passHash]
        );
        console.log(`Seeded user: ${email} (${roleName})`);
      } else {
        userId = existing[0].id;
        await db.query("UPDATE users SET password = ?, status = 1, role_id = ? WHERE id = ?", [passHash, roleId, userId]);
        console.log(`Updated user: ${email} (${roleName})`);
      }

      if (roleName === "candidate") {
        const [profile] = await db.query("SELECT id FROM candidate_profiles WHERE user_id = ?", [userId]);
        if (profile.length === 0) {
          const profileId = uuidv4();
          await db.query(
            `INSERT INTO candidate_profiles (id, user_id, registration_type, middle_name, prefix, gender, dob, nationality, passport_no, employee_id, \`rank\`)
             VALUES (?, ?, 'Self', '', 'Mr.', 'Male', '1995-01-01', 'Indian', 'A1234567', 'EMP001', 'Seaman')`,
            [profileId, userId]
          );
          console.log(`Created candidate profile for ${email}`);
        }
      }
    };

    // 2. Seed Candidate
    await seedUser("tirthpatel456@gmail.com", "Tirth@123", "Tirth", "Patel", "candidate");

    // 3. Seed Trainer
    await seedUser("trainer@molmi.com", "trainer123", "Trainer", "User", "trainer");

    // 4. Seed Admin
    await seedUser("admin@molmi.com", "admin123", "Admin", "User", "admin");

    console.log("Seeding complete!");
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await db.end();
  }
};

run();
