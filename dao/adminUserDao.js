const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class AdminUserDao {
  static async getAllAdmins(page, limit, search) {
    let query = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.mobile, u.gender, u.status, r.name as role, u.admin_role_id, ar.role_name as admin_role_name
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      LEFT JOIN admin_roles ar ON u.admin_role_id = ar.id
      WHERE r.name IN ('admin', 'superadmin')
    `;
    const params = [];

    if (search) {
      query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    query += ` ORDER BY u.created_at DESC`;

    if (page && limit) {
      const countQuery =
        `
        SELECT COUNT(*) as total 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE r.name IN ('admin', 'superadmin')
      ` +
        (search
          ? ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)`
          : "");

      const countParams = search
        ? [searchParam, searchParam, searchParam, searchParam]
        : [];
      const [countResult] = await db.query(countQuery, countParams);
      const total = countResult[0].total;

      const offset = (page - 1) * limit;
      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(query, params);
      return {
        data: rows,
        meta: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getAdminById(id) {
    const [rows] = await db.query(
      `
      SELECT u.id, u.first_name, u.last_name, u.email, u.mobile, u.gender, u.status, u.role_id, r.name as role, u.admin_role_id, ar.role_name as admin_role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN admin_roles ar ON u.admin_role_id = ar.id
      WHERE u.id = ? AND r.name IN ('admin', 'superadmin')
    `,
      [id],
    );
    return rows[0];
  }

  static async findUserByEmail(email, excludeId = null) {
    let query = "SELECT * FROM users WHERE email = ?";
    const params = [email];
    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }
    const [rows] = await db.query(query, params);
    return rows[0];
  }

  static async createAdmin(adminData) {
    const {
      role_id,
      admin_role_id = null,
      first_name,
      last_name,
      email,
      password,
      mobile,
      gender,
      status = 1,
    } = adminData;
    const userId = uuidv4();
    await db.query(
      "INSERT INTO users (id, role_id, admin_role_id, first_name, last_name, email, password, mobile, gender, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        userId,
        role_id,
        admin_role_id,
        first_name,
        last_name,
        email,
        password,
        mobile,
        gender,
        status,
      ],
    );
    return userId;
  }

  static async updateAdmin(id, adminData) {
    const {
      first_name,
      last_name,
      email,
      mobile,
      gender,
      status,
      password,
      admin_role_id,
    } = adminData;
    let query =
      "UPDATE users SET first_name = ?, last_name = ?, email = ?, mobile = ?, gender = ?, status = ?, admin_role_id = ?";
    const params = [
      first_name,
      last_name,
      email,
      mobile,
      gender,
      status,
      admin_role_id || null,
    ];

    if (password) {
      query += ", password = ?";
      params.push(password);
    }

    query += " WHERE id = ?";
    params.push(id);

    const [result] = await db.query(query, params);
    return result.affectedRows > 0;
  }

  static async deleteAdmin(id) {
    const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
}

module.exports = AdminUserDao;
