const db = require("../config/db");

const createFeedbackQuestionsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS feedback_questions (
          id VARCHAR(36) PRIMARY KEY,
          category_id VARCHAR(36) NOT NULL,
          question TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'rating',
          status TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES feedback_categories(id) ON DELETE CASCADE
      );
    `;
    await db.query(query);
    console.log("Table 'feedback_questions' created successfully.");
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    process.exit();
  }
};

createFeedbackQuestionsTable();
