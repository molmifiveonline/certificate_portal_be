const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class NominatorDao {
  static async createNominator(nominatorData) {
    const { name, email } = nominatorData;
    const id = uuidv4();
    const query = "INSERT INTO nominators (id, name, email) VALUES (?, ?, ?)";
    await db.query(query, [id, name, email]);
    return id;
  }

  static async getAllNominators(page, limit, search = "") {
    let baseQuery = "FROM nominators WHERE 1=1";
    const values = [];

    if (search) {
      baseQuery += ` AND (name LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${search}%`;
      values.push(searchTerm, searchTerm);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0].total;

    // Build data query
    let dataQuery = `SELECT * ${baseQuery} ORDER BY created_at DESC`;

    // Add pagination
    let pageNum = page ? parseInt(page, 10) : null;
    let limitNum = limit ? parseInt(limit, 10) : null;

    if (pageNum && limitNum) {
      const offset = (pageNum - 1) * limitNum;
      dataQuery += ` LIMIT ? OFFSET ?`;
      values.push(limitNum, offset); // db.query (mysql2) accepts numbers for LIMIT/OFFSET
    }

    const [rows] = await db.query(dataQuery, values);

    return {
      data: rows,
      total,
      page: pageNum || 1,
      limit: limitNum || total,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
    };
  }

  static async getNominatorById(id) {
    const query = "SELECT * FROM nominators WHERE id = ?";
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async updateNominator(id, nominatorData) {
    const { name, email } = nominatorData;
    const query = "UPDATE nominators SET name = ?, email = ? WHERE id = ?";
    const [result] = await db.query(query, [name, email, id]);
    return result.affectedRows > 0;
  }

  static async deleteNominator(id) {
    const query = "DELETE FROM nominators WHERE id = ?";
    const [result] = await db.query(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = NominatorDao;
