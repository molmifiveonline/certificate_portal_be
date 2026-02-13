const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class FeedbackCategoryDao {
  static async create(categoryData) {
    const { name, description } = categoryData;
    const id = uuidv4();
    const query = `INSERT INTO feedback_categories (id, name, description) VALUES (?, ?, ?)`;
    await db.query(query, [id, name, description]);
    return id;
  }

  static async getAll(filters = {}) {
    let query = `SELECT * FROM feedback_categories WHERE status = 1`;
    const params = [];

    if (filters.search) {
      query += ` AND name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    // Sorting
    const sortOrder = filters.sort_order === "desc" ? "DESC" : "ASC";
    query += ` ORDER BY name ${sortOrder}`;

    // Pagination
    let page = 1;
    let limit = 1000; // Default to all if not specified
    let totalCount = 0;

    // First get count for pagination
    const countQuery = `SELECT COUNT(*) as totalCount FROM feedback_categories WHERE status = 1 ${filters.search ? "AND name LIKE ?" : ""}`;
    const [countResult] = await db.query(
      countQuery,
      filters.search ? [`%${filters.search}%`] : [],
    );
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
    const query = `SELECT * FROM feedback_categories WHERE id = ? AND status = 1`;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async update(id, updateData) {
    const { name, description } = updateData;
    const query = `UPDATE feedback_categories SET name = ?, description = ? WHERE id = ?`;
    const [result] = await db.query(query, [name, description, id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const query = `UPDATE feedback_categories SET status = 0 WHERE id = ?`;
    const [result] = await db.query(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = FeedbackCategoryDao;
