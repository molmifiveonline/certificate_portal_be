const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class TrainerDao {
  static async createTrainer(trainerData) {
    const {
      role_id,
      first_name,
      last_name,
      email,
      password,
      mobile,
      prefix,
      officer,
      other_officer,
      designation,
      nationality,
      rank,
      specialization,
      digital_signature,
      profile_photo,
    } = trainerData;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Create User
      const userId = uuidv4();
      await connection.query(
        "INSERT INTO users (id, role_id, first_name, last_name, email, password, mobile) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [userId, role_id, first_name, last_name, email, password, mobile],
      );

      // 2. Create Trainer Profile
      const profileId = uuidv4();
      await connection.query(
        `INSERT INTO trainer_profiles 
        (id, user_id, prefix, officer, other_officer, designation, nationality, rank, specialization, digital_signature, profile_photo) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileId,
          userId,
          prefix,
          officer,
          other_officer,
          designation,
          nationality,
          rank,
          specialization,
          digital_signature,
          profile_photo,
        ],
      );

      await connection.commit();
      return userId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getAllTrainers(filters = {}) {
    let query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile,
        tp.prefix, tp.officer, tp.other_officer, tp.designation, 
        tp.nationality, tp.rank, tp.specialization, 
        tp.digital_signature, tp.profile_photo, tp.status
      FROM users u
      JOIN trainer_profiles tp ON u.id = tp.user_id
      WHERE tp.status = 1
    `;

    const params = [];

    // Search filter
    if (filters.search) {
      query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR tp.designation LIKE ? OR u.email LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Pagination
    if (filters.limit && filters.offset !== undefined) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(Number(filters.limit), Number(filters.offset));
    }

    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getTrainerById(id) {
    const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile,
        tp.prefix, tp.officer, tp.other_officer, tp.designation, 
        tp.nationality, tp.rank, tp.specialization, 
        tp.digital_signature, tp.profile_photo, tp.status
      FROM users u
      JOIN trainer_profiles tp ON u.id = tp.user_id
      WHERE u.id = ? AND tp.status = 1
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async updateTrainer(id, updateData) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Update User fields if present
      const userFields = ["first_name", "last_name", "email", "mobile"];
      const userUpdates = [];
      const userpParams = [];

      userFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          userUpdates.push(`${field} = ?`);
          userpParams.push(updateData[field]);
        }
      });

      if (userUpdates.length > 0) {
        userpParams.push(id);
        await connection.query(
          `UPDATE users SET ${userUpdates.join(", ")} WHERE id = ?`,
          userpParams,
        );
      }

      // Update Profile fields
      const profileFields = [
        "prefix",
        "officer",
        "other_officer",
        "designation",
        "nationality",
        "rank",
        "specialization",
        "digital_signature",
        "profile_photo",
      ];
      const profileUpdates = [];
      const profileParams = [];

      profileFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          profileUpdates.push(`${field} = ?`);
          profileParams.push(updateData[field]);
        }
      });

      if (profileUpdates.length > 0) {
        profileParams.push(id);
        await connection.query(
          `UPDATE trainer_profiles SET ${profileUpdates.join(", ")} WHERE user_id = ?`,
          profileParams,
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteTrainer(id) {
    // Soft delete by setting status = 0 in trainer_profiles
    const [result] = await db.query(
      "UPDATE trainer_profiles SET status = 0 WHERE user_id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = TrainerDao;
