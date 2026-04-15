const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const buildFullName = (firstName = "", lastName = "") =>
  [firstName, lastName].filter(Boolean).join(" ").trim();

class NominatorDao {
  static async createNominator(nominatorData) {
    const {
      first_name,
      last_name = "",
      email,
      mobile = null,
      password,
      location = null,
      status = 1,
      gender = null,
    } = nominatorData;
    const id = uuidv4();
    const name = buildFullName(first_name, last_name);
    const query = `
      INSERT INTO nominators
      (id, name, first_name, last_name, email, mobile, password, location, status, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.query(query, [
      id,
      name,
      first_name,
      last_name,
      email,
      mobile,
      password,
      location,
      status,
      gender,
    ]);
    return id;
  }

  static async getAllNominators(page, limit, search = "") {
    let baseQuery = "FROM nominators WHERE 1=1";
    const values = [];

    if (search) {
      baseQuery += ` AND (name LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR mobile LIKE ? OR location LIKE ?)`;
      const searchTerm = `%${search}%`;
      values.push(
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      );
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countResult] = await db.query(countQuery, values);
    const total = countResult[0].total;

    // Build data query
    let dataQuery = `
      SELECT id, name, first_name, last_name, email, mobile, location, status, gender, created_at, updated_at
      ${baseQuery}
      ORDER BY created_at DESC
    `;

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
    const query = `
      SELECT id, name, first_name, last_name, email, mobile, location, status, gender, created_at, updated_at
      FROM nominators
      WHERE id = ?
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async findNominatorByEmail(email) {
    const query = "SELECT * FROM nominators WHERE email = ?";
    const [rows] = await db.query(query, [email]);
    return rows[0];
  }

  static async updateNominator(id, nominatorData) {
    const {
      first_name,
      last_name = "",
      email,
      mobile = null,
      password,
      location = null,
      status = 1,
      gender = null,
    } = nominatorData;
    const name = buildFullName(first_name, last_name);
    const fields = [
      "name = ?",
      "first_name = ?",
      "last_name = ?",
      "email = ?",
      "mobile = ?",
      "location = ?",
      "status = ?",
      "gender = ?",
    ];
    const values = [
      name,
      first_name,
      last_name,
      email,
      mobile,
      location,
      status,
      gender,
    ];

    if (password) {
      fields.push("password = ?");
      values.push(password);
    }

    values.push(id);
    const query = `UPDATE nominators SET ${fields.join(", ")} WHERE id = ?`;
    const [result] = await db.query(query, values);
    return result.affectedRows > 0;
  }

  static async deleteNominator(id) {
    const query = "DELETE FROM nominators WHERE id = ?";
    const [result] = await db.query(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = NominatorDao;
