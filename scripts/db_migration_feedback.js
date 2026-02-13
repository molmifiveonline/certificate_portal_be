const db = require("../config/db");

const createFeedbackCategoriesTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS feedback_categories (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          status TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    await db.query(query);
    console.log("Table 'feedback_categories' created successfully.");
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    process.exit();
  }
};

createFeedbackCategoriesTable();
