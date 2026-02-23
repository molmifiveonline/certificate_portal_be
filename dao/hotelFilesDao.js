const pool = require("../config/db");

class HotelFilesDao {
  static async create(fileData) {
    const { ce_id, candidate_id, file_name, file_type, uploaded_at, status } =
      fileData;
    const query = `
      INSERT INTO hotel_files (ce_id, candidate_id, file_name, file_type, uploaded_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [
      ce_id,
      candidate_id,
      file_name,
      file_type,
      uploaded_at,
      status || 1,
    ]);
    return result.insertId;
  }

  static async getFilesByEnrollmentId(ceId) {
    const query = `SELECT * FROM hotel_files WHERE ce_id = ? AND status = 1`;
    const [rows] = await pool.execute(query, [ceId]);
    return rows;
  }

  static async deleteFile(id) {
    const query = `UPDATE hotel_files SET status = 0 WHERE id = ?`;
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = HotelFilesDao;
