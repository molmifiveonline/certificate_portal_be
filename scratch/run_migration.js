const db = require("../config/db");

const run = async () => {
  try {
    console.log("Creating user_otp_verifications table...");
    const query = `
      CREATE TABLE IF NOT EXISTS \`user_otp_verifications\` (
        \`id\` CHAR(36) NOT NULL,
        \`user_id\` CHAR(36) DEFAULT NULL,
        \`nominator_id\` CHAR(36) DEFAULT NULL,
        \`otp_hash\` VARCHAR(255) DEFAULT NULL,
        \`otp_expires_at\` DATETIME DEFAULT NULL,
        \`otp_attempts\` INT DEFAULT 0,
        \`device_trust_token\` VARCHAR(255) DEFAULT NULL,
        \`device_trust_expires_at\` DATETIME DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_user_id\` (\`user_id\`),
        KEY \`idx_nominator_id\` (\`nominator_id\`),
        KEY \`idx_device_trust_token\` (\`device_trust_token\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `;
    await db.query(query);
    console.log("Table user_otp_verifications created successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await db.end();
  }
};

run();
