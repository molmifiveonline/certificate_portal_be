const mysql = require("mysql2/promise");
require("dotenv").config();

const { ensureTrainerRolePermissions } = require("./trainerRolePermissions");

function isDryRun() {
  const args = process.argv.slice(2);
  return args.includes("--dry-run") || !args.includes("--apply");
}

function dbConfig() {
  return {
    host: process.env.TARGET_DB_HOST || process.env.DB_HOST,
    user: process.env.TARGET_DB_USER || process.env.DB_USER,
    password: process.env.TARGET_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.TARGET_DB_NAME || process.env.DB_NAME,
    port: Number(process.env.TARGET_DB_PORT || process.env.DB_PORT || 3306),
  };
}

async function main() {
  const dryRun = isDryRun();
  const connection = await mysql.createConnection(dbConfig());

  try {
    const result = await ensureTrainerRolePermissions(connection, { dryRun });

    if (result.missingRole) {
      throw new Error("Trainer role not found. Seed roles before assigning permissions.");
    }

    console.log(
      JSON.stringify(
        {
          mode: dryRun ? "dry-run" : "apply",
          trainer_role_id: result.trainerRoleId,
          ensured_permissions: result.ensuredPermissions,
          assigned_permissions: result.assignedPermissions,
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
