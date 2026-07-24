const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class OtpDao {
  static async findByUserId(userId) {
    const [rows] = await db.query(
      "SELECT * FROM user_otp_verifications WHERE user_id = ?",
      [userId]
    );
    return rows[0];
  }

  static async findByNominatorId(nominatorId) {
    const [rows] = await db.query(
      "SELECT * FROM user_otp_verifications WHERE nominator_id = ?",
      [nominatorId]
    );
    return rows[0];
  }

  static async findByDeviceTrustToken(token) {
    if (!token) return null;
    const [rows] = await db.query(
      "SELECT * FROM user_otp_verifications WHERE device_trust_token = ?",
      [token]
    );
    return rows[0];
  }

  static async upsertOtp(userId, nominatorId, otpHash, expiresAt) {
    let row;
    if (userId) {
      row = await this.findByUserId(userId);
    } else if (nominatorId) {
      row = await this.findByNominatorId(nominatorId);
    }

    if (row) {
      await db.query(
        "UPDATE user_otp_verifications SET otp_hash = ?, otp_expires_at = ?, otp_attempts = 0 WHERE id = ?",
        [otpHash, expiresAt, row.id]
      );
      return row.id;
    } else {
      const id = uuidv4();
      await db.query(
        "INSERT INTO user_otp_verifications (id, user_id, nominator_id, otp_hash, otp_expires_at, otp_attempts) VALUES (?, ?, ?, ?, ?, 0)",
        [id, userId, nominatorId, otpHash, expiresAt]
      );
      return id;
    }
  }

  static async incrementAttempts(id) {
    await db.query(
      "UPDATE user_otp_verifications SET otp_attempts = otp_attempts + 1 WHERE id = ?",
      [id]
    );
  }

  static async saveDeviceTrust(id, trustToken, expiresAt) {
    await db.query(
      "UPDATE user_otp_verifications SET device_trust_token = ?, device_trust_expires_at = ? WHERE id = ?",
      [trustToken, expiresAt, id]
    );
  }

  static async clearOtp(id) {
    await db.query(
      "UPDATE user_otp_verifications SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE id = ?",
      [id]
    );
  }
}

module.exports = OtpDao;
