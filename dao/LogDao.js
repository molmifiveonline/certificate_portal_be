const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class LogDao {
  static async createLog(logData) {
    const { user_id, action, details, ip_address, user_agent } = logData;
    const logId = uuidv4();
    const [result] = await db.query(
      "INSERT INTO logs (id, user_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
      [logId, user_id, action, details, ip_address, user_agent],
    );
    return result;
  }

  static async getLogs(page = 1, limit = 10, search = "") {
    const offset = (page - 1) * limit;

    // Start with Base Condition: Last 3 Months
    let whereClause =
      "WHERE logs.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
    let queryParams = [];

    if (search) {
      whereClause += ` AND (logs.action LIKE ? OR logs.details LIKE ? OR logs.ip_address LIKE ? OR CONCAT(users.first_name, ' ', users.last_name) LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Count Total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total 
       FROM logs 
       LEFT JOIN users ON logs.user_id = users.id 
       ${whereClause}`,
      queryParams,
    );
    const total = countResult[0].total;

    // Get Data
    const [rows] = await db.query(
      `SELECT logs.*, CONCAT(users.first_name, ' ', users.last_name) AS user_name 
       FROM logs 
       LEFT JOIN users ON logs.user_id = users.id 
       ${whereClause} 
       ORDER BY logs.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), parseInt(offset)],
    );

    return {
      data: rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getLogsByUserId(userId, page = 1, limit = 10, search = "") {
    const offset = (page - 1) * limit;

    // Base Condition: Last 3 Months AND User ID
    let whereClause =
      "WHERE logs.user_id = ? AND logs.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
    let queryParams = [userId];

    if (search) {
      whereClause += ` AND (logs.action LIKE ? OR logs.details LIKE ? OR logs.ip_address LIKE ? OR CONCAT(users.first_name, ' ', users.last_name) LIKE ?)`;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Count Total
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total 
       FROM logs 
       LEFT JOIN users ON logs.user_id = users.id 
       ${whereClause}`,
      queryParams,
    );
    const total = countResult[0].total;

    // Get Data
    const [rows] = await db.query(
      `SELECT logs.*, CONCAT(users.first_name, ' ', users.last_name) AS user_name 
       FROM logs 
       LEFT JOIN users ON logs.user_id = users.id 
       ${whereClause}
       ORDER BY logs.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), parseInt(offset)],
    );

    return {
      data: rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  static async deleteLog(logId) {
    const [result] = await db.query("DELETE FROM logs WHERE id = ?", [logId]);
    return result;
  }
}

module.exports = LogDao;
