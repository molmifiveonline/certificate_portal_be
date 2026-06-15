const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class SystemManualCategoryDao {
  static async getAllCategories(filters = {}) {
    let baseQuery = " FROM system_manual_categories WHERE status = 1";
    const params = [];

    if (filters.search) {
      baseQuery += " AND (name LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm);
    }

    // Get total count for pagination if specified
    const countQuery = `SELECT COUNT(*) as totalCount ${baseQuery}`;
    const [countResult] = await db.query(countQuery, params);
    const totalCount = countResult[0].totalCount;

    // Build data query
    let dataQuery = `SELECT * ${baseQuery}`;

    // Sorting
    const sortBy = filters.sort_by || "created_at";
    const sortOrder = filters.sort_order === "asc" ? "ASC" : "DESC";
    const allowedSortColumns = ["name", "created_at", "updated_at"];
    if (allowedSortColumns.includes(sortBy)) {
      dataQuery += ` ORDER BY ${sortBy} ${sortOrder}`;
    } else {
      dataQuery += " ORDER BY created_at DESC";
    }

    // Pagination
    const dataParams = [...params];
    let page = null;
    let limit = null;

    if (filters.page && filters.limit) {
      page = Math.max(1, Number(filters.page));
      limit = Number(filters.limit);
      const offset = (page - 1) * limit;
      dataQuery += ` LIMIT ? OFFSET ?`;
      dataParams.push(limit, offset);
    }

    const [rows] = await db.query(dataQuery, dataParams);
    return {
      data: rows,
      total: totalCount,
      page: page || 1,
      limit: limit || totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
    };
  }

  static async getCategoryById(id) {
    const query = "SELECT * FROM system_manual_categories WHERE id = ? AND status = 1";
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async createCategory(data) {
    const { name, description } = data;
    const id = uuidv4();
    await db.query(
      `INSERT INTO system_manual_categories (id, name, description) 
       VALUES (?, ?, ?)`,
      [id, name, description],
    );
    return id;
  }

  static async updateCategory(id, updateData) {
    const fields = ["name", "description", "status"];
    const updates = [];
    const params = [];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    });

    if (updates.length > 0) {
      params.push(id);
      const [result] = await db.query(
        `UPDATE system_manual_categories SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );
      return result.affectedRows > 0;
    }
    return false;
  }

  static async deleteCategory(id) {
    // Soft delete
    const [result] = await db.query(
      "UPDATE system_manual_categories SET status = 0 WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = SystemManualCategoryDao;
