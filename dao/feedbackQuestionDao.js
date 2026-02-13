const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class FeedbackQuestionDao {
  static async create(questionData) {
    const { category_id, question, type } = questionData;
    const id = uuidv4();
    const query = `INSERT INTO feedback_questions (id, category_id, question, type) VALUES (?, ?, ?, ?)`;
    await db.query(query, [id, category_id, question, type || "rating"]);
    return id;
  }

  static async getAll(filters = {}) {
    let query = `
      SELECT fq.*, fc.name as category_name 
      FROM feedback_questions fq
      JOIN feedback_categories fc ON fq.category_id = fc.id
      WHERE fq.status = 1 AND fc.status = 1
    `;
    const params = [];

    if (filters.category_id) {
      query += ` AND fq.category_id = ?`;
      params.push(filters.category_id);
    }

    if (filters.search) {
      query += ` AND fq.question LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    // Sorting
    const sortOrder = filters.sort_order === "desc" ? "DESC" : "ASC";
    query += ` ORDER BY fq.created_at ${sortOrder}`;

    // Pagination
    let page = 1;
    let limit = 1000;
    let totalCount = 0;

    // Count
    let countQuery = `
      SELECT COUNT(*) as totalCount 
      FROM feedback_questions fq
      JOIN feedback_categories fc ON fq.category_id = fc.id
      WHERE fq.status = 1 AND fc.status = 1
    `;

    if (filters.category_id) {
      countQuery += ` AND fq.category_id = ?`;
    }
    if (filters.search) {
      countQuery += ` AND fq.question LIKE ?`;
    }

    const [countResult] = await db.query(countQuery, params);
    totalCount = countResult[0].totalCount;

    if (filters.page && filters.limit) {
      page = Math.max(1, Number(filters.page));
      limit = Number(filters.limit);
      const offset = (page - 1) * limit;
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const [rows] = await db.query(query, params);

    return {
      data: rows,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  static async getById(id) {
    const query = `SELECT * FROM feedback_questions WHERE id = ? AND status = 1`;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async update(id, updateData) {
    const { category_id, question, type } = updateData;
    const query = `UPDATE feedback_questions SET category_id = ?, question = ?, type = ? WHERE id = ?`;
    const [result] = await db.query(query, [category_id, question, type, id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const query = `UPDATE feedback_questions SET status = 0 WHERE id = ?`;
    const [result] = await db.query(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = FeedbackQuestionDao;
