const bcrypt = require("bcryptjs");
const db = require("../config/db");

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

function hasArg(name) {
  return process.argv.includes(`--${name}`);
}

function roleList() {
  const roles = argValue("roles") || "candidate,trainer";
  return roles
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

async function main() {
  const email = argValue("email");
  const password = argValue("password");
  const dryRun = hasArg("dry-run");
  const legacyMigrated = hasArg("legacy-migrated");

  if (!password || (!email && !legacyMigrated)) {
    throw new Error(
      "Usage: node scripts/resetUserPassword.js --email=user@example.com --password=NewPassword OR --legacy-migrated --roles=candidate,trainer --password=NewPassword",
    );
  }

  if (legacyMigrated) {
    const roles = roleList();
    const placeholders = roles.map(() => "?").join(", ");
    const [rows] = await db.query(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       JOIN legacy_id_map lim ON lim.new_id = u.id
       WHERE lim.entity_type IN (${placeholders})`,
      roles,
    );

    if (dryRun) {
      console.log(
        `Would update ${rows[0].total} legacy-migrated users for roles: ${roles.join(", ")}`,
      );
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `UPDATE users u
       JOIN legacy_id_map lim ON lim.new_id = u.id
       SET u.password = ?
       WHERE lim.entity_type IN (${placeholders})`,
      [hashedPassword, ...roles],
    );
    console.log(
      `Password updated for ${result.affectedRows} legacy-migrated users for roles: ${roles.join(", ")}`,
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    "UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)",
    [hashedPassword, email],
  );

  if (result.affectedRows === 0) {
    throw new Error(`No user found for email: ${email}`);
  }

  console.log(`Password updated for ${email}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
