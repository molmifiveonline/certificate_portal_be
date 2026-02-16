const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class FeedbackFormDao {
  static async create(data) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const { title, type_of_course, status, category_questions } = data;
      const formId = uuidv4();

      // 1. Insert Feedback Form
      await connection.query(
        "INSERT INTO feedback_forms (id, title, type_of_course, status) VALUES (?, ?, ?, ?)",
        [formId, title, type_of_course, status || 1],
      );

      // 2. Insert Questions and Options
      // category_questions structure: { categoryId: [ { question, type, options: [] } ] }

      for (const catId of Object.keys(category_questions)) {
        const questions = category_questions[catId];
        for (const q of questions) {
          const questionId = uuidv4();
          await connection.query(
            "INSERT INTO feedback_questions (id, category_id, question, type, status, feedback_form_id) VALUES (?, ?, ?, ?, ?, ?)",
            [questionId, catId, q.question, q.type, 1, formId],
          );

          if (q.options && q.options.length > 0) {
            for (const opt of q.options) {
              const optionId = uuidv4();
              await connection.query(
                "INSERT INTO feedback_question_options (id, feedback_question_id, option_text, status) VALUES (?, ?, ?, ?)",
                [optionId, questionId, opt, 1],
              );
            }
          }
        }
      }

      await connection.commit();
      return formId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getAll(filters = {}) {
    let query = "SELECT * FROM feedback_forms WHERE status = 1";
    const params = [];

    if (filters.search) {
      query += " AND title LIKE ?";
      params.push(`%${filters.search}%`);
    }

    query += " ORDER BY created_at DESC";

    // Pagination
    if (filters.page && filters.limit) {
      const page = Math.max(1, Number(filters.page));
      const limit = Number(filters.limit);
      const offset = (page - 1) * limit;
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const [rows] = await db.query(query, params);

    // Get total count
    const [countResult] = await db.query(
      "SELECT COUNT(*) as total FROM feedback_forms WHERE status = 1",
    );

    return {
      data: rows,
      total: countResult[0].total,
    };
  }

  static async getById(id) {
    const [forms] = await db.query(
      "SELECT * FROM feedback_forms WHERE id = ?",
      [id],
    );
    if (forms.length === 0) return null;

    const form = forms[0];

    // Get Questions
    const [questions] = await db.query(
      `SELECT fq.*, fc.name as category_name 
         FROM feedback_questions fq 
         JOIN feedback_categories fc ON fq.category_id = fc.id
         WHERE fq.feedback_form_id = ? AND fq.status = 1
         ORDER BY fq.created_at ASC`,
      [id],
    );

    // Get Options for these questions
    const questionIds = questions.map((q) => q.id);
    let options = [];
    if (questionIds.length > 0) {
      const [optRows] = await db.query(
        `SELECT * FROM feedback_question_options WHERE feedback_question_id IN (?) AND status = 1`,
        [questionIds],
      );
      options = optRows;
    }

    // Structure the data: Group by Category
    const structuredQuestions = {};

    questions.forEach((q) => {
      if (!structuredQuestions[q.category_id]) {
        structuredQuestions[q.category_id] = {
          category_name: q.category_name,
          questions: [],
        };
      }

      const qOptions = options
        .filter((o) => o.feedback_question_id === q.id)
        .map((o) => o.option_text);

      structuredQuestions[q.category_id].questions.push({
        id: q.id,
        question: q.question,
        type: q.type,
        options: qOptions,
      });
    });

    return { ...form, questions: structuredQuestions };
  }

  static async update(id, data) {
    // For simplicity in this complex structure, we often delete old questions and re-insert new ones
    // OR we implement complex diffing.
    // Following the PHP logic "deleteFromView", we will soft delete old questions/options and insert new ones.

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const { title, type_of_course, status, category_questions } = data;

      // 1. Update Form Details
      await connection.query(
        "UPDATE feedback_forms SET title = ?, type_of_course = ?, status = ? WHERE id = ?",
        [title, type_of_course, status, id],
      );

      // 2. Soft Delete Existing Questions/Options for this form
      // We can actually hard delete or soft delete. Let's soft delete.
      await connection.query(
        "UPDATE feedback_questions SET status = 0 WHERE feedback_form_id = ?",
        [id],
      );
      // We don't strictly need to update options status if we filter by question status, but for cleanliness:
      // (Skipping option update for performance/complexity balance, assume logic filters by active question)

      // 3. Insert New Questions
      for (const catId of Object.keys(category_questions)) {
        const questions = category_questions[catId];
        for (const q of questions) {
          const questionId = uuidv4();
          await connection.query(
            "INSERT INTO feedback_questions (id, category_id, question, type, status, feedback_form_id) VALUES (?, ?, ?, ?, ?, ?)",
            [questionId, catId, q.question, q.type, 1, id],
          );

          if (q.options && q.options.length > 0) {
            for (const opt of q.options) {
              const optionId = uuidv4();
              await connection.query(
                "INSERT INTO feedback_question_options (id, feedback_question_id, option_text, status) VALUES (?, ?, ?, ?)",
                [optionId, questionId, opt, 1],
              );
            }
          }
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async delete(id) {
    const [result] = await db.query(
      "UPDATE feedback_forms SET status = 0 WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = FeedbackFormDao;
