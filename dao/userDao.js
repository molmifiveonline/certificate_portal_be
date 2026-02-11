const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class UserDao {
  static async findUserByEmail(email) {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0];
  }

  static async findUserById(id) {
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    return rows[0];
  }

  static async createUser(userData) {
    const {
      role_id,
      first_name,
      last_name,
      email,
      password,
      mobile,
      status = 1,
    } = userData;
    const userId = uuidv4();
    const [result] = await db.query(
      "INSERT INTO users (id, role_id, first_name, last_name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [userId, role_id, first_name, last_name, email, password, mobile, status],
    );
    return userId;
  }

  static async createCandidateProfile(profileData) {
    const {
      user_id,
      middle_name,
      prefix,
      gender,
      dob,
      nationality,
      passport_no,
      employee_id,
      manager,
      other_manager,
      rank,
      other_rank,
      whatsapp_number,
      alternate_mobile,
      indos_number,
      registration_type,
    } = profileData;

    const profileId = uuidv4();
    const [result] = await db.query(
      `INSERT INTO candidate_profiles 
      (id, user_id, middle_name, prefix, gender, dob, nationality, passport_no, employee_id, manager, other_manager, rank, other_rank, whatsapp_number, alternate_mobile, indos_number, registration_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profileId,
        user_id,
        middle_name,
        prefix,
        gender,
        dob,
        nationality,
        passport_no,
        employee_id,
        manager,
        other_manager,
        rank,
        other_rank,
        whatsapp_number,
        alternate_mobile,
        indos_number,
        registration_type,
      ],
    );
    return profileId;
  }

  static async createTrainerProfile(profileData) {
    const { user_id, rank, specialization } = profileData;
    const profileId = uuidv4();
    const [result] = await db.query(
      "INSERT INTO trainer_profiles (id, user_id, rank, specialization) VALUES (?, ?, ?, ?)",
      [profileId, user_id, rank, specialization],
    );
    return profileId;
  }

  static async updateUserPassword(userId, hashedPassword) {
    const [result] = await db.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashedPassword, userId],
    );
    return result.affectedRows > 0;
  }
}

module.exports = UserDao;
