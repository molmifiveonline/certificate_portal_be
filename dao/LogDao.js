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

  static async getLogs() {
    const [rows] = await db.query(
      "SELECT * FROM logs ORDER BY created_at DESC",
    );
    return rows;
  }

  static async getLogsByUserId(userId) {
    const [rows] = await db.query(
      "SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );
    return rows;
  }

  static async deleteLog(logId) {
    const [result] = await db.query("DELETE FROM logs WHERE id = ?", [logId]);
    return result;
  }
}

module.exports = LogDao;
