  const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const insertDummyData = async () => {
  try {
    // 1. Check if a category exists, if not create one
    const [categories] = await db.query(
      "SELECT * FROM feedback_categories LIMIT 1",
    );
    let categoryId;

    if (categories.length === 0) {
      categoryId = uuidv4();
      await db.query(
        `
        INSERT INTO feedback_categories (id, name, description, status)
        VALUES (?, 'General Feedback', '<p>General feedback for the system.</p>', 1)
      `,
        [categoryId],
      );
      console.log("Created dummy category: General Feedback");
    } else {
      categoryId = categories[0].id;
      console.log("Using existing category:", categories[0].name);
    }

    // 2. Insert dummy question
    const questionId = uuidv4();
    await db.query(
      `
      INSERT INTO feedback_questions (id, category_id, question, type, status)
      VALUES (?, ?, '<p>How would you rate your overall experience?</p>', 'rating', 1)
    `,
      [questionId, categoryId],
    );
    console.log(
      "Created dummy question: How would you rate your overall experience?",
    );
  } catch (error) {
    console.error("Error inserting dummy data:", error);
  } finally {
    process.exit();
  }
};

insertDummyData();
